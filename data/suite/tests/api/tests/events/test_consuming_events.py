"""How wallet-txn-service copes with real-world delivery (spec 6.4, 16.3 rules 28 to 31).

Kafka delivers at least once, and two topics have no order between them. So the consumer
must cope with three things a happy path never shows:

* the same event twice:          applied once (deduplicated by event_id)
* txn.cleared before auth.decided: the same end state as the usual order
* a message it cannot read:      retried, then parked on the DLQ, and the partition moves on

These tests publish events themselves. Each event is copied from a real one and given a
new trace_id, so it belongs to the test's own fresh card and touches nobody else's data.
"""

from __future__ import annotations

import copy
import json
import uuid

import pytest

from cardvault_tests.checks import expect
from cardvault_tests.clients.card_network import new_clearing_id, new_trace_id
from cardvault_tests.data import card, customer
from cardvault_tests.events import produce_raw
from cardvault_tests.models import Clearing, TransactionPage
from cardvault_tests.transactions import wait_for_transaction, wallet_purchase


@pytest.fixture
def captured(make_customer, card_network, watch):
    """A fresh customer's settled wallet purchase, with its two real events captured."""
    auths, clears = watch("auth.decided"), watch("txn.cleared")
    someone = make_customer(customer(card(enrolled=True)))
    auth = wallet_purchase(card_network, someone.new_cards[0], 2_000)
    expect(card_network.settle(auth.trace_id, 2_000), 200, Clearing)
    auth_event = auths.wait_for(lambda e: e.payload["trace_id"] == auth.trace_id)
    clear_event = clears.wait_for(lambda e: e.payload["trace_id"] == auth.trace_id)
    wait_for_transaction(someone, auth.trace_id, lambda t: t.status == "SETTLED")
    return someone, auth_event, clear_event


def republish(event, settings, *, as_new: bool = True, **payload_changes) -> None:
    """Publish a copy of ``event``. ``as_new`` gives it a new event_id, so the consumer
    treats it as a different event; ``as_new=False`` is a true redelivery."""
    envelope = copy.deepcopy(event.envelope)
    if as_new:
        envelope["event_id"] = str(uuid.uuid4())
    envelope["payload"].update(payload_changes)
    produce_raw(settings.kafka_bootstrap, event.topic, event.key, json.dumps(envelope).encode())


@pytest.mark.lesson
def test_a_redelivered_event_changes_nothing(captured, settings):
    someone, auth_event, clear_event = captured
    before = expect(someone.transactions.list(), 200, TransactionPage).items

    # Exactly the same envelopes again, as Kafka does after a consumer restart.
    republish(clear_event, settings, as_new=False)
    republish(auth_event, settings, as_new=False)
    # A marker event published after them on the same key (same partition) shows they were
    # consumed: once the marker's transaction exists, the repeats were handled before it.
    marker = new_trace_id()
    republish(auth_event, settings, trace_id=marker)
    wait_for_transaction(someone, marker)

    after = [
        t
        for t in expect(someone.transactions.list(), 200, TransactionPage).items
        if t.trace_id != marker
    ]
    assert after == before


def test_clearing_that_arrives_first_ends_in_the_same_state(captured, settings):
    someone, auth_event, clear_event = captured
    trace_id = new_trace_id()

    republish(clear_event, settings, trace_id=trace_id, clearing_id=new_clearing_id())
    # Only the clearing record has arrived: the row exists with no authorization yet.
    early = wait_for_transaction(someone, trace_id)
    assert (early.amount, early.merchant_name, early.cleared_amount) == (None, None, 2_000)

    republish(auth_event, settings, trace_id=trace_id)

    txn = wait_for_transaction(someone, trace_id, lambda t: t.amount is not None)
    assert (txn.status, txn.amount, txn.cleared_amount) == ("SETTLED", 2_000, 2_000)


@pytest.mark.serial
def test_an_unreadable_message_is_parked_on_the_dlq(captured, settings, watch):
    # serial: the bad message holds up its partition for the retries (about 1.5 s), which
    # would slow every other test's events on that partition.
    someone, auth_event, _ = captured
    dlq = watch("wallet.txn.dlq")
    poison = b'{"this is": "not an envelope"'

    produce_raw(settings.kafka_bootstrap, "auth.decided", auth_event.key, poison)

    parked = dlq.wait_for(lambda e: e.raw == poison, what="the poison message on the DLQ")
    assert parked.headers["source_topic"] == "auth.decided"
    assert parked.headers["error"]
    # The partition moved on: a later event on the same key is still applied.
    trace_id = new_trace_id()
    republish(auth_event, settings, trace_id=trace_id)
    assert wait_for_transaction(someone, trace_id).status == "AUTHORIZED"
