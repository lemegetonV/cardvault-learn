import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, terminal, code } from '../../src/components.mjs';
import { clockRow, tokenTimeline } from '../diagrams/inside.mjs';

export default {
  minutes: 11,
  lede: 'Many of CardVault’s rules depend on time. Tokens expire after 15 minutes, a card must have been used in the last 90 days to join the wallet, and a card stops working after its expiry month. A test cannot wait 90 days. This lesson shows how CardVault lets a test move time forward, safely and for every service at once.',
  youWill: 'You will learn how the shared clock works, what it controls, what it deliberately leaves alone, and how to use it in a test.',
  body: `
<h2>The problem with real time</h2>
<p>Imagine testing the rule “an access token stops working after 900 seconds”. With the real clock, the test would have to sleep for 15 minutes. To test “a card unused for more than 90 days cannot join the wallet”, it would have to wait three months, or change data behind the service’s back.</p>
<p>The usual answer is to let tests control what the system thinks the time is. Each service asks a single function, <code>clock.now()</code>, for the time instead of reading the computer’s clock directly. In normal running that function returns the real time. In test mode, a test can move it.</p>

<h2>One row that every service reads</h2>
<p>If each service kept its own fake time, they would soon disagree, and a token that auth thinks is fresh could look expired to the card service. CardVault avoids that by storing the offset in one place: a single row in the small <code>testsupport</code> database.</p>
${figure({ svg: clockRow(), caption: 'Every service and both mocks re-read the row every half second and add it to the real time.' })}
<ul>
<li><strong>Moving it:</strong> a test calls <code>POST /test/clock</code> on any service. That service writes the row and updates its own copy straight away.</li>
<li><strong>Following it:</strong> every other service re-reads the row every 0.5 seconds, so it is never more than about a second behind.</li>
<li><strong>Reading it:</strong> <code>clock.now()</code> itself never touches the database. It adds the remembered offset to the real time, which keeps it fast on busy code paths.</li>
</ul>

<h2>Seeing it work</h2>
<p>Here is the token rule tested in seconds instead of minutes. The test logs in as alice, moves business time forward by 901 seconds, and calls the card service again.</p>
${figure({ svg: tokenTimeline(), caption: 'Real time barely moves. Business time jumps past the token’s expiry, so the card service rejects the token.' })}
${terminal([
  ['curl -s localhost:8001/test/clock -H "X-Test-Key: $TEST_KEY" -H "content-type: application/json" -d \'{"advance_seconds": 901}\''],
  ['curl -s localhost:8002/v1/cards -H "Authorization: Bearer $TOKEN"', '{"error_code": "TOKEN_EXPIRED", "message": "...", "correlation_id": "..."}'],
], 'Terminal, after logging in as alice')}
<p>The <code>X-Test-Key</code> header is required on every <code>/test/*</code> endpoint. Its local value is in your <code>.env</code> file.</p>

<h2>Four ways to move it</h2>
<p>A request to <code>POST /test/clock</code> must contain exactly one of these fields. Sending none, or two, gets <code>422</code>.</p>
${table(['Send', 'What it does', 'Good for'], [
  ['`{"advance_seconds": 901}`', 'Moves business time forward from where it is now', 'Expiry rules: tokens, one-time codes, lockouts'],
  ['`{"offset_seconds": 7776000}`', 'Sets the offset from real time directly (here, 90 days)', 'Jumping to a fixed distance, whatever happened before'],
  ['`{"now": "2029-07-01T00:00:00Z"}`', 'Sets business time to an exact moment. The time zone is required', 'Calendar rules, such as card expiry at the start of a month'],
  ['`{"reset": true}`', 'Back to real time', 'Cleaning up after a test'],
])}
<p>Every answer, and <code>GET /test/clock</code>, returns the same view, so a test can check what each service believes:</p>
${code({ lang: 'json', title: 'GET /test/clock on any service (example values)', src: `{
  "now": "2026-11-25T09:15:07.120000Z",
  "real_now": "2026-11-25T09:00:06.120000Z",
  "offset_seconds": 901.0,
  "service": "card"
}` })}
${keyIdea(`<p>The service you call to move the clock sees the new time before its answer returns. The others can lag by up to a second. If a test moves time and then immediately calls a <em>different</em> service, it should first confirm that service’s <code>GET /test/clock</code> shows the new time, or allow a short, bounded wait.</p>`)}

<h2>What the clock controls, and what it does not</h2>
<p>The clock is for <strong>business rules</strong>: anything a customer or the bank would describe in terms of dates and deadlines. Background machinery still runs on real time, on purpose.</p>
${table(['Business time (moves with the clock)', 'Real time (ignores the clock)'], [
  ['Token expiry and refresh-token lifetime', 'Retries when publishing events'],
  ['“Used in the last 90 days” for wallet eligibility', 'Retries when reading events'],
  ['Card expiry at the start of the month after its expiry month', 'Delays before the mocks send callbacks'],
  ['Login lockout and one-time-code cooldown', 'The web app checking for updates'],
  ['Callback timestamp checks and reconciliation dates', 'Log timestamps'],
])}
<p>Imagine the other choice. If retry delays followed business time, jumping a day ahead would make every pending retry fire at once, and the test would be watching a storm it caused. Keeping machinery on real time means moving the clock changes the rules, not the plumbing.</p>
${testerEye(`<p>Time rules have edges, and edges are where bugs live. For “used in the last 90 days”, test a card last used 89 days ago, exactly 90 days ago, and 91 days ago. The shared clock makes all three cases a few seconds of work. Remember that the clock can also move backwards, which is handy for checking that a rule does not assume time only goes forward.</p>`)}

<h2>Cleaning up</h2>
<p>Because one row affects every service, a test that moves the clock and forgets to put it back affects every test that runs after it. <code>make reset</code> clears the offset, and so does <code>POST /test/clock</code> with <code>{"reset": true}</code>. A good test suite resets the clock after each test that moves it, even when the test fails.</p>
${realWorld(`<p>Production systems never expose a clock control. In CardVault the <code>/test/*</code> endpoints exist only when <code>TEST_MODE=true</code>; without it, they are not registered at all and <code>clock.now()</code> is plain real time. Real banks test time rules the same way, with a controllable clock in test builds, and they check that the control is absent from production.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Business time', 'The time CardVault’s rules use: real time plus the shared offset. Returned by `clock.now()`.'],
  ['Shared clock', 'One offset row in the `testsupport` database that every service and mock follows.'],
  ['Clock offset', 'How far business time is from real time, in seconds. Zero means real time.'],
  ['`TEST_MODE`', 'The setting that turns on the `/test/*` controls, including the clock. Off means real time only.'],
  ['`X-Test-Key`', 'The header every `/test/*` request needs. Its local value is in `.env`.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test advances the clock by 2 days through the auth service, then immediately calls the enrollment service, which still behaves as if no time has passed. What is the most likely reason?',
  options: ['The clock only affects the auth service', 'The enrollment service re-reads the offset every half second and has not picked it up yet', 'Moving the clock needs a restart', 'Enrollment uses real time for everything'],
  answer: 1,
  why: '<p>Every service follows the same row, but only the service you called updates immediately. Others catch up within about a second. Check their <code>GET /test/clock</code>, or wait briefly with a bounded retry, before calling them.</p>',
})}
${check({
  q: 'A test asks to add alice’s card to the wallet, then advances the clock by 3 days. The wallet operator mock’s confirmation callback still arrives after its usual short delay, not instantly. Is that a bug?',
  options: ['Yes, the callback should arrive instantly', 'No, mock callback delays deliberately run on real time', 'Yes, callbacks should be 3 days late', 'It depends on the card'],
  answer: 1,
  why: '<p>The clock drives business rules only. Delays, retries and polling stay on real time, so that moving the clock does not set off a burst of background work all at once.</p>',
})}
${check({
  q: 'You want to check that a card stops working at the start of the month after its expiry month, 07/2029. Which request sets the clock most directly?',
  options: ['`{"advance_seconds": 86400}`', '`{"now": "2029-08-01T00:00:00Z"}`', '`{"now": "2029-07-31"}`', '`{"reset": true}`'],
  answer: 1,
  why: '<p><code>now</code> sets an exact moment, and it must include a time zone. A card that expires 07/2029 stops working at 00:00 UTC on 1 August 2029. Checking one second before that moment as well would cover both sides of the edge.</p>',
})}

<h2>Recap</h2>
${recap([
  'Services get the time only from `clock.now()`: real time plus one shared offset.',
  'The offset lives in one row of the `testsupport` database; every service re-reads it every 0.5 s.',
  '`POST /test/clock` takes exactly one of `advance_seconds`, `offset_seconds`, `now` or `reset`.',
  'The clock drives business rules. Retries, delays, polling and logs stay on real time.',
  'Reset the clock after each test that moves it. `make reset` clears it too.',
])}
`,
};
