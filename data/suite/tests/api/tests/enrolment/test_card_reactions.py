"""The wallet follows the card (spec 6.3, 16.2 rules 9 to 11).

card-service publishes ``card.lifecycle`` when a card changes. enrollment-service reacts
by asking the operator to change the token, and the new status arrives by callback:

    report lost --> SUSPEND pushed --> callback --> SUSPENDED (reason CARD_LOST)
    reissue     --> RESUME + UPDATE --> callback --> ENROLLED with the new last4
    close       --> REMOVE pushed  --> callback --> REMOVED (reason CARD_CLOSED)
"""

from __future__ import annotations

from cardvault_tests.checks import expect
from cardvault_tests.data import card, customer
from cardvault_tests.models import Card
from cardvault_tests.waits import wait_until
from cardvault_tests.wallet import wait_for_enrolment


def test_a_lost_card_is_suspended(make_customer):
    someone = make_customer(customer(card(enrolled=True)))
    card_id = someone.card_ids[0]

    expect(someone.cards.report_lost(card_id), 200, Card)

    suspended = wait_for_enrolment(someone, card_id, "SUSPENDED")
    assert suspended.enrollment.status_reason == "CARD_LOST"


def test_reissuing_a_lost_card_resumes_it_with_the_new_number(make_customer, operator_records):
    someone = make_customer(customer(card(enrolled=True)))
    card_id = someone.card_ids[0]
    expect(someone.cards.report_lost(card_id), 200, Card)
    wait_for_enrolment(someone, card_id, "SUSPENDED")

    new = expect(someone.cards.reissue(card_id), 200, Card)

    resumed = wait_until(
        lambda: wait_for_enrolment(someone, card_id, "ENROLLED"),
        lambda c: (c.enrollment.last4, c.enrollment.expiry) == (new.last4, new.expiry),
        timeout=20,
        what="the enrolment to carry the reissued card's last4 and expiry",
    )
    assert resumed.enrollment.status_reason is None
    # The operator's own copy must match too, or the customer's wallet shows the old card.
    held = operator_records(resumed.enrollment.enrollment_id)
    assert (held["status"], held["last4"], held["expiry"]) == ("ENROLLED", new.last4, new.expiry)


def test_a_closed_card_is_removed(make_customer):
    someone = make_customer(customer(card(enrolled=True)))
    card_id = someone.card_ids[0]

    expect(someone.cards.close(card_id), 200, Card)

    removed = wait_for_enrolment(someone, card_id, "REMOVED")
    assert removed.enrollment.status_reason == "CARD_CLOSED"
    assert removed.eligible is False


def test_closing_a_suspended_card_removes_it(make_customer):
    someone = make_customer(customer(card(enrolled=True)))
    card_id = someone.card_ids[0]
    expect(someone.cards.report_lost(card_id), 200, Card)
    wait_for_enrolment(someone, card_id, "SUSPENDED")

    expect(someone.cards.close(card_id), 200, Card)

    assert wait_for_enrolment(someone, card_id, "REMOVED").enrollment.status_reason == (
        "CARD_CLOSED"
    )
