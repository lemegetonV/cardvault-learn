"""Events: the messages the services send each other through Kafka.

When a card changes or a purchase is decided, the Cards service publishes an event.
Other services, such as Wallet and Transactions, read it and react. These tests read
the events directly: is the broker there, and is the right event sent with the right details?
"""

import pytest

from api.card_network_api import CardNetworkApi
from api.cards_api import CardsApi
from events import EventWatcher, list_topics

# Every test in this file needs access to Kafka, so label them all at once.
pytestmark = pytest.mark.events

# The topics the services publish on. Each one carries one kind of event.
APP_TOPICS = [
    "card.lifecycle",
    "auth.decided",
    "txn.cleared",
    "enrollment.changed",
    "contact.updated",
]


def test_the_broker_has_every_topic_the_app_uses():
    topics = list_topics()

    for topic in APP_TOPICS:
        assert topic in topics


def test_reporting_a_card_lost_sends_a_card_lost_event(customer):
    card_id = customer["new_card"]["card_id"]
    watcher = EventWatcher("card.lifecycle")  # start watching before the action

    CardsApi(customer["token"]).report_lost(card_id)

    event = watcher.wait_for("card_id", card_id)
    assert event["event_type"] == "card.lifecycle"
    assert event["payload"]["event"] == "CARD_LOST"
    assert event["payload"]["status"] == "LOST"
    # Every event carries an ID and a time, so it can be traced and ordered.
    assert event["event_id"]
    assert event["occurred_at"]


def test_a_purchase_sends_an_event_with_the_decision(customer):
    card = customer["wallet_card"]
    watcher = EventWatcher("auth.decided")

    response = CardNetworkApi().make_purchase(card["token_ref"], amount=2500)

    event = watcher.wait_for("trace_id", response.json()["trace_id"])
    assert event["payload"]["decision"] == "APPROVED"
    assert event["payload"]["amount"] == 2500
    assert event["payload"]["card_id"] == card["card_id"]
