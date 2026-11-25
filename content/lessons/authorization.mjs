import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, code } from '../../src/components.mjs';
import { decisionLadder } from '../diagrams/money.mjs';

export default {
  minutes: 12,
  lede: 'When alice pays at a checkout, the card network asks the bank one question: approve or decline? The card service must answer in a fraction of a second, the same way every time, and it must never approve the same purchase twice. This lesson opens up that decision.',
  youWill: 'You will read an authorization request and response, follow the checks in order, and see what an approval changes.',
  body: `
<h2>The request</h2>
<p>The network mock calls the card service’s internal endpoint, <code>POST /internal/v1/authorizations</code>, with its own <a href="/learn/machines-calling-machines/">service key</a>. Here is a wallet purchase on alice’s credit card:</p>
${code({ lang: 'json', title: 'Authorization request (from the network)', src: `{
  "trace_id": "trc_5be1…",
  "card_id": "ca4d0000-a11c-4000-8000-000000000001",
  "token_ref": "tok_a11ce0c4ed170000000001",
  "token_requestor": "WALLET",
  "amount": 2500,
  "currency": "USD",
  "merchant_name": "Northwind Coffee",
  "mcc": "5814"
}` })}
${table(['Field', 'Means'], [
  ['`trace_id`', 'The network’s ID for this one purchase. It makes repeats recognisable.'],
  ['`token_requestor`', '`WALLET` when paid with the wallet token, `CARD` when the card itself was used.'],
  ['`token_ref`', 'The wallet token that paid. Required for `WALLET`, empty for `CARD`.'],
  ['`amount`', 'Cents, more than zero. Here $25.00.'],
  ['`mcc`', 'Merchant category code: four digits saying what kind of shop it is. 5814 is fast food.'],
  ['`merchant_name`', 'Free text from the merchant. Untrusted: it is stored and shown, never obeyed.'],
])}
<p>A malformed request, such as an amount of zero, a currency other than USD, or a <code>WALLET</code> purchase without a token, gets <code>422</code>. An unknown <code>card_id</code> gets <code>404</code>. Neither is a decline: they mean the question itself was wrong.</p>

<h2>The checks, in order</h2>
<p>For a well-formed request, the service runs a fixed list of checks. The first one that fails decides the decline code, and the rest are not checked.</p>
${figure({ svg: decisionLadder(), caption: 'The two token checks apply only when token_requestor is WALLET. A plain card purchase skips them.' })}
<p>The order is part of the contract. A lost card with too little money is declined as <code>CARD_LOST</code>, never <code>INSUFFICIENT_FUNDS</code>, because the lost check comes first. A test that expects a particular code must set up exactly one failing condition, or know the order.</p>
<p>The <code>TOKEN_INACTIVE</code> check deserves a note. The card service does not ask the enrollment service whether a token is active. It keeps its own small copy of every token’s status, updated from <code>enrollment.changed</code> events. That copy can be a moment behind, so for a short time after a token is paused, a purchase could still pass this check. CardVault documents that as a deliberate choice: fast, independent decisions in exchange for a short delay.</p>

<h2>The answer, and what changes</h2>
${code({ lang: 'json', title: 'Authorization response', src: `{
  "trace_id": "trc_5be1…",
  "card_id": "ca4d0000-a11c-4000-8000-000000000001",
  "decision": "APPROVED",
  "decline_code": null,
  "amount": 2500,
  "currency": "USD",
  "hold_id": "…",
  "decided_at": "…"
}` })}
<p>A decline is still a <code>200</code> response: the request was handled correctly, and the answer happens to be no. Only <code>decision</code> and <code>decline_code</code> differ, and <code>hold_id</code> is empty.</p>
<p>All of this happens in one database transaction, with the card row locked so two purchases on the same card cannot both spend the same money:</p>
<ul>
<li><strong>On approval:</strong> a hold for the amount is created, <code>available</code> goes down by the amount, and <code>last_used_at</code> is set to now.</li>
<li><strong>Always:</strong> the decision is stored under its <code>trace_id</code>, and an <code>auth.decided</code> event is queued for publishing.</li>
<li><strong>On approval, also:</strong> a <code>card.lifecycle</code> event with <code>CARD_USED</code>, because <code>last_used_at</code> changed.</li>
</ul>
${keyIdea(`<p>A repeated <code>trace_id</code> returns the stored decision and changes nothing. Networks do resend authorizations when they do not hear back in time, so this is a normal day, not an edge case. One purchase must never become two holds.</p>`)}

<h2>Approved does not mean paid</h2>
<p>An approval only sets money aside. The merchant has not been paid, and the amount may still change, or the purchase may be cancelled. That second stage, clearing, is the subject of <a href="/learn/holds-and-clearing/">the next lesson</a>.</p>
${testerEye(`<p>For each decline code, build the smallest setup that triggers it alone, then check four things: the response, <code>available</code> unchanged, no hold, and an <code>auth.decided</code> event with that code. For approvals, check that <code>available</code> fell by exactly the amount. Then send the same <code>trace_id</code> again and check that nothing moved.</p>`)}
${realWorld(`<p>Real authorization decisions add fraud scores, merchant category rules, country checks and velocity limits, and must answer within a strict time limit set by the network. If the bank is too slow, the network may decide on its behalf. CardVault keeps six clear rules so that every outcome is testable.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Authorization', 'The bank’s instant approve-or-decline answer to a purchase.'],
  ['Decline code', 'Why a purchase was declined, such as `CARD_LOST` or `INSUFFICIENT_FUNDS`.'],
  ['`token_requestor`', '`WALLET` for wallet-token purchases, `CARD` for plain card purchases.'],
  ['MCC', 'Merchant category code: four digits describing the kind of business.'],
  ['Hold', 'Money set aside on the card when a purchase is approved, until it clears.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A wallet purchase of $50 arrives for a card that is LOST and has $20 available. What is the decision?',
  options: ['`DECLINED / INSUFFICIENT_FUNDS`', '`DECLINED / CARD_LOST`', '`DECLINED / TOKEN_INACTIVE`', '`422`'],
  answer: 1,
  why: '<p>The checks run in a fixed order and stop at the first failure. Lost is checked first, so the money is never looked at.</p>',
})}
${check({
  q: 'A purchase is declined with `INSUFFICIENT_FUNDS`. Which of these happens?',
  options: ['A hold is created for the amount', '`last_used_at` is updated', 'An `auth.decided` event is published', 'The response status is 402'],
  answer: 2,
  why: '<p>Every decision, approved or declined, is stored and published as <code>auth.decided</code>. Only approvals create a hold and update <code>last_used_at</code>. A decline is a normal <code>200</code> response.</p>',
})}
${check({
  q: 'A plain card purchase (`token_requestor: CARD`) arrives with no `token_ref` on an active, unexpired card with enough money. Can it be declined with `TOKEN_INACTIVE`?',
  options: ['Yes, if the card is not in the wallet', 'No, the token checks are skipped for CARD purchases', 'Yes, always', 'Only on stage'],
  answer: 1,
  why: '<p>The two token checks only apply to wallet purchases. That is how a card that was never in the wallet, or was removed from it, can still be used directly.</p>',
})}

<h2>Recap</h2>
${recap([
  'The network calls `POST /internal/v1/authorizations` with a service key and a unique `trace_id`.',
  'Checks run in order: lost, closed, expired, token mismatch, token inactive, insufficient funds.',
  'Approval creates a hold, reduces `available` and sets `last_used_at`; every decision publishes `auth.decided`.',
  'A decline is a `200` answer; a malformed request is `422`; an unknown card is `404`.',
  'A repeated `trace_id` returns the stored decision and changes nothing.',
])}
`,
};
