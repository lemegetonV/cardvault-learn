"""Many requests at the same moment (spec 6.2, 16.4).

Money rules that hold for one request at a time can break when requests overlap: two
purchases both read "available = 10.00" and both approve. These tests fire requests from
several threads at once and check the totals afterwards. They cannot prove there is no race
(an unlucky schedule might not happen), but a broken lock shows up here quickly.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

import pytest

from cardvault_tests.checks import expect
from cardvault_tests.clients.card_network import new_trace_id
from cardvault_tests.data import card, customer
from cardvault_tests.models import Authorization, Card

WORKERS = 10


def run_together(calls):
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        return list(pool.map(lambda call: call(), calls))


@pytest.mark.lesson
@pytest.mark.parametrize("product", ["DEBIT", "CREDIT"])
def test_parallel_purchases_never_spend_more_than_available(make_customer, card_network, product):
    someone = make_customer(customer(card(product, limit=10_000)))
    card_id = someone.card_ids[0]

    responses = run_together([lambda: card_network.purchase(card_id, 1_000)] * 20)

    decisions = [expect(r, 200, Authorization) for r in responses]
    approved = [d for d in decisions if d.decision == "APPROVED"]
    declined = [d for d in decisions if d.decision == "DECLINED"]
    assert len(approved) == 10, "exactly 10 x 10.00 fit into 100.00"
    assert {d.decline_code for d in declined} == {"INSUFFICIENT_FUNDS"}
    assert expect(someone.cards.get(card_id), 200, Card).available == 0


def test_parallel_duplicates_of_one_trace_hold_once(make_customer, card_network):
    someone = make_customer(customer(card(limit=10_000)))
    card_id = someone.card_ids[0]
    trace_id = new_trace_id()

    responses = run_together(
        [lambda: card_network.purchase(card_id, 1_000, trace_id=trace_id)] * WORKERS
    )

    decisions = [expect(r, 200, Authorization) for r in responses]
    assert len({(d.decision, d.hold_id) for d in decisions}) == 1, "every copy, one answer"
    assert expect(someone.cards.get(card_id), 200, Card).available == 9_000


def test_parallel_settles_of_one_trace_settle_once(make_customer, card_network):
    someone = make_customer(customer(card(limit=10_000)))
    card_id = someone.card_ids[0]
    trace_id = expect(card_network.purchase(card_id, 1_000), 200, Authorization).trace_id

    responses = run_together([lambda: card_network.settle(trace_id, 1_000)] * WORKERS)

    codes = sorted(r.status_code for r in responses)
    assert codes == [200] + [409] * (WORKERS - 1)
    assert {r.json()["error_code"] for r in responses if r.status_code == 409} == {
        "ALREADY_SETTLED"
    }
    assert expect(someone.cards.get(card_id), 200, Card).available == 9_000


def test_parallel_retries_with_one_idempotency_key_act_once(make_customer):
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]
    key = f"idem-parallel-{card_id}"

    responses = run_together([lambda: someone.cards.reissue(card_id, key)] * WORKERS)

    # Each copy either gets the stored answer, or is told the first is still running.
    done = [r for r in responses if r.status_code == 200]
    busy = [r for r in responses if r.status_code == 409]
    assert len(done) + len(busy) == WORKERS
    assert done, "at least one copy completes"
    assert len({r.content for r in done}) == 1
    assert {r.json()["error_code"] for r in busy} <= {"IDEMPOTENCY_IN_PROGRESS"}
    assert expect(someone.cards.get(card_id), 200, Card) == Card.model_validate(done[0].json())
