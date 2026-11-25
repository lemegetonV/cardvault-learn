"""Leaving the wallet and coming back (spec 6.3, 16.2 rules 8, 12 and 16)."""

from __future__ import annotations

from cardvault_tests.checks import expect, expect_error
from cardvault_tests.data import card, customer
from cardvault_tests.models import Wallet, WalletCard
from cardvault_tests.wallet import wait_for_enrolment


def test_opt_out_removes_every_card_at_once(make_customer):
    someone = make_customer(customer(card(enrolled=True), card("DEBIT", enrolled=True)))

    wallet = expect(someone.wallet.opt_out(), 200, Wallet)

    assert wallet.opted_out is True
    assert [c.enrollment.status for c in wallet.cards] == ["REMOVED", "REMOVED"]
    assert {c.ineligible_reason for c in wallet.cards} == {"CUSTOMER_OPTED_OUT"}


def test_opting_out_twice_changes_nothing(make_customer):
    someone = make_customer(customer(card(enrolled=True)))
    first = expect(someone.wallet.opt_out(), 200, Wallet)

    again = expect(someone.wallet.opt_out(), 200, Wallet)

    assert again == first


def test_opt_in_re_enrols_every_eligible_card(make_customer):
    someone = make_customer(
        customer(card(enrolled=True), card("DEBIT", enrolled=True), card("PREPAID"))
    )
    expect(someone.wallet.opt_out(), 200, Wallet)

    wallet = expect(someone.wallet.opt_in("2026-06"), 200, Wallet)

    assert wallet.opted_out is False
    assert wallet.terms_version == "2026-06"
    credit, debit, prepaid = someone.card_ids
    for card_id in (credit, debit):
        wait_for_enrolment(someone, card_id, "ENROLLED")
    prepaid_view = expect(someone.wallet.card(prepaid), 200, WalletCard)
    assert prepaid_view.enrollment is None  # never eligible, never enrolled


def test_opt_in_needs_the_terms_version(make_customer):
    someone = make_customer(customer(card(), opted_out=True))

    expect_error(someone.wallet.opt_in(terms_version=None), 422, "VALIDATION_ERROR")


def test_opt_in_clears_a_cards_earlier_removal(make_customer):
    someone = make_customer(customer(card(enrolled=True)))
    card_id = someone.card_ids[0]
    expect(someone.wallet.remove(card_id), 200, WalletCard)

    expect(someone.wallet.opt_in(), 200, Wallet)

    wait_for_enrolment(someone, card_id, "ENROLLED")
