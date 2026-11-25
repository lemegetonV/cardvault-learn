"""The events each change publishes (spec 6.5, 16.3 rules 27 to 31).

Every event is an envelope (event_id, event_type, occurred_at, correlation_id, payload)
that must match its published JSON Schema in ``docs/events``, keyed so that all events
about one thing land on one partition, in order. The correlation ID is the one the request
that caused it carried, so one ID follows a purchase from the HTTP call to the last
consumer's log line.

Each test starts watching the topic before it acts, then waits for its own event.
"""

from __future__ import annotations

import uuid

from cardvault_tests.checks import expect, pan_like
from cardvault_tests.data import card, customer
from cardvault_tests.events import schema_errors
from cardvault_tests.models import Authorization, Card, Clearing, Profile, WalletCard
from cardvault_tests.transactions import wallet_purchase


def assert_well_formed(event, key) -> None:
    assert schema_errors(event) == [], f"{event.topic} breaks its schema"
    assert event.key == str(key), "keyed so one card's or customer's events stay in order"
    assert event.headers["event_id"] == event.envelope["event_id"]
    assert pan_like(event.raw) == [], "an event carries something that looks like a PAN"


def test_a_wallet_purchase_publishes_auth_decided(make_customer, card_network, watch):
    events = watch("auth.decided")
    someone = make_customer(customer(card(enrolled=True)))
    own = someone.new_cards[0]

    resp = card_network.purchase(own.card_id, 4_200, own.token_ref)

    auth = expect(resp, 200, Authorization).model_dump()
    event = events.wait_for(
        lambda e: e.payload["trace_id"] == auth["trace_id"], what="auth.decided for the purchase"
    )
    assert_well_formed(event, own.card_id)
    p = event.payload
    assert (p["decision"], p["amount"], p["token_requestor"], p["token_ref"]) == (
        "APPROVED",
        4_200,
        "WALLET",
        own.token_ref,
    )
    assert p["customer_id"] == str(someone.customer_id)
    # The ID the suite sent with the HTTP request travels on in the event.
    sent = resp.request.headers["X-Correlation-ID"]
    assert event.envelope["correlation_id"] == sent
    assert event.headers["X-Correlation-ID"] == sent


def test_clearing_publishes_txn_cleared(make_customer, card_network, watch):
    events = watch("txn.cleared")
    someone = make_customer(customer(card(enrolled=True)))
    own = someone.new_cards[0]
    auth = wallet_purchase(card_network, own, 3_000)

    cleared = expect(card_network.settle(auth.trace_id, 2_900), 200, Clearing)

    event = events.wait_for(
        lambda e: e.payload["clearing_id"] == cleared.clearing_id,
        what="txn.cleared for the settlement",
    )
    assert_well_formed(event, own.card_id)
    assert (event.payload["type"], event.payload["amount"], event.payload["trace_id"]) == (
        "SETTLE",
        2_900,
        auth.trace_id,
    )


def test_reporting_a_card_lost_publishes_card_lifecycle(make_customer, watch):
    events = watch("card.lifecycle")
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]

    expect(someone.cards.report_lost(card_id), 200, Card)

    event = events.wait_for(
        lambda e: e.payload["card_id"] == str(card_id) and e.payload["event"] == "CARD_LOST",
        what="CARD_LOST",
    )
    assert_well_formed(event, card_id)
    assert event.payload["status"] == "LOST"


def test_a_contact_change_publishes_contact_updated(make_customer, watch):
    events = watch("contact.updated")
    someone = make_customer(customer())
    email = f"{uuid.uuid4().hex[:8]}@example.test"

    profile = expect(someone.profile.patch({"email": email}), 200, Profile)

    event = events.wait_for(
        lambda e: e.payload["customer_id"] == str(someone.customer_id), what="contact.updated"
    )
    assert_well_formed(event, someone.customer_id)
    assert (event.payload["email"], event.payload["email_verified"], event.payload["version"]) == (
        email,
        False,
        profile.version,
    )


def test_adding_a_card_publishes_each_enrolment_status_in_order(make_customer, watch):
    events = watch("enrollment.changed")
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]

    expect(someone.wallet.add(card_id), 202, WalletCard)

    mine = lambda e: e.payload["card_id"] == str(card_id)  # noqa: E731
    events.wait_for(
        lambda e: mine(e) and e.payload["status"] == "ENROLLED",
        timeout=20,
        what="enrollment.changed ENROLLED",
    )
    statuses = [e.payload for e in events.seen if mine(e)]
    assert [p["status"] for p in statuses] == ["PENDING", "ENROLLED"]
    assert [p["version"] for p in statuses] == sorted(p["version"] for p in statuses)
    for event in (e for e in events.seen if mine(e)):
        assert_well_formed(event, card_id)
