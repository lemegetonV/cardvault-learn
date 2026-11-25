import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, code } from '../../src/components.mjs';
import { controlMap } from '../diagrams/testing.mjs';

export default {
  minutes: 10,
  lede: 'Throughout this track you have met test-only endpoints one at a time: a clock that moves, mocks that misbehave, a call that says when nothing is in flight. This lesson gathers them in one place, because together they answer the three questions every automated test has to answer: where do I start, how do I create the situation I need, and when do I look?',
  youWill: 'You will see every test control in CardVault, what it is for, and how they combine into a repeatable test.',
  body: `
<h2>Three problems every test has</h2>
<p>A good automated test is <strong>repeatable</strong>: it gives the same result every time it runs against the same code. Three things usually get in the way.</p>
${table(['Problem', 'Example', 'CardVault’s answer'], [
  ['Unknown starting state', 'An earlier test left a card closed', 'Reset and seed'],
  ['Situations that are hard to create', 'An operator that times out; a card unused for 91 days', 'Faults, mock controls, the shared clock, helpers'],
  ['Not knowing when to look', 'The wallet updates a moment later', '`/test/quiet` and bounded polling'],
])}
${figure({ svg: controlMap() })}
<p>Every control lives under <code>/test/…</code>, exists only when the stack runs with <code>TEST_MODE=true</code>, and needs the <code>X-Test-Key</code> header. In a production build these routes would simply not exist.</p>

<h2>Starting from a known state</h2>
<p><code>POST /test/reset</code> on a service pauses its relays and consumers, empties its tables, moves its consumers past any old events, clears its faults, and resumes. <code>POST /test/seed</code> does the same and then loads the seed data: alice, bob, charlie and dana, their cards, enrolments and transactions. <code>make reset</code> does this for every service and also puts the shared clock back to real time.</p>
<p>Moving consumers to the end matters. Without it, a service could wake up after a reset and replay events from the previous test into the fresh data.</p>
<p>For a test that needs its own customer rather than the shared seed, the enrollment service offers a factory:</p>
${code({ lang: 'json', title: 'POST /test/customers on the enrollment service', src: `{
  "phone_verified": true,
  "cards": [
    { "product": "CREDIT", "used_days_ago": 5, "enrolled": true },
    { "product": "DEBIT", "used_days_ago": null }
  ]
}` })}
<p>It creates the login, the profile, the cards and, for <code>enrolled: true</code>, a token and an ENROLLED enrolment, all directly and at once. The answer contains the generated username and password, the <code>customer_id</code>, and every <code>card_id</code> and <code>token_ref</code>. Tests that each create their own customer cannot disturb each other, which is what lets them run in parallel.</p>
${keyIdea(`<p>A test should own its data. Either reset to a known seed before it runs, or create fresh data that only it uses. Relying on what an earlier test left behind is the most common cause of tests that pass alone and fail together.</p>`)}

<h2>Creating the situation</h2>
${table(['Control', 'Where', 'Creates'], [
  ['`/test/clock`', 'any service (shared)', 'Time passing: expiry, 90-day eligibility, lockouts, cooldowns. See <a href="/learn/the-shared-clock/">The shared clock</a>'],
  ['`/test/faults`', 'each service', 'Slow, failing or hanging requests, Kafka trouble. See <a href="/learn/faults-and-seeded-bugs/">Faults and seeded bugs</a>'],
  ['`/test/behaviour`', 'network mock', 'Duplicate authorizations, retries, clearing first. See <a href="/learn/network-mock/">The network mock</a>'],
  ['`/test/behaviour`', 'operator mock', 'Errors, timeouts, declined enrolments, odd callbacks. See <a href="/learn/callbacks/">Callbacks in depth</a>'],
  ['`/test/state`', 'operator mock', 'Records that disagree with the bank. See <a href="/learn/reconciliation/">Reconciliation</a>'],
  ['`/v1/test/purchases`', 'network mock', 'Purchases and their clearing'],
  ['`/internal/v1/sweep`', 'enrollment (tests service key)', 'The nightly eligibility sweep, now'],
])}
<p>Each misbehaviour control can fire for the next N requests (<code>fail_next</code>) or for a seeded random share (<code>rate</code> plus <code>seed</code>). A seeded random choice gives the same sequence every run, so even a “10% of requests fail” test is repeatable.</p>

<h2>Knowing when to look</h2>
<p>Much of CardVault is asynchronous. <code>GET /test/quiet</code> on a service answers with its <code>outbox_depth</code> (events not yet published) and <code>consumer_lag</code> (events not yet processed), and <code>quiet: true</code> when both are zero. Waiting until every involved service is quiet is a clean way to say “everything that was going to happen has happened”, before asserting that something did <em>not</em> happen.</p>
<p>Several test-only read views help with the assertions themselves: the enrollment service’s <code>GET /test/enrollments</code> shows each enrolment with its token, and <code>GET /test/enrollments/{id}/history</code> its audit trail; each mock’s <code>GET /test/state</code> shows what it holds and the calls it made.</p>
${testerEye(`<p>A typical test follows the same rhythm. Reset or create a customer. Set any clock, faults or controls. Act through the real API. Wait, either for a visible outcome with a bounded poll, or for quiet. Assert on the API answer, then on the state behind it. Finally clear what you changed, or rely on the next test’s reset.</p>`)}
${realWorld(`<p>Real systems are rarely this cooperative. Teams build similar controls themselves: service virtualisation for partners, feature-flagged test hooks, clock abstractions. CardVault shows what a fully testable design looks like, which also makes it easier to notice what is missing in a system that was not built this way.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Repeatable test', 'A test that gives the same result each time against the same code.'],
  ['Test data factory', 'An endpoint or helper that creates fresh, test-owned data, such as `POST /test/customers`.'],
  ['Quiet', 'No events waiting to be published or processed in a service.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test asserts that closing a card did NOT publish an `enrollment.changed` event for some other card. When is it safe to look?',
  options: ['Immediately after the close returns', 'After every involved service reports `quiet: true`, so anything that was going to happen has happened', 'After a fixed 1-second sleep', 'Never; absence cannot be tested'],
  answer: 1,
  why: '<p>An absence can only be asserted once nothing is in flight. <code>/test/quiet</code> gives that signal without guessing a sleep.</p>',
})}
${check({
  q: 'Two tests run in parallel, and both use alice. One reports her credit card lost while the other checks it is ENROLLED. What is the best fix?',
  options: ['Run them one at a time forever', 'Give each test its own customer with `POST /test/customers`', 'Add a longer wait', 'Reset between every assertion'],
  answer: 1,
  why: '<p>Shared data is the problem. Test-owned customers let the tests run side by side without affecting each other.</p>',
})}

<h2>Recap</h2>
${recap([
  'Test controls exist only in TEST_MODE and need `X-Test-Key`.',
  'Reset and seed give a known start; `POST /test/customers` gives test-owned data.',
  'Clock, faults and mock controls create hard situations on demand, repeatably.',
  '`/test/quiet` tells you when nothing is in flight.',
  'Test-only read views show tokens, history and mock state for assertions.',
])}
`,
};
