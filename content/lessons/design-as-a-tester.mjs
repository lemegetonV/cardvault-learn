import { figure, keyIdea, testerEye, terms, check, recap, table } from '../../src/components.mjs';
import { testLayers } from '../diagrams/testing.mjs';

export default {
  minutes: 10,
  lede: 'You now know how CardVault works, from a login to a reconciliation run. This last lesson turns that knowledge around. Every design choice you met was made to prevent something going wrong, and every one of them is therefore a test idea. Learning to read a design this way is the core skill the next two tracks build on.',
  youWill: 'You will practise turning design choices into test ideas, decide where each idea is best tested, and separate defects from documented limits.',
  body: `
<h2>Every safeguard is a claim</h2>
<p>When a design says “a repeated <code>trace_id</code> returns the stored decision”, it is making a claim: duplicates are harmless. A tester’s job is to check that claim under the conditions where it matters, which are usually the awkward ones: at the same instant, after a crash, out of order, at the boundary.</p>
${table(['Design choice', 'It prevents', 'Test idea'], [
  ['<a href="/learn/idempotency-keys/">Idempotency keys</a>', 'Double actions on retry', 'Same key twice: one effect, `Idempotent-Replayed: true`. Same key, different body: 422 `IDEMPOTENCY_KEY_REUSED`'],
  ['<a href="/learn/authorization/">Decision order</a>', 'The wrong decline reason', 'A card that fails two checks reports the earlier one'],
  ['<a href="/learn/holds-and-clearing/">Integer cents</a>', 'Rounding errors', 'Settle, reverse and refund sequences end at exact totals'],
  ['<a href="/learn/transactional-outbox/">Outbox</a>', 'Lost or false events', 'Publish failure, then recovery: every event once, in order'],
  ['<a href="/learn/consumers-and-dead-letters/">Consumer dedupe and DLQ</a>', 'Double application; a stuck partition', 'Redeliver an event: no change. Malformed event: in the DLQ, next one processed'],
  ['<a href="/learn/callbacks/">operator_version</a>', 'Old news overwriting new', 'Out-of-order callback: STALE, newer status kept'],
  ['<a href="/learn/eligibility/">Ordered eligibility rules</a>', 'Wrong reason, wrong card in the wallet', 'One card per rule; boundaries at 90 days and month end'],
  ['<a href="/learn/reconciliation/">Reconciliation</a>', 'Silent drift between bank and operator', 'One disagreement per finding type, and in-flight skipped'],
  ['<a href="/learn/lists-and-export/">Cursor paging</a>', 'Repeated or missing rows', 'Walk all pages while new purchases arrive'],
  ['<a href="/learn/browser-security/">CSRF token</a>', 'Forged requests', 'State-changing call without the header: 403, no change'],
])}
${keyIdea(`<p>For each safeguard, ask: what is it protecting against, what would I see if it failed, and how can I make that situation happen on purpose? The <a href="/learn/test-controls/">test controls</a> exist to answer the third question.</p>`)}

<h2>Where to test each idea</h2>
${figure({ svg: testLayers() })}
<p>The same rule can often be checked at several layers, but it is cheapest and clearest at the lowest one that can see it. Money arithmetic belongs at the API, where a test can send a sequence and read exact numbers. Whether an event reaches another service belongs in a cross-service test. Whether a dialog appears, or a date shows in the right time zone, can only be seen in a browser. Each layer up is slower and more fragile, so it gets fewer, more valuable tests.</p>
<p>The next track builds an API suite with <strong>pytest</strong> that covers the bottom three layers: contracts, single-service rules, and flows across services through events and callbacks. The track after it builds a <strong>Playwright</strong> suite for the browser layer.</p>

<h2>Defect or documented limit?</h2>
<p>Not every surprising behaviour is a defect. CardVault’s architecture notes list its <strong>known limitations</strong>: choices made deliberately, with the trade-off written down. Reporting one of these as a bug wastes everyone’s time; testing that the system behaves <em>exactly</em> as documented is still worthwhile.</p>
${table(['Documented limitation', 'So this is expected'], [
  ['An access token stays valid until it expires, even after logout', 'A logged-out token still works for up to 15 minutes'],
  ['Holds never expire', 'An unsettled hold stays forever'],
  ['The web session timer uses browser time', 'Moving the shared clock does not sign the browser out'],
  ['Changing the email or phone removes every wallet card', 'After re-verifying, cards return at the next sweep, opt-in or add, not at once'],
  ['A transaction can briefly lack a merchant name', 'When clearing arrives before the authorization'],
  ['The network and wallet-operator mocks keep their state in memory', 'Restarting one of them forgets what it held'],
])}
${testerEye(`<p>When you find something odd, check three sources in order: the lesson that covers the area, the API documentation, and the known limitations. If the behaviour contradicts the first two and is not in the third, you have a finding. Write it up with the rule, the evidence and the correlation ID, as <a href="/learn/faults-and-seeded-bugs/">Faults and seeded bugs</a> describes.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Safeguard', 'A design element that exists to prevent a specific failure.'],
  ['Test layer', 'The level at which a test observes the system: contract, API, cross-service or browser.'],
  ['Known limitation', 'A documented, deliberate gap or trade-off; expected behaviour, not a defect.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'You want to check that a refund can never exceed what was settled. Which layer is the best place?',
  options: ['The browser, through the transactions page', 'One service’s API: send clearing records and read the exact answer and amounts', 'Reconciliation', 'Contracts only'],
  answer: 1,
  why: '<p>It is a money rule inside the card service. An API test can drive it precisely and read exact cents; a browser test would be slower and see less.</p>',
})}
${check({
  q: 'After logging out, a test reuses the old access token and still gets `200` from `/v1/cards`. Is this a defect?',
  options: ['Yes, logout must invalidate access tokens at once', 'No: it is a documented limitation; access tokens stay valid until they expire, while the refresh token is revoked', 'Only on stage', 'Only if the clock was moved'],
  answer: 1,
  why: '<p>CardVault documents it. A useful test instead checks that the refresh token is rejected after logout, and that the access token stops working once it expires.</p>',
})}
${check({
  q: 'Which design choice is the test idea “walk all pages while new purchases arrive” aimed at?',
  options: ['Idempotency keys', 'Cursor pagination', 'The outbox', 'Advisory locks'],
  answer: 1,
  why: '<p>Cursor paging claims that new items do not shift later pages. Adding items mid-walk is exactly the condition that claim is about.</p>',
})}

<h2>Recap</h2>
${recap([
  'Every safeguard in the design is a claim, and every claim is a test idea.',
  'Make the awkward condition happen on purpose with the test controls.',
  'Test each idea at the lowest layer that can see it.',
  'Known limitations are expected behaviour; test that they match the documentation.',
  'Next: a pytest API suite, then a Playwright UI suite.',
])}
`,
};
