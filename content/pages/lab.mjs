// The Live lab page: unlock, send any customer request, run a test, reset the app.
import { page } from '../../src/layout.mjs';
import { esc, labRequest, nodeFile, perfButton, uiTestsIn, uiNode } from '../../src/components.mjs';
import { lessonUrl } from '../site.mjs';
import { suiteFiles, testsIn, isTestFile, SUITES } from './suite.mjs';

const ALICE = { username: 'alice', password: 'CardVault-Demo-1' };
const BEARER = { Authorization: 'Bearer {{token}}' };

// Ready-made requests for the "Send a request" form. A login saves {{token}}.
export const EXAMPLES = [
  { label: 'Log in as alice', method: 'POST', service: 'auth', path: '/v1/auth/login', body: ALICE },
  { label: 'Who am I? (uses the token)', method: 'GET', service: 'auth', path: '/v1/auth/me', headers: BEARER },
  { label: 'List my cards', method: 'GET', service: 'cards', path: '/v1/cards', headers: BEARER, save: { card_id: 'items.0.card_id' } },
  { label: 'One card (uses {{card_id}})', method: 'GET', service: 'cards', path: '/v1/cards/{{card_id}}', headers: BEARER },
  { label: 'Cards, two per page', method: 'GET', service: 'cards', path: '/v1/cards?limit=2', headers: BEARER },
  { label: 'My wallet', method: 'GET', service: 'wallet', path: '/v1/wallet', headers: BEARER },
  { label: 'My last five transactions', method: 'GET', service: 'transactions', path: '/v1/wallet/transactions?limit=5', headers: BEARER },
  { label: 'My profile', method: 'GET', service: 'profile', path: '/v1/profile', headers: BEARER },
  { label: 'Log in with a wrong password', method: 'POST', service: 'auth', path: '/v1/auth/login', body: { username: 'bob', password: 'not-the-password' } },
  { label: 'List cards with no token', method: 'GET', service: 'cards', path: '/v1/cards' },
];

const toForm = (e) => ({
  method: e.method,
  service: e.service,
  path: e.path,
  headers: Object.entries(e.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n'),
  body: e.body ? JSON.stringify(e.body, null, 2) : '',
  save: e.save || {},
});

export function labPage() {
  const tests = suiteFiles().filter(isTestFile);
  const groups = tests.map((p) => {
    const file = nodeFile(p);
    const opts = testsIn(p).map((t) => `<option value="${esc(`${file}::${t}`)}">${esc(t)}</option>`).join('');
    return `<optgroup label="${esc(file)}"><option value="${esc(file)}">All tests in ${esc(file.replace('tests/', ''))}</option>${opts}</optgroup>`;
  }).join('');
  const uiGroups = suiteFiles(SUITES.ui).filter((p) => uiTestsIn(p).length).map((p) => {
    const opts = uiTestsIn(p).map((t) => `<option value="${esc(uiNode(p, t.line))}">${esc(t.title)}</option>`).join('');
    return `<optgroup label="${esc(uiNode(p))}"><option value="${esc(uiNode(p))}">All tests in ${esc(uiNode(p))}</option>${opts}</optgroup>`;
  }).join('');
  const exampleOpts = EXAMPLES.map((e, i) => `<option value="${i}">${esc(e.label)}</option>`).join('');

  const body = `<div class="frame lab-frame">
<div class="page-head">
<p class="eyebrow"><span class="chip">Live</span><span>The real app, on the server</span></p>
<h1>Live lab</h1>
<p class="lede">Send real requests to CardVault, run tests from both suites, and put the app back to its starting data. Everything on this page talks to the app running on the server, the same one the lessons describe.</p>
</div>

<section class="lab-card">
<h2>Is the app up?</h2>
<p>Each of the five services, as the server sees it right now.</p>
<div class="lab-row"><div class="svc-status" data-lab-status aria-live="polite"></div></div>
</section>

<section class="lab-card">
<h2>Send a request</h2>
<p>Pick a ready-made request or write your own. Start with <em>Log in as alice</em>: its response holds a token, which the page saves as <code>{{token}}</code> and puts into the requests that need it. Only the customer API (paths under <code>/v1/</code>) can be called.</p>
<label class="lab-pick"><span>Ready-made request</span><select id="lab-example">${exampleOpts}</select></label>
<div class="tryit" data-tryit><div class="code-head"><span>Request</span><span class="tryit-vars"></span></div>
<div class="tryit-body" id="lab-request">${labRequest({ ...EXAMPLES[0], label: '' })}</div></div>
</section>

<section class="lab-card">
<h2>Run an API test</h2>
<p>Runs one test, or a whole file, from <a href="/suite/">the API suite</a> against the live app. A panel opens beside the page and shows each step as the test takes it: every API request with its response, and any database query or Kafka event, in order. One run happens at a time. Tests that change data make their own new customer, so a run leaves alice as she was.</p>
<div class="lab-row run-host"><select id="lab-test" aria-label="Test to run">${groups}</select><button type="button" class="run-btn" data-run-select="#lab-test" disabled><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3v10l8-5z" fill="currentColor"/></svg>Run</button></div>
</section>

<section class="lab-card">
<h2>Run a UI test</h2>
<p>Runs one test, or a whole file, from <a href="/suite/ui/">the Playwright suite</a> in a headless Chrome on the server, against the live web app. The panel shows each action and each <code>expect()</code> check as it happens, with the line of code it came from. When the test ends you get its final screenshot, a video of the whole run, the trace to open in Playwright’s trace viewer, and the full HTML report. Tests in <code>learn/</code> run the setup project first, which signs alice in once and saves the login.</p>
<div class="lab-row run-host"><select id="lab-ui-test" aria-label="UI test to run">${uiGroups}</select><button type="button" class="run-btn" data-run-ui-select="#lab-ui-test" disabled><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3v10l8-5z" fill="currentColor"/></svg>Run</button></div>
</section>

<section class="lab-card">
<h2>Run the load test</h2>
<p>Runs the suite’s Locust load test, <code>tests/perf/locustfile.py</code>, against the live app: 5 simulated customers log in and browse for 20 seconds. The panel shows the totals as they grow, then a table of response times per request and whether the run met its budgets. The size is fixed and small because the server is shared; <a href="${lessonUrl('py-perf-running')}">Running Locust</a> shows how to run bigger tests on your own computer.</p>
<div class="lab-row run-host">${perfButton('Run the load test')}</div>
</section>

<section class="lab-card">
<h2>Reset to starting data</h2>
<p>Puts every service back to the same starting customers, cards, wallets and transactions. Use it when a demo has changed something, for example after locking an account with wrong passwords or reporting a card lost. It takes a few seconds, and saved tokens are cleared.</p>
<div class="lab-row"><button type="button" class="btn" data-lab-reset>Reset the app</button><span class="lab-reset-msg muted" aria-live="polite"></span></div>
</section>

<p class="how-note">New to requests and responses? <a href="${lessonUrl('py-http-for-testers')}">HTTP for testers</a> explains every part of the form above.</p>
</div>`;

  const scripts = `<script type="application/json" id="lab-examples">${JSON.stringify(EXAMPLES.map(toForm)).replace(/</g, '\\u003c')}</script>
<script>
(function () {
  var examples = JSON.parse(document.getElementById('lab-examples').textContent);
  var select = document.getElementById('lab-example');
  var block = document.querySelector('#lab-request .tryit-req');
  select.addEventListener('change', function () {
    block.dispatchEvent(new CustomEvent('tr-load', { detail: examples[Number(select.value)] }));
  });
}());
</script>`;
  return page({ title: 'Live lab · CardVault Learn', active: 'lab', body, scripts });
}
