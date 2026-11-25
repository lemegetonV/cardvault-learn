"""Rules that depend on the date, tested at their edges by moving the shared clock
(spec 16.3 rules 18 and 19, 16.7 rule 43).

Moving the clock is the only way to test "90 days" or "end of the month" without waiting
for them. The clock keeps running after it is set, so each check stands a minute either side
of the edge instead of on the exact second. Every service reads the same clock, but may see
a new setting up to a second late, so each check polls briefly.

A jump of weeks also expires every access token (they are judged by the same clock), so the
customer logs in again after each move.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from cardvault_tests.checks import expect, expect_status
from cardvault_tests.customers import log_in_again
from cardvault_tests.data import card, customer
from cardvault_tests.models import Authorization, Card
from cardvault_tests.waits import wait_until
from cardvault_tests.wallet import wallet_card

pytestmark = pytest.mark.serial

MINUTE = timedelta(minutes=1)


def move_clock_to(clock, moment: datetime) -> None:
    expect_status(clock.set_clock(now=moment.isoformat()), 200)


def reason_after_clock_move(services, someone, card_id, wanted):
    """Log in again, then poll until the enrolment service has caught up with the clock."""
    session = log_in_again(services, someone)
    view = wait_until(
        lambda: wallet_card(session, card_id),
        lambda v: v.ineligible_reason == wanted,
        timeout=5,
        what=f"reason {wanted}",
    )
    return view.ineligible_reason


def test_recent_use_means_at_most_90_days(make_customer, shared_clock, services):
    someone = make_customer(customer(card(used_days_ago=89)))
    card_id = someone.card_ids[0]
    last_used = expect(someone.cards.get(card_id), 200, Card).last_used_at
    edge = last_used + timedelta(days=90)

    move_clock_to(shared_clock, edge - MINUTE)
    assert reason_after_clock_move(services, someone, card_id, None) is None

    move_clock_to(shared_clock, edge + MINUTE)
    assert reason_after_clock_move(services, someone, card_id, "NOT_RECENTLY_USED") == (
        "NOT_RECENTLY_USED"
    )


def test_card_expires_at_midnight_utc_after_its_expiry_month(
    make_customer, shared_clock, services, card_network
):
    someone = make_customer(customer(card(expiry="2031-03")))
    card_id = someone.card_ids[0]
    edge = datetime(2031, 4, 1, tzinfo=UTC)  # first moment of the month after 2031-03

    move_clock_to(shared_clock, edge - MINUTE)
    # Not expired yet: the next rule (recent use, years ago by then) is the one that fails.
    assert reason_after_clock_move(services, someone, card_id, "NOT_RECENTLY_USED")
    approved = expect(card_network.purchase(card_id, 100), 200, Authorization)
    assert approved.decision == "APPROVED"

    move_clock_to(shared_clock, edge + MINUTE)
    assert reason_after_clock_move(services, someone, card_id, "CARD_EXPIRED") == "CARD_EXPIRED"
    declined = wait_until(
        lambda: expect(card_network.purchase(card_id, 100), 200, Authorization),
        lambda d: d.decline_code == "CARD_EXPIRED",
        timeout=5,
        what="card-service to see the card as expired",
    )
    assert declined.decision == "DECLINED"
