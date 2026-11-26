"""Read events from Kafka, the message bus the services use to tell each other about changes.

When something important happens, for example a card is reported lost, the service that
owns it publishes an event on a topic (here "card.lifecycle"). Other services read the
topic and react. Every event has the same outer shape:

    {"event_id": ..., "event_type": "card.lifecycle", "version": 1,
     "occurred_at": ..., "correlation_id": ..., "payload": {...the details...}}
"""

import json
import time

from kafka import KafkaConsumer, TopicPartition

import config


def connect():
    """Open a connection to the Kafka broker for reading."""
    # Tests only look at events. They never save how far they have read, so auto-commit is off.
    return KafkaConsumer(bootstrap_servers=config.KAFKA_BOOTSTRAP, enable_auto_commit=False)


def list_topics():
    """Return the names of all the topics the Kafka broker has."""
    consumer = connect()
    topics = consumer.topics()
    consumer.close()
    return topics


class EventWatcher:
    """Watches one topic for new events.

    Create it BEFORE the action that should send the event. It only sees events
    published after it was created, so an older event can never make a test pass.
    """

    def __init__(self, topic):
        self.consumer = connect()
        # A topic is split into partitions. Read all of them, starting at their current end.
        partitions = []
        for number in self.consumer.partitions_for_topic(topic):
            partitions.append(TopicPartition(topic, number))
        self.consumer.assign(partitions)
        self.consumer.seek_to_end()
        # Ask for each position now, so "the end" is fixed before the test's action happens.
        for partition in partitions:
            self.consumer.position(partition)

    def wait_for(self, field, value, timeout=10):
        """Return the first new event whose payload has field == value.

        For example wait_for("card_id", card_id). Fails the test if no such event
        arrives within timeout seconds. The watcher stops watching afterwards.
        """
        deadline = time.time() + timeout
        try:
            while time.time() < deadline:
                # poll() returns the messages that arrived, grouped by partition.
                batches = self.consumer.poll(timeout_ms=500)
                for messages in batches.values():
                    for message in messages:
                        event = json.loads(message.value)
                        if event["payload"].get(field) == value:
                            return event
        finally:
            self.consumer.close()
        raise AssertionError(f"No event with {field} = {value} arrived within {timeout} seconds")
