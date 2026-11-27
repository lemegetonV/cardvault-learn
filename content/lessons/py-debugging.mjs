import { code, terminal, interview, keyIdea, testerEye, table } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'A red test is the start of an investigation, not the end. Before anyone fixes anything, someone has to find out whether the app is wrong, the test is wrong, or the environment had a bad moment. This lesson gives a routine for that, follows one real failure through it, and ends with the bug report you would write if the app were at fault.',
  youWill: 'You will be able to investigate a failed API test from its evidence, tell the usual causes apart, and write a clear bug report with severity and priority.',
  body: `
<h2>The routine</h2>
<p>Most failures can be explained from evidence the run already saved. Work through it in order, and resist the urge to rerun first: a rerun that passes hides the problem without explaining it.</p>
<ol>
<li><strong>Read the failure line.</strong> Which test, which assert, expected what, got what.</li>
<li><strong>Read the calls.</strong> The logged requests and responses under the failure, from <a href="/learn/py-logging/">Logging every request and response</a>. The last response usually says why.</li>
<li><strong>Check the expectation.</strong> Find the requirement the expected value came from. Is the test asking for the right thing?</li>
<li><strong>Follow the correlation ID</strong> into the service’s own log, if the response alone does not explain it.</li>
<li><strong>Decide, then act.</strong> Fix the test, fix the environment, or report a bug.</li>
</ol>

<h2>Usual causes, and how to tell them apart</h2>
${table(['Cause', 'What you tend to see', 'Evidence that settles it'], [
  ['The test expects the wrong thing', 'A clean, readable error from the app, such as 422 with a field named', 'The requirement agrees with the app'],
  ['The app has a bug', 'An answer that breaks the requirement: wrong value, wrong status, a 500', 'The requirement disagrees with the app, and the failure repeats'],
  ['The environment', 'Connection errors, timeouts, 502 or 503, many unrelated tests failing at once', 'The health check or service log shows a service down or restarting'],
  ['Timing', 'A check that ran before a background change finished; passes on a rerun', 'The log shows the change arriving a moment after the check'],
  ['Shared data', 'Fails only after other tests, or after many runs', 'Another test or an earlier run changed the same data'],
])}
<p>Keep more than one explanation in mind until the evidence rules the others out. “It is probably flaky” is a guess; <a href="/learn/py-flaky-and-parallel/">Flaky tests, waits and parallel runs</a> covers how to prove it.</p>

<h2>Following one failure</h2>
<p>Here is the failure from the logging lesson, as it appears in a CI report:</p>
${terminal([['(from the report of a CI run)', `FAILED tests/test_fail_demo.py::test_a_new_phone_number_is_saved
E   assert 422 == 200
------------------------------ Captured log call -------------------------------
05:59:29 PATCH http://localhost:8005/v1/profile -> 422 in 3 ms
05:59:29   sent: {"phone": "+44 7700 900123"}
05:59:29   got:  {"error_code":"VALIDATION_ERROR","message":"Request validation failed",
           "correlation_id":"5373e472-b28e-4284-bb13-d98b68035119",
           "details":[{"loc":["body","phone"],"msg":"Value error, phone must be E.164, ..."}]}`]], 'Report (shortened)')}
<p><strong>Steps 1 and 2.</strong> The test expected the new phone number to be saved and got <code>422</code>. The response names the field, <code>phone</code>, and the rule, E.164: the compact international form with no spaces.</p>
<p><strong>Step 3.</strong> The API documentation for this call says the same: “New phone number, E.164 (e.g. +15550100101)”, which means a <code>+</code> and digits only. The test sent spaces. The app is right and the test data is wrong.</p>
<p><strong>Step 4.</strong> Not needed here, but this is how it works. The CI job saves every service’s log next to the report. Searching it for the correlation ID finds the server’s side of this exact request:</p>
${terminal([['grep 5373e472 cardvault-logs.txt', `profile-1  | {"ts": "2026-11-27T05:59:29.208+00:00", "level": "INFO", "service": "profile",
  "logger": "access", "msg": "PATCH /v1/profile 422", "correlation_id": "5373e472-b28e-4284-bb13-d98b68035119",
  "method": "PATCH", "path": "/v1/profile", "status": 422, "duration_ms": 1.0}`]], 'Terminal')}
<p>For a <code>500</code>, the lines around this one would hold the error the service hit, which is what a developer needs.</p>
<p><strong>Step 5.</strong> Fix the test: send <code>+447700900123</code>. Then add the spaced number as a negative case, because the investigation showed a rule worth testing. The suite already has it, in <code>data/contact_details.json</code>.</p>

<h2>When the app is wrong: the bug report</h2>
<p>Suppose instead the requirement said spaces are allowed and should be removed. Then the app is wrong, and you write a bug report. A good one lets a developer reproduce the problem without asking you anything.</p>
${code({ title: 'Example · a bug report', lang: 'text', src: `
Title:        Profile update refuses phone numbers that contain spaces (422)

Environment:  stage, Profile service, 27 Nov 2026 05:59 UTC

Steps:        1. Log in as any customer.
              2. PATCH /v1/profile with body {"phone": "+44 7700 900123"}

Expected:     200, phone saved as +447700900123
              (requirement PROF-12: "spaces in phone numbers are removed")

Actual:       422 VALIDATION_ERROR, "phone must be E.164"

Evidence:     correlation_id 5373e472-b28e-4284-bb13-d98b68035119
              full request and response attached; failing test:
              tests/test_profile.py::test_contact_details_are_checked

Severity:     Minor (customers can retype the number without spaces)
Priority:     High (the mobile app sends spaces, so every mobile change fails)
` })}
<ul>
<li><strong>The title</strong> says what fails and how, so it can be found again by searching.</li>
<li><strong>Expected</strong> names its source. Without one, it is an opinion. PROF-12 is a made-up requirement ID for this example.</li>
<li><strong>Evidence</strong> includes the correlation ID, so the developer can go straight to the server log.</li>
<li><strong>Severity</strong> is how much harm the bug does. <strong>Priority</strong> is how soon it should be fixed. They often differ: a typo on the login page is low severity but high priority, because everyone sees it; a crash in a yearly report is high severity but may wait until next month.</li>
</ul>

${keyIdea('<p>Read the failure, read the calls, check the expectation against the requirement, follow the correlation ID if needed, then decide whether the test, the environment or the app is wrong. Only the last one becomes a bug report.</p>')}

${testerEye('<p>Before reporting a bug, try to make it smaller: the fewest steps and the simplest data that still fail. A two-line reproduction gets fixed faster than a whole test file.</p>')}

${interview({
  say: `<p>“When a test fails I start from the evidence the run saved: the assertion, then the logged requests and responses under it, which usually say why. I check the expected value against the requirement to decide whether the app or the test is wrong, and if I need the server side I search the service logs for the correlation ID. Environment problems look different: timeouts or 503s across many tests. If it is a real bug, I report it with steps, expected with its source, actual, the correlation ID, severity and priority.”</p>`,
  qa: [
    ['A test passed yesterday and fails today. What do you do?', '<p>Read the failure and the logged calls first. Then look at what changed: the app’s deployment, the test code, the data or the environment. Check whether other tests fail too, which points at the environment. Only rerun once I have a theory to test, so a pass does not hide the cause.</p>'],
    ['What is the difference between severity and priority?', '<p>Severity is the impact of the bug on users or the system. Priority is how urgently it should be fixed, a business decision. A high-severity bug in a rarely used feature can have lower priority than a cosmetic bug on the home page.</p>'],
    ['What makes a good bug report?', '<p>A searchable title, the environment, minimal steps to reproduce, expected with its source, actual, evidence such as the request, response and correlation ID, and severity and priority.</p>'],
  ],
})}
`,
};
