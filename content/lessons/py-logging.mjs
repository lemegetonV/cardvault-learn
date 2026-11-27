import { code, terminal, interview, keyIdea, testerEye, sequence } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'An assertion tells you what was wrong: a status code was 422 instead of 200. It does not tell you why. For that you need the request the test sent and the answer it got. This lesson adds one small file that writes every call to the log, so a failing test always comes with its own evidence.',
  youWill: 'You will be able to explain what a requests Session and a response hook are, read the log under a failing test, and say why secrets are hidden from it.',
  body: `
<h2>The problem: a failure with no story</h2>
<p>Here is a test that sends a new phone number, and the result of running it:</p>
${code({ title: 'Example · a test that fails', src: `
def test_a_new_phone_number_is_saved():
    someone = create_logged_in_customer(cards=[])
    profile_api = ProfileApi(someone["token"])

    response = profile_api.update_profile({"phone": "+44 7700 900123"})

    assert response.status_code == 200
` })}
${terminal([['pytest tests/test_fail_demo.py --tb=short', `tests/test_fail_demo.py:11: in test_a_new_phone_number_is_saved
    assert response.status_code == 200
E   assert 422 == 200`]], 'Terminal, without logging')}
<p>422 means the service refused the request as invalid. But which field, and what did it say? Without more, you would add a <code>print</code>, run the test again and hope it fails the same way. In CI at night, there is no second chance: the run is over and the evidence is gone.</p>

<h2>One place that sees every call</h2>
<p>In <a href="/learn/py-api-clients/">API client classes</a> you saw that every client sends through <code>http</code>, imported from <code>api/client.py</code>. Because every call in the suite goes through that one object, one function attached to it can record all of them.</p>
${sequence({
  id: 'logging-hook',
  label: 'A call through the shared session',
  actors: [
    { id: 't', label: 'test', kind: 'plain' },
    { id: 'h', label: 'http session', kind: 'plain' },
    { id: 's', label: 'Profile', kind: 'bank' },
    { id: 'l', label: 'log', kind: 'plain' },
  ],
  steps: [
    { from: 't', to: 'h', label: 'update_profile', note: 'The test calls the Profile client, which calls http.patch(...).' },
    { from: 'h', to: 's', label: 'PATCH /v1/profile', note: 'The session sends the request, exactly as requests.patch would.' },
    { from: 's', to: 'h', label: '422 + body', kind: 'reply', note: 'The service answers.' },
    { from: 'h', to: 'l', label: 'log_call(response)', note: 'Before handing the response back, the session runs the hook, which writes the call to the log.' },
    { from: 'h', to: 't', label: 'response', kind: 'reply', note: 'The test gets the same response object as before. Logging changed nothing about it.' },
  ],
  caption: 'The hook runs after every response, for every test, without any test asking for it.',
})}

<h2>The file</h2>
${code({ title: 'tests/api/api/client.py', src: `
import logging
import re

import allure
import requests

log = logging.getLogger("api")
...
def log_call(response, *args, **kwargs):
    """requests calls this after every response (it is a "hook")."""
    request = response.request
    milliseconds = round(response.elapsed.total_seconds() * 1000)
    title = f"{request.method} {request.url} -> {response.status_code} in {milliseconds} ms"
    sent = describe_body(request)
    got = hide_secrets(response.text) if "json" in response.headers.get("Content-Type", "") else ""

    log.info(title)
    if sent:
        log.info(f"  sent: {sent[:500]}")
    if got:
        log.info(f"  got:  {got[:500]}")
...
http = requests.Session()
http.hooks["response"].append(log_call)
` })}
<ul>
<li><strong>logging</strong> is Python’s built-in module for log messages. <code>logging.getLogger("api")</code> gets a named logger, and <code>log.info(...)</code> writes one message at the INFO level. Unlike <code>print</code>, pytest collects log messages per test and shows them only when they help, under a failure.</li>
<li><code>requests.Session()</code> makes a <strong>session</strong>: an object with the same <code>get</code>, <code>post</code> and <code>patch</code> methods as requests itself. It also keeps the connection to each service open between calls, which makes a run faster.</li>
<li>A <strong>hook</strong> is a function a library promises to call at a certain moment. <code>http.hooks["response"]</code> is the session’s list of functions to call after each response, and <code>.append(log_call)</code> adds ours to it.</li>
<li><code>response.request</code> is the request that produced this response, so the hook can show both. <code>response.elapsed</code> is how long the service took to answer.</li>
<li><code>[:500]</code> keeps the first 500 characters. A long list of transactions would otherwise flood the log.</li>
<li><code>*args, **kwargs</code> collect any extra values requests passes in. The hook does not need them, but it must accept them.</li>
</ul>
<p>The lines marked <code>...</code> hold two small helpers, and the Allure lines that <a href="/learn/py-allure/">Allure reports</a> covers.</p>

<h2>Turning it on</h2>
<p>pytest only keeps log messages at the level it is told to. Three lines in <code>pytest.ini</code> do that:</p>
${code({ title: 'tests/api/pytest.ini', lang: 'ini', src: `
log_level = INFO
log_format = %(asctime)s %(message)s
log_date_format = %H:%M:%S
` })}
<p>Now the same failure tells its own story:</p>
${terminal([['pytest tests/test_fail_demo.py --tb=short', `E   assert 422 == 200
------------------------------ Captured log call -------------------------------
05:59:29 POST http://localhost:8003/test/customers -> 201 in 90 ms
05:59:29 POST http://localhost:8001/v1/auth/login -> 200 in 53 ms
05:59:29   sent: {"username": "cust-5536f4f73a", "password": "<hidden>"}
05:59:29   got:  {"access_token":"<token hidden>","token_type":"Bearer",...}
05:59:29 PATCH http://localhost:8005/v1/profile -> 422 in 3 ms
05:59:29   sent: {"phone": "+44 7700 900123"}
05:59:29   got:  {"error_code":"VALIDATION_ERROR","message":"Request validation failed",
           "correlation_id":"5373e472-...","details":[{"loc":["body","phone"],
           "msg":"Value error, phone must be E.164, e.g. +15550100101",...}]}`]], 'Terminal, with logging (shortened)')}
<p>Reading from the bottom: the phone number was refused because it has spaces. The service wants the compact international form, <code>+447700900123</code>. So the test data is wrong, not the app. One run, no guessing. The same lines appear in the HTML report from <a href="/learn/py-reports/">Reports</a>, under the failed test.</p>

<h2>Never log a secret</h2>
<p>Logs are copied into CI artifacts, shared in bug reports and kept for weeks. A token in a log works for anyone who reads it. So the hook passes every body through <code>hide_secrets</code>:</p>
${code({ title: 'tests/api/api/client.py', src: `
# A token or password in a log is a secret anyone with the log could use, so hide them.
TOKENS = re.compile(r"eyJ[\\w-]+\\.[\\w-]+\\.[\\w-]+|rt_[\\w-]{10,}")
PASSWORDS = re.compile(r'("password"\\s*:\\s*")[^"]*')


def hide_secrets(text):
    text = TOKENS.sub("<token hidden>", text)
    return PASSWORDS.sub(r"\\1<hidden>", text)
` })}
<p><strong>re</strong> is Python’s module for regular expressions: patterns that match text. You do not need to read these two patterns closely. The first matches the shape of CardVault’s access and refresh tokens; the second matches the value after <code>"password":</code>. <code>.sub</code> replaces each match.</p>

${keyIdea('<p>Send every call through one session with a response hook, and every failing test arrives with the requests it sent and the answers it got, with secrets hidden.</p>')}

${testerEye('<p>Look for the <code>correlation_id</code> in a logged error. It is the ID the service wrote in its own log for that request, so a developer can find the server side of your failure in seconds.</p>')}

${interview({
  say: `<p>“Every API call in my suite goes through one requests Session, and a response hook logs the method, URL, status, time, and the request and response bodies with tokens and passwords masked. pytest shows that log under any failing test and in the HTML report, so a failure in CI comes with the exact calls and the correlation ID, and I rarely need to rerun to understand it.”</p>`,
  qa: [
    ['Why use a requests Session instead of requests.get?', '<p>It reuses connections, which is faster, and gives one place to add shared behaviour: default headers, retries, or a hook that logs every call.</p>'],
    ['A test failed in CI overnight. How do you find out why?', '<p>Open the report, read the assertion, then the captured log under it: the request the test sent and the response it got, including the error body and correlation ID. With the correlation ID I can find the request in the service logs if I need the server side.</p>'],
    ['What must you never put in test logs?', '<p>Secrets: passwords, tokens, API keys, and real personal or card data. Logs travel further than code, so the logging code masks them before writing.</p>'],
  ],
})}
`,
};
