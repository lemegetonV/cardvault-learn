import { figure, keyIdea, testerEye, terms, check, recap, code, terminal } from '../../src/components.mjs';
import { evidenceTrail } from '../diagrams/suite.mjs';

export default {
  minutes: 12,
  lede: 'A test that fails with “assert False” has done half its job. The other half is telling you why, ideally without running it again, because some failures happen only once in a while, or only in CI. This lesson follows a failed test from its message to the service’s own log line, using the evidence the suite collects on every request.',
  youWill: 'You will learn what the suite records for every request, how it prints that under a failed test, how a correlation ID leads into the services’ logs, what goes into the Allure report, and what is masked.',
  body: `
<h2>A failure, as it really prints</h2>
<p>Here is the output of a deliberately wrong test, written in a throwaway file that is not part of the suite. It tries to report a <em>closed</em> card lost and expects <code>200</code>. The spec says a closed card cannot be reported lost, so CardVault is right and the test is wrong. The output was recorded from a real run and shortened.</p>
${terminal([
  ['uv run pytest tests/cards/test_zz_demo_failure.py', `E   AssertionError: expected 200, got POST http://localhost:8002/v1/cards/e17697f2-…/report-lost -> 409: {"error_code":"INVALID_STATE_TRANSITION","message":"Cannot report lost a CLOSED card","correlation_id":"t-728df5802f1a","details":{"status":"CLOSED","action":"report-lost"}}

------------------------------ CardVault requests ------------------------------
POST http://localhost:8003/test/customers -> 201  [X-Correlation-ID: t-a84a125e416e]
  request:  {"email_verified": true, "phone_verified": true, "cards": [{"product": "CREDIT", "status": "CLOSED", …}]}
  response: {"username": "cust-4f1ce376fd", "password": "***", …}
POST http://localhost:8001/v1/auth/login -> 200  [X-Correlation-ID: t-e2eda7bf5db6]
  request:  {"username": "cust-4f1ce376fd", "password": "***"}
  response: {"access_token": "***", "token_type": "Bearer", "expires_in": 900, "refresh_token": "***", …}
POST http://localhost:8002/v1/cards/e17697f2-…/report-lost -> 409  [X-Correlation-ID: t-728df5802f1a]
  response: {"error_code": "INVALID_STATE_TRANSITION", "message": "Cannot report lost a CLOSED card", …}`],
], 'Recorded output · a deliberately wrong test')}
<p>Two pieces of evidence are already on screen. The first line, from <a href="/learn/suite-checks/">expect</a>, says what was expected and what came back, with the error body. Below it, the <strong>CardVault requests</strong> section lists every call the test made, in order: creating the customer (with the template showing the card was <code>CLOSED</code>), logging in, and the refused request. Reading it, the cause is clear without opening any file: the test set up a closed card.</p>

<h2>Where that section comes from</h2>
<p>The response hook from <a href="/learn/suite-clients/">Clients and credentials</a> records each exchange into a list. An <code>autouse</code> fixture empties the list before each test, so it only ever holds the current test’s requests. A pytest hook then adds it to the report of a failed test:</p>
${code({ title: 'tests/api/tests/conftest.py (part)', src: `
@pytest.hookimpl(wrapper=True)
def pytest_runtest_makereport(item: pytest.Item, call: pytest.CallInfo[None]):
    report = yield
    if report.failed and exchanges.items:
        report.sections.append(("CardVault requests", exchanges.report()))
    return report
` })}
<p><code>pytest_runtest_makereport</code> is the hook pytest calls to build the result of each test phase. Marked <code>wrapper=True</code>, the function runs around pytest’s own version: <code>yield</code> lets pytest build the report, and the code after it can add to it. A passing test gets nothing extra, so successful runs stay quiet.</p>

<h2>Following the ID into the system</h2>
${figure({ svg: evidenceTrail(), caption: 'Each step narrows the search: from “a test failed” to the service’s own account of the request.' })}
<p>The refused request carried <code>t-728df5802f1a</code>. Every CardVault log line includes the correlation ID of the request it belongs to, so one search finds what each service did:</p>
${terminal([
  ['docker compose logs --no-color | grep t-728df5802f1a', 'card-1  | {"ts": "2026-11-25T16:21:07.323+00:00", "level": "INFO", "service": "card", "logger": "access", "msg": "POST /v1/cards/e17697f2-…/report-lost 409", "correlation_id": "t-728df5802f1a", …, "duration_ms": 5.0}'],
], 'Recorded output')}
<p>Here only the card service was involved, so there is one line. For a request that set off events, the same ID appears in the log lines of every service that reacted, which is how you find where a chain of work stopped.</p>

<h2>The report, and what it hides</h2>
<p>The same hook attaches every request and response to the test in the <strong>Allure report</strong>, an HTML report built from the run’s results that you can open in a browser and share. Each attachment holds the method, URL, status, headers and bodies.</p>
<p>Evidence is often shared, so it must not leak secrets. The recorder replaces the values of the <code>Authorization</code>, <code>X-Service-Key</code>, <code>X-Test-Key</code> and <code>X-Signature</code> headers, and of <code>password</code>, <code>access_token</code> and <code>refresh_token</code> fields, with <code>***</code>, as the output above shows. Bodies longer than 2,000 characters are cut, and uploaded files are summarised by size.</p>
${keyIdea(`<p>Collect evidence on every request, show it only when a test fails, and give each request an ID the system logs too. A failure should explain itself from what is on screen, without a second run.</p>`)}
${testerEye(`<p>Read evidence before forming a theory. In the example, the request list shows the card was created closed, which settles the question at once. Starting from “the card service is broken” would have sent you to the wrong place.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Evidence', 'What a failed test leaves behind to explain itself: messages, requests, responses, IDs.'],
  ['Exchange log', 'The suite’s list of the current test’s requests and responses, printed under a failure.'],
  ['Wrapper hook', 'A hook that runs around pytest’s own, before and after a `yield`.'],
  ['Allure report', 'An HTML test report with each test’s steps and attachments, built after the run.'],
  ['Masking', 'Replacing secret values with `***` before they are printed or attached.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test fails only in CI, once in twenty runs. What makes it possible to diagnose without reproducing it?',
  options: ['Re-running with -v', 'The request list and correlation IDs printed under the failure, plus the uploaded logs and report, which show that one run', 'A longer timeout', 'Nothing; it must be reproduced'],
  answer: 1,
  why: '<p>The evidence belongs to the failing run itself. With the requests, their IDs and the services’ logs from that run, the rare failure can be read after the fact.</p>',
})}
${check({
  q: 'Why does an autouse fixture clear the exchange log before every test?',
  options: ['To save memory', 'So a failure shows only that test’s requests, not those of every earlier test', 'Because pytest requires it', 'To mask secrets'],
  answer: 1,
  why: '<p>Without clearing, the list would grow through the whole run and a failure would be buried under hundreds of unrelated requests.</p>',
})}
${check({
  q: 'A failure’s request list shows `"access_token": "***"`. Is the test broken?',
  options: ['Yes, the token is missing', 'No. The token was sent; the recorder masks it so evidence can be shared safely', 'Yes, login failed', 'The token expired'],
  answer: 1,
  why: '<p>Masking happens only in the evidence. The real request carried the real token; the printed and attached copies hide it.</p>',
})}

<h2>Recap</h2>
${recap([
  'Every request is recorded; a failed test prints its own under “CardVault requests”.',
  'A wrapper hook adds that section only to failed tests.',
  'The correlation ID leads from the failure to every service’s log lines.',
  'The Allure report attaches each exchange, with keys, tokens and passwords masked.',
])}
`,
};
