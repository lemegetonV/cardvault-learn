"""Which cards may join the wallet, and the reason shown when one may not
(spec 6.3, 16.3 rules 17 to 20).

The rules are checked in a fixed order and the first one that fails is the reason:

    1 CARD_NOT_ACTIVE         card is LOST or CLOSED
    2 CARD_EXPIRED            past 00:00 UTC on the 1st of the month after expiry
    3 PRODUCT_NOT_SUPPORTED   PREPAID
    4 NOT_RECENTLY_USED       last used more than 90 days ago, or never
    5 CUSTOMER_OPTED_OUT      the customer opted out of the wallet
    6 CARD_REMOVED_BY_CUSTOMER
    7 EMAIL_NOT_VERIFIED
    8 PHONE_NOT_VERIFIED

Each row of the table builds a customer with exactly the conditions named, so the expected
reason comes from this order, not from the service.
"""

from __future__ import annotations

import pytest

from cardvault_tests.checks import expect
from cardvault_tests.data import ALICE, card, customer
from cardvault_tests.models import Wallet, WalletCard
from cardvault_tests.wallet import wallet_card

EXPIRED = "2020-01"

RULES = [
    # id, customer template, expected reason (None = eligible)
    ("eligible", customer(card()), None),
    ("debit-eligible", customer(card("DEBIT")), None),
    ("lost", customer(card(status="LOST")), "CARD_NOT_ACTIVE"),
    ("closed", customer(card(status="CLOSED")), "CARD_NOT_ACTIVE"),
    ("expired", customer(card(expiry=EXPIRED)), "CARD_EXPIRED"),
    ("prepaid", customer(card("PREPAID")), "PRODUCT_NOT_SUPPORTED"),
    ("used-91-days-ago", customer(card(used_days_ago=91)), "NOT_RECENTLY_USED"),
    ("never-used", customer(card(used_days_ago=None)), "NOT_RECENTLY_USED"),
    ("opted-out", customer(card(), opted_out=True), "CUSTOMER_OPTED_OUT"),
    ("email-unverified", customer(card(), email_verified=False), "EMAIL_NOT_VERIFIED"),
    ("phone-unverified", customer(card(), phone_verified=False), "PHONE_NOT_VERIFIED"),
    # Several rules fail at once: the earliest one is the reason.
    ("lost-and-expired", customer(card(status="LOST", expiry=EXPIRED)), "CARD_NOT_ACTIVE"),
    ("expired-prepaid", customer(card("PREPAID", expiry=EXPIRED)), "CARD_EXPIRED"),
    ("prepaid-unused", customer(card("PREPAID", used_days_ago=None)), "PRODUCT_NOT_SUPPORTED"),
    (
        "unused-and-opted-out",
        customer(card(used_days_ago=200), opted_out=True),
        "NOT_RECENTLY_USED",
    ),
    (
        "opted-out-and-unverified",
        customer(card(), opted_out=True, email_verified=False),
        "CUSTOMER_OPTED_OUT",
    ),
    (
        "both-contacts-unverified",
        customer(card(), email_verified=False, phone_verified=False),
        "EMAIL_NOT_VERIFIED",
    ),
]


@pytest.mark.parametrize(("template", "reason"), [r[1:] for r in RULES], ids=[r[0] for r in RULES])
def test_eligibility_and_reason(make_customer, template, reason):
    someone = make_customer(template)

    view = wallet_card(someone, someone.card_ids[0])

    assert (view.eligible, view.ineligible_reason) == (reason is None, reason)


def test_a_card_the_customer_removed_stays_out(make_customer):
    someone = make_customer(customer(card(enrolled=True)))
    card_id = someone.card_ids[0]

    expect(someone.wallet.remove(card_id), 200, WalletCard)

    view = wallet_card(someone, card_id)
    assert (view.eligible, view.ineligible_reason) == (False, "CARD_REMOVED_BY_CUSTOMER")


def test_seed_wallet_of_alice(alice):
    # Spec section 10: two enrolled cards and two ineligible ones, each with its reason.
    wallet = expect(alice.wallet.get(), 200, Wallet)
    by_last4 = {c.last4: c for c in wallet.cards}
    credit, debit, unused, prepaid = (c.last4 for c in ALICE.cards)

    assert sorted(by_last4) == sorted([credit, debit, unused, prepaid])
    assert by_last4[credit].enrollment.status == "ENROLLED"
    assert by_last4[debit].enrollment.status == "ENROLLED"
    assert by_last4[unused].ineligible_reason == "NOT_RECENTLY_USED"
    assert by_last4[prepaid].ineligible_reason == "PRODUCT_NOT_SUPPORTED"
