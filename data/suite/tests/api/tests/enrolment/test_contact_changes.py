"""Contact details and the wallet (spec 6.3, 16.2 rule 7, 16.5 rule 35).

profile-service publishes ``contact.updated`` for every contact change. enrollment-service
re-checks eligibility for each of the customer's cards:

* no longer eligible (an unverified email or phone): the card is removed;
* still eligible: the operator is sent the new contact details. Every change of email or
  phone makes it unverified first, so through the API this path is hard to reach on its
  own; the removal is what a customer sees.
"""

from __future__ import annotations

import uuid

from cardvault_tests.checks import expect
from cardvault_tests.data import card, customer
from cardvault_tests.models import Profile
from cardvault_tests.waits import wait_until
from cardvault_tests.wallet import wait_for_enrolment, wallet_card


def test_a_new_unverified_email_removes_the_card(make_customer):
    someone = make_customer(customer(card(enrolled=True)))
    card_id = someone.card_ids[0]

    expect(someone.profile.patch({"email": f"{uuid.uuid4().hex[:8]}@example.test"}), 200, Profile)

    removed = wait_for_enrolment(someone, card_id, "REMOVED")
    assert removed.enrollment.status_reason == "EMAIL_NOT_VERIFIED"


def test_verifying_again_makes_the_card_eligible_but_does_not_re_add_it(make_customer):
    # Re-enrolling a card the bank removed is the daily sweep's job (rule 5), not the
    # contact change's; see test_sweep.py.
    someone = make_customer(customer(card(enrolled=True)))
    card_id = someone.card_ids[0]
    expect(someone.profile.patch({"email": f"{uuid.uuid4().hex[:8]}@example.test"}), 200, Profile)
    wait_for_enrolment(someone, card_id, "REMOVED")

    expect(someone.profile.verify("EMAIL", "000000"), 200, Profile)

    view = wait_until(
        lambda: wallet_card(someone, card_id),
        lambda c: c.eligible,
        timeout=10,
        what="the card to become eligible again",
    )
    assert view.enrollment.status == "REMOVED"
