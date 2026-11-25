"""The daily eligibility sweep (spec 16.2 rule 5).

Events keep the wallet in step with each change, but some changes have no event: a card
reaches 90 days unused because time passed. The sweep checks every card. It enrols cards
that became eligible (a FAILED one at most once a day) and removes enrolments that are no
longer eligible. A card the customer removed is never added back.

The sweep looks at every customer's cards, so these tests are ``serial``.
"""

from __future__ import annotations

import uuid

import pytest

from cardvault_tests.checks import expect, expect_status
from cardvault_tests.data import card, customer
from cardvault_tests.models import Profile, WalletCard
from cardvault_tests.waits import wait_until
from cardvault_tests.wallet import wait_for_enrolment, wallet_card

pytestmark = pytest.mark.serial


def sweep_actions(enrolments) -> dict[str, str]:
    result = expect_status(enrolments.sweep(), 200).json()
    return {a["card_id"]: a["action"] for a in result["actions"]}


def test_the_sweep_enrols_a_card_the_bank_removed_once_it_is_eligible(make_customer, enrolments):
    someone = make_customer(customer(card(enrolled=True)))
    card_id = someone.card_ids[0]
    expect(someone.profile.patch({"email": f"{uuid.uuid4().hex[:8]}@example.test"}), 200, Profile)
    wait_for_enrolment(someone, card_id, "REMOVED")
    expect(someone.profile.verify("EMAIL", "000000"), 200, Profile)
    wait_until(  # the verified contact reaches enrollment-service by event
        lambda: wallet_card(someone, card_id),
        lambda c: c.eligible,
        timeout=10,
        what="the card to become eligible again",
    )

    actions = sweep_actions(enrolments)

    assert actions.get(str(card_id)) == "ENROL"
    wait_for_enrolment(someone, card_id, "ENROLLED")


def test_the_sweep_never_re_adds_a_card_the_customer_removed(make_customer, enrolments):
    someone = make_customer(customer(card(enrolled=True)))
    card_id = someone.card_ids[0]
    expect(someone.wallet.remove(card_id), 200, WalletCard)

    actions = sweep_actions(enrolments)

    assert str(card_id) not in actions
    assert enrolments.record(card_id)["status"] == "REMOVED"


def test_the_sweep_leaves_an_eligible_enrolled_card_alone(make_customer, enrolments):
    someone = make_customer(customer(card(enrolled=True)))

    assert str(someone.card_ids[0]) not in sweep_actions(enrolments)
