import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, code } from '../../src/components.mjs';
import { cardStates } from '../diagrams/money.mjs';

export default {
  minutes: 10,
  lede: 'The card service is the bank’s card master: the one place that knows every card, its status and how much can still be spent on it. This lesson looks at what a card is in CardVault, the three states it can be in, and what a customer can do to move it between them.',
  youWill: 'You will read a card as the API returns it, follow its states, and know which moves are allowed, repeated or refused.',
  body: `
<h2>A card, as the API shows it</h2>
<p>Here is alice’s credit card as <code>GET /v1/cards</code> returns it, straight after a reset.</p>
${code({ lang: 'json', title: 'One card from GET /v1/cards', src: `{
  "card_id": "ca4d0000-a11c-4000-8000-000000000001",
  "product": "CREDIT",
  "last4": "4417",
  "expiry": "2029-06",
  "status": "ACTIVE",
  "limit": 500000,
  "available": 137974,
  "currency": "USD",
  "last_used_at": "…",
  "created_at": "…"
}` })}
${table(['Field', 'Means'], [
  ['`card_id`', 'The card’s permanent ID. It never changes, even when the card gets a new number.'],
  ['`product`', '`CREDIT`, `DEBIT` or `PREPAID`. Some money rules differ by product.'],
  ['`last4`, `expiry`', 'The only parts of the card number anyone outside the card service ever sees.'],
  ['`limit`', 'For CREDIT, the credit limit. For DEBIT and PREPAID, the most the balance can reach.'],
  ['`available`', 'What can be spent right now, in cents. Approved purchases reduce it straight away.'],
  ['`last_used_at`', 'When the card last had an approved purchase. Wallet eligibility depends on it.'],
])}
<p>So alice has a $5,000.00 limit and $1,379.74 left to spend, because the seed data already includes 46 purchases on this card. The time fields are left out above because seed data sets them relative to the moment you reset: this card was last used 2 days before the reset, and her unused card 120 days before.</p>

<h2>Three states</h2>
<p>A card is always in exactly one of three states, and a customer moves it between them with three actions.</p>
${figure({ svg: cardStates(), caption: 'Reissue keeps the same card_id. Only the number, last4 and expiry change.' })}
${table(['Action', 'Endpoint', 'From', 'To', 'Event published'], [
  ['Report lost', '`POST /v1/cards/{id}/report-lost`', 'ACTIVE', 'LOST', '`CARD_LOST`'],
  ['Reissue', '`POST /v1/cards/{id}/reissue`', 'ACTIVE or LOST', 'ACTIVE', '`CARD_ACTIVATED`, then `CARD_REISSUED`'],
  ['Close', '`POST /v1/cards/{id}/close`', 'ACTIVE or LOST', 'CLOSED', '`CARD_CLOSED`'],
])}
<p>Each change publishes a <code>card.lifecycle</code> event, so other services can react. That is how the wallet learns to pause a lost card, as you will see in <a href="/learn/when-a-card-changes/">When a card changes</a>. An approved purchase also publishes <code>CARD_USED</code>, because it updates <code>last_used_at</code>.</p>

<h2>Repeating an action is safe</h2>
<p>Look at the loops in the diagram. Reporting a card lost that is already lost returns <code>200</code> with the card unchanged, and so does closing a card that is already closed. No second event is published.</p>
<p>This matters because a customer, an app or a test may send the same request twice: a double tap, a retry after a timeout. Treating “make it lost” as a goal instead of a command means a repeat cannot do harm.</p>
<p>Moves that make no sense are refused with <code>409</code> and an explanation:</p>
${code({ lang: 'json', title: 'POST /v1/cards/{id}/reissue on a CLOSED card', src: `{
  "error_code": "INVALID_STATE_TRANSITION",
  "message": "Cannot reissue a CLOSED card",
  "correlation_id": "…",
  "details": { "status": "CLOSED", "action": "reissue" }
}` })}
${keyIdea(`<p>Reissue keeps the <code>card_id</code> and changes everything a thief could have copied: the number, the last four digits and the expiry. Because the wallet and every other service refer to the card by <code>card_id</code>, the card stays in the wallet without being added again. Its wallet token is paused while the card is lost and resumes after the reissue.</p>`)}

<h2>Expiry</h2>
<p>A card with expiry <code>2029-06</code> works until the end of June 2029. In CardVault’s exact terms, it expires at 00:00 UTC on the first day of the following month, 1 July 2029. Expiry is not a fourth state: the status stays <code>ACTIVE</code>, but purchases are declined with <code>CARD_EXPIRED</code> and the wallet treats the card as ineligible.</p>
${testerEye(`<p>A state machine gives you a ready-made test plan: every action from every state. Three actions times three states is nine cases, and each has a defined answer: a move, a no-change <code>200</code>, or a <code>409</code>. Check the event too: a no-change repeat must not publish a second <code>CARD_LOST</code>.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Card master', 'The one service that owns card data. In CardVault, the card service.'],
  ['`available`', 'The amount that can be spent right now, in cents.'],
  ['State machine', 'A fixed set of states and the allowed moves between them.'],
  ['Reissue', 'Giving a card a new number and expiry while keeping its `card_id`.'],
  ['`card.lifecycle`', 'The event topic the card service publishes every card change to.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'alice reports her credit card lost, then taps “report lost” again a second later. What does the second call return?',
  options: ['`409 INVALID_STATE_TRANSITION`', '`200` with the card unchanged and no new event', '`200` and a second `CARD_LOST` event', '`404`'],
  answer: 1,
  why: '<p>Report-lost on a LOST card is a no-change success. The goal, a lost card, is already met, so nothing is written and nothing is published.</p>',
})}
${check({
  q: 'A card is reissued after being reported lost. Which of these stays the same?',
  options: ['`last4`', '`expiry`', '`card_id`', 'The full card number'],
  answer: 2,
  why: '<p>Reissue replaces everything a thief could know, and keeps the ID that every other service uses to refer to the card.</p>',
})}
${check({
  q: 'A card has expiry `2026-11`. On the shared clock it is 2026-12-01T00:00:00Z. A purchase arrives. What happens?',
  options: ['Approved: November is not over yet in some time zones', 'Declined with `CARD_EXPIRED`', 'Declined with `CARD_CLOSED`', 'The card’s status changes to EXPIRED'],
  answer: 1,
  why: '<p>The card expired at exactly 00:00 UTC on 1 December. There is no EXPIRED status: the card stays ACTIVE, but the authorization check declines it.</p>',
})}

<h2>Recap</h2>
${recap([
  'The card service is the card master; other services only ever see `last4` and `expiry`.',
  'A card is ACTIVE, LOST or CLOSED. Report-lost, reissue and close move it; CLOSED is permanent.',
  'Repeating report-lost or close is a no-change `200`; impossible moves are `409 INVALID_STATE_TRANSITION`.',
  'Reissue keeps `card_id`, so the wallet keeps the card.',
  'Expiry is checked at 00:00 UTC on the first day after the expiry month. It is not a status.',
])}
`,
};
