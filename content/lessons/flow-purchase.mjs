import { sequence, interview, table, keyIdea, shot, testerEye, tryIt } from '../../src/components.mjs';

export default {
  minutes: 9,
  lede: 'A purchase is where the money moves. This lesson follows one wallet payment from the shop’s checkout to the customer’s transactions list, and explains the two stages every card payment goes through: approval and settlement.',
  youWill: 'You will be able to explain how a purchase is approved, held, settled and recorded.',
  body: `
<h2>Two stages: approve now, charge later</h2>
<p>When you pay by card, the money does not leave your account at once. First the bank <strong>authorises</strong> the purchase: it says yes or no in a fraction of a second and puts the amount aside. This set-aside money is called a <strong>hold</strong>. Days later the shop’s payment is finalised and the bank <strong>settles</strong> it: the hold turns into a real charge, sometimes for a slightly different amount.</p>
<p>That is why a card shows an <strong>available</strong> amount separate from its limit. Available is the limit minus everything that is held or charged.</p>

<h2>One purchase, step by step</h2>
${sequence({
  id: 'purchase-flow',
  label: 'A wallet purchase from the shop to the transactions list',
  actors: [
    { id: 'n', label: 'Card network', kind: 'mock' },
    { id: 'c', label: 'Cards', kind: 'bank' },
    { id: 'k', label: 'Message bus', kind: 'event' },
    { id: 't', label: 'Transactions', kind: 'bank' },
    { id: 'b', label: 'Customer (web)', kind: 'plain' },
  ],
  steps: [
    { from: 'n', to: 'c', label: 'approve $25.00?', note: 'alice pays $25.00 at a shop with a wallet card. The card network asks the bank’s Cards service to approve it.' },
    { from: 'c', to: 'c', label: 'check card and money', kind: 'self', note: 'Cards checks that the wallet card is enrolled, the card is active, and $25.00 is within the available amount.' },
    { from: 'c', to: 'c', label: 'hold $25.00', kind: 'self', note: 'It records the decision and a $25.00 hold, so available goes down by $25.00, all in one database transaction.' },
    { from: 'c', to: 'n', label: 'APPROVED', kind: 'reply', note: 'Cards answers APPROVED (or DECLINED with a reason such as `INSUFFICIENT_FUNDS` or `CARD_LOST`).' },
    { from: 'c', to: 'k', label: 'event: purchase decided', kind: 'event', note: 'Cards announces the decision on the message bus.' },
    { from: 'k', to: 't', label: 'event delivered', kind: 'event', note: 'Transactions picks up the event and adds the purchase to alice’s list with status **AUTHORIZED**.' },
    { from: 'n', to: 'c', label: 'settle $25.00', note: 'Later, the card network sends the final amount. This is settlement.' },
    { from: 'c', to: 'k', label: 'event: purchase settled', kind: 'event', note: 'Cards turns the hold into a charge and announces it.' },
    { from: 'k', to: 't', label: 'event delivered', kind: 'event', note: 'Transactions updates the same purchase to **SETTLED**.' },
    { from: 'b', to: 't', label: 'show my transactions', note: 'When alice opens Transactions, she sees the purchase with its current status.' },
  ],
  caption: 'Gold arrows are events on the message bus. Approval is a direct call because the shop is waiting for the answer.',
})}

${keyIdea('<p>Cards decides and holds the money. Transactions keeps the customer’s record. The record is built from events, so it catches up a moment after each decision.</p>')}

<h2>What can happen to a purchase</h2>
<p>After approval, a few things can happen before or after settlement. Each one changes the money and the status you saw on the Transactions screen:</p>
${table(['What happens', 'Effect on the money', 'Status'], [
  ['The bank says no', 'Nothing is held.', 'DECLINED'],
  ['Approved, not settled yet', 'The amount is held.', 'AUTHORIZED'],
  ['Settled', 'The hold becomes a charge for the final amount.', 'SETTLED'],
  ['The shop cancels before settling', 'The hold is released, fully or partly.', 'REVERSED or PARTIALLY_REVERSED'],
  ['Money given back after settling', 'Some or all of the charge comes back.', 'REFUNDED or PARTIALLY_REFUNDED'],
])}
<p>Money is always stored as whole cents in the API: $25.00 is <code>2500</code>. That avoids rounding errors, and you will see it in every API response.</p>

<h2>See it on the live app</h2>
${shot({ src: 'transactions.png', alt: 'The Wallet transactions screen with card, status and date filters and a list of purchases.', caption: 'Step 10 of the flow: what alice sees. Every row is a record that Transactions built from events.' })}
<p>Purchases come from the card network, and on CardVault the network is a simulator that only the test tools can drive. So the panel below does not make a purchase. It reads the results the flow leaves behind: the money on the card, and alice’s records in each status.</p>
${tryIt({ title: 'Try it: follow the money', requests: [
  { label: 'Sign alice in', method: 'POST', service: 'auth', path: '/v1/auth/login', body: { username: 'alice', password: 'CardVault-Demo-1' } },
  { label: 'Card 4417: limit and available', note: 'Both in cents. `limit` minus `available` is everything held or charged on the card right now.', method: 'GET', service: 'cards', path: '/v1/cards/ca4d0000-a11c-4000-8000-000000000001', headers: { Authorization: 'Bearer {{token}}' } },
  { label: 'Purchases approved but not settled yet', note: 'Status `AUTHORIZED`: `amount` is held, `cleared_amount` is still `0`, and `settled_at` is `null`.', method: 'GET', service: 'transactions', path: '/v1/wallet/transactions?status=AUTHORIZED&limit=3', headers: { Authorization: 'Bearer {{token}}' } },
  { label: 'Settled purchases', note: 'Status `SETTLED`: `cleared_amount` is the final charge and `settled_at` has a time.', method: 'GET', service: 'transactions', path: '/v1/wallet/transactions?status=SETTLED&limit=3', headers: { Authorization: 'Bearer {{token}}' } },
  { label: 'Declined purchases', note: 'Status `DECLINED` with a `decline_code` such as `INSUFFICIENT_FUNDS`. Nothing was held.', method: 'GET', service: 'transactions', path: '/v1/wallet/transactions?status=DECLINED&limit=3', headers: { Authorization: 'Bearer {{token}}' } },
  { label: 'One purchase in detail', note: 'The Northwind Coffee purchase from the first list. `trace_id` is the card network’s reference: the same value links the decision in Cards to this record.', method: 'GET', service: 'transactions', path: '/v1/wallet/transactions/7a000000-0000-4000-8000-000000000007', headers: { Authorization: 'Bearer {{token}}' } },
] })}
<p>Look at the shop names in the settled list: one tries to give orders (“IGNORE PREVIOUS INSTRUCTIONS…”), one contains HTML and one starts like a spreadsheet formula. They are planted test data, there to check that the screens and the CSV export treat them as plain text.</p>

${testerEye(`<p>Purchases are where money bugs hide, so this is where testers spend time:</p>
<ul>
<li>After an approval, available goes down by exactly the amount. After a decline, it does not change at all.</li>
<li>Boundaries: a purchase of exactly the available amount is approved, one cent more is declined.</li>
<li>A lost card is declined with <code>CARD_LOST</code>.</li>
<li>The purchase appears in Transactions a moment later, so the test waits for it.</li>
</ul>`)}

${interview({
  say: `<p>“A wallet purchase comes in from the card network to the card service, which checks the card and the available balance, places a hold, and returns approved or declined. It publishes an event, and the transactions service consumes it to build the customer’s history.</p>
<p>Settlement comes later from the network: the hold turns into a charge and another event updates the transaction to settled. Amounts are integer cents. Our tests check the decision, the available balance before and after, boundaries such as exactly the available amount, and then wait for the transaction to appear in the history.”</p>`,
  qa: [
    ['What is the difference between authorisation and settlement?', '<p>Authorisation is the instant yes or no, which puts a hold on the money. Settlement is the final charge, usually days later, and it can be for a different amount, for example a fuel purchase or a tip.</p>'],
    ['Why store money as cents instead of decimals?', '<p>Decimal fractions such as 0.1 cannot be stored exactly as floating-point numbers, so sums drift by tiny amounts. Whole cents are exact.</p>'],
    ['What would you check if a customer says their available balance is wrong?', '<p>List the card’s purchases and work it out by hand: limit, minus holds, minus settled charges, plus anything reversed or refunded. Then compare it with what the Cards service returns, and check whether any purchase is stuck in the wrong status.</p>'],
  ],
})}
`,
};
