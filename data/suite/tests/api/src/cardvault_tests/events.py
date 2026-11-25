"""Reading CardVault's Kafka events from the outside.

Services tell each other about changes through events (``auth.decided``, ``card.lifecycle``
and so on). Some facts are only visible there: that an event was published at all, its
shape, its key, and the correlation ID it carries. ``EventWatch`` starts reading a topic at
its current end *before* the test acts, so it sees only what happens afterwards, and then
waits, with a bound, for an event that matches.

confluent-kafka is a Python wrapper around librdkafka, the C Kafka client. The suite only
reads, with a fresh consumer group per watch that never commits offsets, so it does not
disturb the services' own consumers.
"""

from __future__ import annotations

import json
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from functools import cache
from typing import Any

from confluent_kafka import OFFSET_END, Consumer, Producer, TopicPartition
from jsonschema import Draft202012Validator

from cardvault_tests.settings import SUITE_ROOT

SCHEMAS = SUITE_ROOT.parents[1] / "docs" / "events"  # the published event contracts


@dataclass
class Event:
    topic: str
    key: str
    headers: dict[str, str]
    raw: bytes
    envelope: dict[str, Any]  # empty when the message is not JSON (e.g. a poison message)

    @property
    def payload(self) -> dict[str, Any]:
        return self.envelope["payload"]


class EventWatch:
    def __init__(self, bootstrap: str, topic: str) -> None:
        self.topic = topic
        self.seen: list[Event] = []
        self.consumer = Consumer(
            {
                "bootstrap.servers": bootstrap,
                "group.id": f"api-suite-{uuid.uuid4().hex[:12]}",
                "enable.auto.commit": False,
                "auto.offset.reset": "latest",
            }
        )
        partitions = self.consumer.list_topics(topic, timeout=10).topics[topic].partitions
        # Start every partition at its end: only events published from now on are read.
        ends = []
        for p in partitions:
            _, high = self.consumer.get_watermark_offsets(TopicPartition(topic, p), timeout=10)
            ends.append(TopicPartition(topic, p, high if high >= 0 else OFFSET_END))
        self.consumer.assign(ends)

    def wait_for(
        self, match: Callable[[Event], bool], *, timeout: float = 15.0, what: str = ""
    ) -> Event:
        """The first event (seen before or arriving now) for which ``match`` is true."""
        for event in self.seen:
            if match(event):
                return event
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            msg = self.consumer.poll(0.25)
            if msg is None or msg.error():
                continue
            event = Event(
                topic=msg.topic(),
                key=(msg.key() or b"").decode(),
                headers={k: (v or b"").decode() for k, v in (msg.headers() or [])},
                raw=msg.value() or b"",
                envelope=_json(msg.value()),
            )
            self.seen.append(event)
            if match(event):
                return event
        raise AssertionError(
            f"no {what or 'matching'} event on {self.topic} within {timeout}s; "
            f"saw {len(self.seen)}: {[e.envelope.get('event_type') for e in self.seen][:20]}"
        )

    def close(self) -> None:
        self.consumer.close()


def _json(value: bytes | None) -> dict[str, Any]:
    try:
        data = json.loads(value or b"")
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def produce_raw(bootstrap: str, topic: str, key: str, value: bytes) -> None:
    """Publish a message as if a service had, e.g. a malformed one. Uncompressed, because
    the services cannot read every compression codec."""
    producer = Producer({"bootstrap.servers": bootstrap, "compression.type": "none"})
    producer.produce(topic, key=key.encode(), value=value)
    assert producer.flush(10) == 0, f"message to {topic} was not delivered"


@cache
def validator(event_type: str) -> Draft202012Validator:
    schema = json.loads((SCHEMAS / f"{event_type}.schema.json").read_text())
    return Draft202012Validator(schema, format_checker=Draft202012Validator.FORMAT_CHECKER)


def schema_errors(event: Event) -> list[str]:
    """Every way the envelope breaks its published JSON Schema (empty when it conforms)."""
    v = validator(event.envelope["event_type"])
    return [f"{'/'.join(map(str, e.path))}: {e.message}" for e in v.iter_errors(event.envelope)]
