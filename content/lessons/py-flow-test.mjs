import { code, interview, keyIdea, testerEye, sequence } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'Some of the most valuable tests follow one piece of work across several services: a purchase that holds money in one service and appears in another a moment later. These flow tests need one extra skill, waiting for a result that is not there yet. This lesson reads two of them.',
  youWill: 'You will be able to explain a cross-service flow test, why it must wait, and how the suite waits without fixed sleeps.',
  body: `
<h2>One action, several services</h2>
<p>In <a href="/learn/flow-purchase/">Flow: a purchase</a> you saw that the Cards service approves a purchase, then announces it as an event. The Transactions service hears the event and adds the purchase to the customer’s history. The customer, and the test, cannot see that second step happen. It simply arrives a moment later.</p>

${sequence({
  id: 'flow-test',
  label: 'What the purchase flow test does',
  actors: [
    { id: 't', label: 'test', kind: 'plain' },
    { id: 'n', label: 'card network', kind: 'mock' },
    { id: 'c', label: 'Cards', kind: 'bank' },
    { id: 'x', label: 'Transactions', kind: 'bank' },
  ],
  steps: [
    { from: 't', to: 'n', label: 'make purchase', note: 'The test asks the card network simulator to pay $25.00 at Northwind Coffee.' },
    { from: 'n', to: 'c', label: 'approve?', note: 'The network asks the bank, as a real one would.' },
    { from: 'c', to: 'n', label: 'APPROVED', kind: 'reply', note: 'Cards approves and holds the money.' },
    { from: 'c', to: 'x', label: 'event', kind: 'event', note: 'Cards announces the decision. Transactions picks it up a moment later, on its own schedule.' },
    { from: 't', to: 'x', label: 'list (again...)', note: 'The test asks for the transactions list every half second until the purchase is there.' },
    { from: 'x', to: 't', label: '1 transaction', kind: 'reply', note: 'Then it checks the merchant, amount, status and card.' },
  ],
  caption: 'The event between the two services is invisible to the test, so the test asks again until the result appears.',
})}

<h2>The test</h2>
${code({ title: 'tests/api/tests/test_transactions.py', src: `
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
` })}
<p>Each check ties the transaction back to what the test did: the merchant name it chose, the amount it paid, the card it used. <code>AUTHORIZED</code> means approved but not yet final.</p>

<h2>How the waiting works</h2>
${code({ title: 'tests/api/helpers.py', src: `
def wait_for_transactions(transactions_api, count, status=None, timeout=10):
...
    deadline = time.time() + timeout
    items = []
    while time.time() < deadline:
        items = transactions_api.list_transactions(status=status).json()["items"]
        if len(items) >= count:
            return items
        time.sleep(0.5)
    raise AssertionError(f"Found {len(items)} transactions, expected {count} within {timeout}s")
` })}
<ul>
<li><code>time.time()</code> is the current time in seconds, so <code>deadline</code> is ten seconds from now.</li>
<li><code>while</code> repeats its block as long as the condition is true.</li>
<li>If enough transactions are there, <code>return</code> hands them back at once, often on the first or second try.</li>
<li>If not, it pauses half a second and asks again. After ten seconds it gives up with a clear message. <code>raise</code> stops the test with that error.</li>
</ul>
<p>This is called <strong>polling</strong>. Compare it with a fixed <code>time.sleep(5)</code>: that wastes five seconds when the result takes 0.2, and still fails on a slow day when it takes 6.</p>

<h2>A longer flow: settle, then check</h2>
${code({ title: 'tests/api/tests/test_transactions.py', src: `
def test_a_settled_purchase_shows_as_settled(customer):
    card = customer["wallet_card"]
    network = CardNetworkApi()
    purchase = network.make_purchase(card["token_ref"], amount=1200).json()
    network.settle(purchase["trace_id"])

    settled = wait_for_transactions(TransactionsApi(customer["token"]), count=1, status="SETTLED")

    assert len(settled) == 1
    assert settled[0]["cleared_amount"] == 1200
` })}
<p>Two steps of real business happen before the check: the purchase, then settlement, when the shop is paid. The <code>trace_id</code> from the first answer links them. The wait asks only for <code>SETTLED</code> transactions, so it keeps polling until the second event has arrived too.</p>

<h2>Other flows in the suite</h2>
<ul>
<li>Reporting a card lost in Cards pauses it in the Wallet: the test waits for <code>SUSPENDED</code>.</li>
<li>Changing an email in Profile takes the customer’s cards out of the Wallet: the test waits for <code>REMOVED</code>.</li>
<li>Adding a card to the wallet returns <code>PENDING</code>, and the test waits for <code>ENROLLED</code>, when the wallet company confirms.</li>
</ul>

${keyIdea('<p>A flow test follows one piece of work across services. Where a result arrives later, poll for it with a deadline. Never sleep for a fixed time.</p>')}

${testerEye('<p>Flow tests find the bugs that single-service tests miss: a lost event, a wrong field mapped between services, a status that never updates. Keep a few for the most important journeys, because they are slower and have more reasons to fail.</p>')}

${interview({
  say: `<p>“Besides single-endpoint tests I have flow tests across services. For example a purchase is approved by the card service and appears in the transactions service through an event, so the test polls the transactions list with a ten-second deadline instead of sleeping. Another flow reports a card lost and waits for the wallet to suspend it.”</p>`,
  qa: [
    ['How do you test something asynchronous?', '<p>Trigger it, then poll the place where the result shows up, with a short interval and a firm deadline, and fail with a clear message if it never arrives.</p>'],
    ['Why not just use time.sleep?', '<p>A fixed sleep is either too long, which slows every run, or too short on a slow day, which makes the test flaky. Polling returns as soon as the result is there.</p>'],
    ['What would you check in an end-to-end API flow?', '<p>That each step’s output feeds the next, that the data matches what the test created, and the final business state, such as the settled amount.</p>'],
  ],
})}
`,
};
