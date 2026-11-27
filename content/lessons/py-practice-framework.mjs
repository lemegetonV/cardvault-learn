import { interview, keyIdea, testerEye, table, figure, svg, box, arrow, text } from '../../src/components.mjs';

const layers = svg(640, 250, 'The framework in three layers: tests use support code and API clients; API clients talk to the five services; support code also reads the database and Kafka',
  box(20, 20, 600, 46, 'Tests', { kind: 'plain', sub: 'tests/test_*.py: 93 tests, one file per feature' })
  + box(20, 102, 290, 46, 'Support', { kind: 'plain', sub: 'fixtures, helpers, data, db, events' })
  + box(330, 102, 290, 46, 'API clients', { kind: 'plain', sub: 'one class per service, one session' })
  + box(20, 184, 290, 46, 'Postgres + Kafka', { kind: 'event', sub: 'read-only checks' })
  + box(330, 184, 290, 46, 'CardVault services', { kind: 'bank', sub: 'Auth, Cards, Wallet, Transactions, Profile' })
  + arrow([[165, 66], [165, 100]]) + arrow([[475, 66], [475, 100]])
  + arrow([[165, 148], [165, 182]]) + arrow([[475, 148], [475, 182]])
  + arrow([[310, 125], [328, 125]])
  + text(320, 244, '', 't-sm'));

export default {
  minutes: 9,
  lede: '“Tell me about your framework” is the most common question in an SDET interview, and often the first. It is a chance to show, in two minutes, that you understand why every part exists. This lesson gives you a structure, a model answer built from everything in this track, and the follow-up questions it usually leads to.',
  youWill: 'You will be able to give a clear two-minute walk-through of the CardVault API framework and handle the follow-up questions it triggers.',
  body: `
<h2>What the interviewer listens for</h2>
<p>They are not checking that you remember file names. They want to hear that you made <em>decisions</em>, and know why: how tests stay independent, where expected values come from, what happens when one fails, and how the suite runs without you. A good answer is short, in a fixed order, and leaves openings for them to dig into.</p>

<h2>The structure: six beats</h2>
${table(['Beat', 'Say', 'Time'], [
  ['1. What and why', 'What the app is, what the suite covers, the tools', '15 s'],
  ['2. Layers', 'Tests, support code, API clients; why that split', '20 s'],
  ['3. Data and isolation', 'Known data versus fresh data; why tests can run in parallel', '20 s'],
  ['4. Reliability', 'Waiting with deadlines, never fixed sleeps', '15 s'],
  ['5. Evidence and CI', 'Logging, reports, the pipeline', '25 s'],
  ['6. Beyond the API', 'Database, events, performance; one thing you would add next', '20 s'],
])}
${figure({ svg: layers, caption: 'A picture you can draw on a whiteboard in thirty seconds while you talk through beat 2.' })}

<h2>The model answer</h2>
<p>Read it aloud a few times, then say it in your own words. Memorising it word for word sounds rehearsed; knowing the six beats lets you adapt.</p>
<blockquote class="script">
<p><strong>1.</strong> “CardVault is a bank’s card and wallet app built as five services: login, cards, wallet, transactions and profile. My API suite tests them directly over HTTP with Python, pytest and requests. It has 93 tests covering login and tokens, the card lifecycle, wallet eligibility, purchases, transactions, profiles and security.</p>
<p><strong>2.</strong> It has three layers. Tests say what should be true. Under them is support code: fixtures in conftest.py, helpers, and test data. At the bottom is one small client class per service, so a test reads like <code>CardsApi(token).report_lost(card_id)</code> and never contains a URL. Addresses come from one config module, and <code>TEST_ENV=stage</code> switches the whole environment.</p>
<p><strong>3.</strong> Tests that only read use a demo customer, with the expected values written down from known data. Any test that changes something creates its own fresh customer through a set-up endpoint, so no test depends on another, and the suite runs in parallel with pytest-xdist in about twelve seconds.</p>
<p><strong>4.</strong> Several flows finish in the background, like a card being confirmed by the wallet partner. Tests poll for those with a ten-second deadline, never a fixed sleep.</p>
<p><strong>5.</strong> Every request goes through one requests Session with a hook that logs the call, with secrets masked, and attaches it as an Allure step. So a failure shows exactly what was sent and what came back. GitHub Actions runs the suite on every pull request against a fresh copy of the app, and publishes the pytest-html, JUnit and Allure reports with the service logs.</p>
<p><strong>6.</strong> Where the API cannot show a fact, a few tests read the database as a read-only user or wait for the Kafka event a change publishes. There is also a Locust load test with budgets on p95 and error rate that runs for thirty seconds in CI. Next I would add contract tests with the wallet partner.”</p>
</blockquote>
<p>That is about 300 words: two minutes at a calm pace. Every sentence is something a lesson in this track explains, so you can go deeper on any of them.</p>

<h2>How to handle follow-ups</h2>
<ul>
<li><strong>Answer, then give an example from the suite.</strong> “We poll with a deadline. For example, after adding a card to the wallet, the test checks its status every half second for up to ten seconds.”</li>
<li><strong>Name the trade-off.</strong> Every choice has a cost: fresh customers per test are slower to create but make parallel runs safe. Saying the cost shows you chose it.</li>
<li><strong>Say what you would change.</strong> “If the suite grew to a thousand tests I would…” shows you can think past the current project.</li>
<li><strong>Be honest about limits.</strong> “I have not run load tests at production scale; my Locust test is a smoke-level check in CI” is a stronger answer than a vague claim.</li>
</ul>

${keyIdea('<p>Answer in six beats: what and why, layers, data and isolation, reliability, evidence and CI, beyond the API. Two minutes, decisions with reasons, and openings for follow-up questions.</p>')}

${testerEye('<p>Practise out loud with a timer. Most people run long on the first beat and never reach CI or reporting, which are the parts that show seniority.</p>')}

${interview({
  say: `<p>Use the model answer above, in your own words.</p>`,
  qa: [
    ['Why did you choose pytest and requests?', '<p>pytest gives fixtures, parametrize, markers and a large plugin ecosystem (HTML reports, xdist, Allure) with plain <code>assert</code> statements. requests is the standard Python HTTP library and easy to read. Together they need very little framework code.</p>'],
    ['How do you keep tests independent?', '<p>Read-only tests share a demo customer that nothing changes. Every test that changes state gets its own fresh customer from a fixture, and values the system remembers are made unique, so tests can run in any order and in parallel.</p>'],
    ['How long does the suite take, and how would you make it faster?', '<p>About thirty seconds serially and twelve with four workers. To go faster I would add workers, keep slow flows to a few flow tests, and move rule checks that need no network down to unit tests in the services.</p>'],
    ['What happens when a test fails in CI?', '<p>The run still publishes the reports and service logs. Under the failure I see the logged requests and responses, often with the correlation ID; I check the expectation against the requirement, then fix the test, the environment, or file a bug.</p>'],
    ['How do you handle test data?', '<p>Known demo data for reads, with the expected values in one data module; fresh customers created through a set-up endpoint for writes; data-driven cases in a JSON file for validation rules.</p>'],
    ['How do you handle authentication in tests?', '<p>A session-scoped fixture logs the demo customer in once per run. Fresh customers are logged in by the helper that creates them. Tokens go in the Authorization header from each client class, and the logging masks them.</p>'],
    ['What would you add next?', '<p>Contract tests with the wallet partner, so a change on either side is caught before integration, and Allure history kept between CI runs to spot flaky tests.</p>'],
    ['What is the hardest bug your tests found?', '<p>Pick a real story you can tell in steps. One from this project: a test began failing on its sixth run because a fixed username got locked after five failed logins over several runs; the fix was a unique name per run.</p>'],
  ],
})}
`,
};
