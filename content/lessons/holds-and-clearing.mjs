import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, code } from '../../src/components.mjs';
import { holdStates, settleDifference } from '../diagrams/money.mjs';

export default {
  minutes: 12,
  lede: 'An approved purchase is a promise, not a payment. Hours or days later, the merchant sends the final amount, or cancels, or refunds. This second stage is called clearing, and most of the money arithmetic in CardVault lives here.',
  youWill: 'You will follow a hold through settle, reverse and refund, and work out `available` after each one.',
  body: `
<h2>Why two stages?</h2>
<p>At the moment of purchase, the final amount is not always known. A restaurant adds a tip after the card is approved. A hotel approves an estimate and charges the real bill at checkout. A shop may cancel an order before sending it. So the bank first sets money aside, a <strong>hold</strong>, and later applies the final outcome. You met the two stages in <a href="/learn/payments-in-plain-words/">Cards, wallets and payments in plain words</a>; here is how CardVault implements them.</p>

<h2>Three kinds of clearing record</h2>
<p>The network sends clearing records to <code>POST /internal/v1/clearing</code>. Each one names the authorization by its <code>trace_id</code>, has its own unique <code>clearing_id</code>, and is one of three types.</p>
${figure({ svg: holdStates() })}
${table(['Type', 'Means', 'Effect on available'], [
  ['`SETTLE`', 'The purchase is final, at this amount', 'The hold is released and the settled amount is charged instead'],
  ['`REVERSE`', 'Cancel all or part of an unsettled purchase', 'Goes up by the reversed amount'],
  ['`REFUND`', 'Give back money after settlement', 'Goes up by the refund'],
])}

<h2>Settling for a different amount</h2>
<p>Settlement replaces the hold with the real charge. If the amounts differ, <code>available</code> is corrected by the difference.</p>
${figure({ svg: settleDifference(), caption: 'available += hold − settled amount. Here 25000 − 24000 = 1000 cents comes back.' })}
<p>Settling for <em>more</em> than the hold is allowed only on a CREDIT card, where <code>available</code> may then go below zero. A DEBIT or PREPAID card answers <code>422 OVER_SETTLE_NOT_ALLOWED</code>, because there is no credit to go into.</p>

<h2>A worked example</h2>
<p>Here is one purchase on a credit card with $1,000.00 available, step by step. Every amount is in cents, as the API uses them.</p>
${table(['Step', 'Hold', 'Charged', 'Available'], [
  ['Start', '–', '–', '100000'],
  ['Authorize 25000, approved', '25000 ACTIVE', '0', '75000'],
  ['REVERSE 5000 (one item cancelled)', '20000 ACTIVE', '0', '80000'],
  ['SETTLE 20000', '0 SETTLED', '20000', '80000'],
  ['REFUND 8000', '0 SETTLED', '20000, of which 8000 refunded', '88000'],
  ['REFUND 15000', 'refused: only 12000 is left to refund', '', '88000'],
])}
<p>Each clearing response returns all of these numbers, including <code>hold_amount</code>, <code>cleared_amount</code>, <code>reversed_amount</code>, <code>refunded_amount</code> and the card’s new <code>available</code>, so a test can check the arithmetic from one response.</p>
${keyIdea(`<p>Every amount is a whole number of cents, and every step is plain integer addition and subtraction. There is no rounding anywhere. If a test ever sees an amount that is one cent off, that is a real defect, not a rounding detail.</p>`)}

<h2>What clearing refuses</h2>
<p>Most of the interesting rules are about what cannot happen. Each refusal has its own code.</p>
${table(['Attempt', 'Answer'], [
  ['A second SETTLE for the same purchase', '`409 ALREADY_SETTLED`'],
  ['REVERSE after SETTLE (use REFUND instead)', '`409 ALREADY_SETTLED`'],
  ['SETTLE or REVERSE after the hold was fully reversed', '`409 HOLD_RELEASED`'],
  ['REVERSE more than is held', '`422 AMOUNT_EXCEEDS_HOLD`'],
  ['REFUND before SETTLE', '`409 NOT_SETTLED`'],
  ['REFUND more than is left to refund', '`422 REFUND_EXCEEDS_CLEARED`'],
  ['Over-settle on DEBIT or PREPAID', '`422 OVER_SETTLE_NOT_ALLOWED`'],
  ['A `trace_id` with no authorization', '`404 TRACE_NOT_FOUND`'],
  ['Clearing a declined authorization', '`409 AUTH_DECLINED`'],
  ['A repeated `clearing_id`, same body', 'The original result, replayed'],
  ['A repeated `clearing_id`, different body', '`422 CLEARING_ID_REUSED`'],
])}
<p>One more limit for DEBIT and PREPAID: a refund can never raise <code>available</code> above the card’s <code>limit</code>. On those products the limit is the most the balance can hold.</p>

<h2>After clearing</h2>
<p>Every successful clearing record publishes a <code>txn.cleared</code> event. The wallet-txn service uses it, together with <code>auth.decided</code>, to build the customer’s transaction history, as <a href="/learn/record-from-events/">A record built from events</a> explains.</p>
${testerEye(`<p>Clearing is arithmetic with rules, which makes it ideal for table-driven tests: a starting state, a sequence of records, and the expected <code>available</code>, hold and status after each one. Include every refusal in the table above, the CREDIT over-settle that goes negative, and a refund that would push a DEBIT card above its limit.</p>`)}
${realWorld(`<p>Real holds expire if no clearing arrives, typically after some days, and the money goes back automatically. CardVault’s holds never expire. That is a stated limitation of this build, not an oversight to report.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Clearing', 'The second stage of a card payment, when the final outcome of a purchase arrives.'],
  ['Settle', 'Turn a hold into a real charge, at the final amount.'],
  ['Reverse', 'Cancel all or part of an unsettled hold.'],
  ['Refund', 'Return money after settlement, up to what was charged.'],
  ['`clearing_id`', 'The unique ID of one clearing record. A repeat is recognised and replayed.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A CREDIT card has 50000 available. A purchase of 10000 is approved, then settled at 12000 (a tip was added). What is `available` now?',
  options: ['40000', '38000', '50000', '42000'],
  answer: 1,
  why: '<p>Approval: 50000 − 10000 = 40000. Settle: release the 10000 hold and charge 12000, so 40000 + 10000 − 12000 = 38000.</p>',
})}
${check({
  q: 'A purchase was settled at 20000 and already refunded 5000. The network sends REFUND 16000. What happens?',
  options: ['Refunded; available goes up 16000', 'Refused with 422, because only 15000 is left to refund', 'Refused with 409 NOT_SETTLED', 'Refunded, but capped at 15000'],
  answer: 1,
  why: '<p>A refund is capped at the cleared amount minus what was already refunded: 20000 − 5000 = 15000. A larger refund is refused, not trimmed.</p>',
})}
${check({
  q: 'A purchase on a DEBIT card was approved for 3000. The network sends SETTLE 3500. What happens?',
  options: ['Settled at 3500; available may go negative', '`422 OVER_SETTLE_NOT_ALLOWED`', '`409 ALREADY_SETTLED`', 'Settled at 3000'],
  answer: 1,
  why: '<p>Only CREDIT cards may settle above the hold. A DEBIT card has no credit to go into, so the over-settle is refused.</p>',
})}

<h2>Recap</h2>
${recap([
  'Approval creates a hold; clearing later settles, reverses or refunds it.',
  'Settling at a different amount corrects `available` by hold minus settled amount.',
  'Only CREDIT may over-settle; refunds are capped at what is left to refund.',
  'Every refusal has a code; a repeated `clearing_id` replays, a changed one is `422`.',
  'All money is whole cents, and every clearing publishes `txn.cleared`.',
])}
`,
};
