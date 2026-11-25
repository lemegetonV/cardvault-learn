"""The card state machine (spec 6.2, 16.1 rules 1 and 2).

    report-lost: ACTIVE -> LOST
    reissue:     ACTIVE or LOST -> ACTIVE (new number and expiry, same card_id)
    close:       ACTIVE or LOST -> CLOSED, for good

Any other move is 409 INVALID_STATE_TRANSITION. Repeating a destructive action that has
already happened (report lost on a LOST card, close a CLOSED card) returns 200 and changes
nothing. Every combination of starting status and action is one row of the table below.
"""

from __future__ import annotations

from datetime import datetime

import pytest

from cardvault_tests.checks import expect, expect_error
from cardvault_tests.data import card, customer
from cardvault_tests.models import Card, ClockView

TRANSITIONS = [
    # start,    action,        HTTP, resulting status (or None for a 409)
    ("ACTIVE", "report-lost", 200, "LOST"),
    ("LOST", "report-lost", 200, "LOST"),  # repeat: no change
    ("CLOSED", "report-lost", 409, None),
    ("ACTIVE", "reissue", 200, "ACTIVE"),
    ("LOST", "reissue", 200, "ACTIVE"),
    ("CLOSED", "reissue", 409, None),
    ("ACTIVE", "close", 200, "CLOSED"),
    ("LOST", "close", 200, "CLOSED"),
    ("CLOSED", "close", 200, "CLOSED"),  # repeat: no change
]


def act(someone, action: str, card_id):
    do = {
        "report-lost": someone.cards.report_lost,
        "reissue": someone.cards.reissue,
        "close": someone.cards.close,
    }[action]
    return do(card_id)


@pytest.mark.parametrize(
    ("start", "action", "http_status", "result"),
    TRANSITIONS,
    ids=[f"{start}-{action}" for start, action, *_ in TRANSITIONS],
)
def test_card_transition(make_customer, start, action, http_status, result):
    someone = make_customer(customer(card(status=start)))
    card_id = someone.card_ids[0]

    resp = act(someone, action, card_id)

    if result is None:
        error = expect_error(resp, 409, "INVALID_STATE_TRANSITION")
        assert error.details == {"status": start, "action": action}
        result = start  # a refused move leaves the card as it was
    else:
        assert expect(resp, http_status, Card).status == result
    assert expect(someone.cards.get(card_id), 200, Card).status == result


@pytest.mark.parametrize(
    ("start", "action"), [("LOST", "report-lost"), ("CLOSED", "close")], ids=["lost", "closed"]
)
def test_repeating_a_destructive_action_returns_the_card_unchanged(make_customer, start, action):
    someone = make_customer(customer(card(status=start)))
    card_id = someone.card_ids[0]
    before = expect(someone.cards.get(card_id), 200, Card)

    after = expect(act(someone, action, card_id), 200, Card)

    assert after == before


def test_reissue_keeps_the_card_id_and_usage_and_sets_a_new_expiry(make_customer, controls):
    someone = make_customer(customer(card(status="LOST", used_days_ago=3)))
    card_id = someone.card_ids[0]
    before = expect(someone.cards.get(card_id), 200, Card)

    after = expect(someone.cards.reissue(card_id), 200, Card)

    # Expected expiry: the shared clock's month, four years on (CardVault's reissue rule).
    now: datetime = expect(controls["card"].clock(), 200, ClockView).now
    assert after.card_id == card_id
    assert after.status == "ACTIVE"
    assert after.expiry == f"{now.year + 4:04d}-{now.month:02d}"
    assert after.last_used_at == before.last_used_at
    # The new last4 is not compared with the old one: the new number is random, so the two
    # can match by chance (1 in 10,000), and a test must not fail by chance.


def test_a_closed_card_stays_closed(make_customer):
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]
    expect(someone.cards.close(card_id), 200, Card)

    expect_error(someone.cards.reissue(card_id), 409, "INVALID_STATE_TRANSITION")
    expect_error(someone.cards.report_lost(card_id), 409, "INVALID_STATE_TRANSITION")
    assert expect(someone.cards.get(card_id), 200, Card).status == "CLOSED"
