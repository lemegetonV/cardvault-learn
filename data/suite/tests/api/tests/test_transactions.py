"""Transactions: the customer's record of wallet purchases (wallet-txn-service)."""

import pytest

from api.card_network_api import CardNetworkApi
from api.transactions_api import TransactionsApi
from helpers import wait_for_transactions


@pytest.mark.smoke
def test_a_purchase_appears_in_the_transactions_list(customer):
    card = customer["wallet_card"]
    CardNetworkApi().make_purchase(card["token_ref"], amount=2500, merchant_name="Northwind Coffee")

    # The purchase arrives through an event, so wait for it instead of checking once.
    transactions = wait_for_transactions(TransactionsApi(customer["token"]), count=1)

    newest = transactions[0]
    assert newest["merchant_name"] == "Northwind Coffee"
    assert newest["amount"] == 2500
    assert newest["status"] == "AUTHORIZED"
    assert newest["card_id"] == card["card_id"]


def test_a_settled_purchase_shows_as_settled(customer):
    card = customer["wallet_card"]
    network = CardNetworkApi()
    purchase = network.make_purchase(card["token_ref"], amount=1200).json()
    network.settle(purchase["trace_id"])

    settled = wait_for_transactions(TransactionsApi(customer["token"]), count=1, status="SETTLED")

    assert len(settled) == 1
    assert settled[0]["cleared_amount"] == 1200


def test_a_new_customer_has_no_transactions(customer):
    response = TransactionsApi(customer["token"]).list_transactions()

    assert response.status_code == 200
    assert response.json()["items"] == []


def test_the_detail_of_one_transaction(customer):
    card = customer["wallet_card"]
    CardNetworkApi().make_purchase(card["token_ref"], amount=999)
    transactions_api = TransactionsApi(customer["token"])
    txn_id = wait_for_transactions(transactions_api, count=1)[0]["txn_id"]

    response = transactions_api.get_transaction(txn_id)

    assert response.status_code == 200
    assert response.json()["txn_id"] == txn_id
    assert response.json()["amount"] == 999


def test_the_csv_export_lists_the_purchase(customer):
    card = customer["wallet_card"]
    CardNetworkApi().make_purchase(card["token_ref"], amount=4200, merchant_name="Contoso Books")
    transactions_api = TransactionsApi(customer["token"])
    wait_for_transactions(transactions_api, count=1)

    response = transactions_api.export_csv()

    assert response.status_code == 200
    assert response.headers["Content-Type"].startswith("text/csv")
    lines = response.text.strip().split("\n")
    assert lines[0].startswith("txn_id,")  # the header row
    assert len(lines) == 2  # the header plus one purchase
    assert "Contoso Books" in lines[1]
    assert "42.00" in lines[1]  # the CSV shows dollars, the API shows cents


def test_open_a_dispute(customer):
    card = customer["wallet_card"]
    CardNetworkApi().make_purchase(card["token_ref"], amount=3000)
    transactions_api = TransactionsApi(customer["token"])
    txn_id = wait_for_transactions(transactions_api, count=1)[0]["txn_id"]

    response = transactions_api.open_dispute(txn_id, reason="UNRECOGNISED", note="I was not there")

    assert response.status_code == 201
    assert response.json()["status"] == "OPEN"
    # The transaction now points at its open dispute.
    assert transactions_api.get_transaction(txn_id).json()["open_dispute_id"] is not None


def test_only_one_open_dispute_per_transaction(customer):
    card = customer["wallet_card"]
    CardNetworkApi().make_purchase(card["token_ref"], amount=3000)
    transactions_api = TransactionsApi(customer["token"])
    txn_id = wait_for_transactions(transactions_api, count=1)[0]["txn_id"]
    transactions_api.open_dispute(txn_id, reason="UNRECOGNISED")

    response = transactions_api.open_dispute(txn_id, reason="DUPLICATE")

    assert response.status_code == 409
    assert response.json()["error_code"] == "DISPUTE_ALREADY_OPEN"


def test_a_declined_purchase_cannot_be_disputed(customer):
    card = customer["wallet_card"]
    # Far above the card's limit, so the bank declines it.
    CardNetworkApi().make_purchase(card["token_ref"], amount=99_999_999)
    transactions_api = TransactionsApi(customer["token"])
    transaction = wait_for_transactions(transactions_api, count=1)[0]
    assert transaction["status"] == "DECLINED"

    response = transactions_api.open_dispute(transaction["txn_id"], reason="UNRECOGNISED")

    assert response.status_code == 422
    assert response.json()["error_code"] == "TRANSACTION_NOT_DISPUTABLE"


def test_a_dispute_needs_a_valid_reason(customer):
    card = customer["wallet_card"]
    CardNetworkApi().make_purchase(card["token_ref"], amount=3000)
    transactions_api = TransactionsApi(customer["token"])
    txn_id = wait_for_transactions(transactions_api, count=1)[0]["txn_id"]

    response = transactions_api.open_dispute(txn_id, reason="I_DO_NOT_LIKE_IT")

    assert response.status_code == 422
    assert response.json()["error_code"] == "VALIDATION_ERROR"
