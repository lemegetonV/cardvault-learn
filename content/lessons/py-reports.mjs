import { code, terminal, shot, interview, keyIdea, testerEye, table } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'When a test fails in CI at night, nobody watches the terminal. The run has to leave evidence behind: what failed, where, with which values, and enough context to start investigating. This lesson covers the two reports pytest can write by itself, one for people and one for machines, and how to read each.',
  youWill: 'You will be able to produce and read the suite’s HTML report, find the logged calls under a failure, and explain what is inside the JUnit file and what CI does with it.',
  body: `
<h2>Three outputs from one run</h2>
${table(['Output', 'Made by', 'Read by'], [
  ['Terminal lines', 'pytest itself, with `-v`', 'You, while you work'],
  ['HTML report', 'The pytest-html plugin', 'People: a page to open after the run'],
  ['JUnit XML', 'pytest itself, with `--junitxml`', 'Machines: CI systems show results and trends from it'],
])}
<p>A <strong>plugin</strong> is an extra library that adds features to pytest. Installing pytest-html is enough; pytest finds it by itself.</p>

${terminal([['pytest --html=reports/report.html --self-contained-html --junitxml=reports/junit.xml', `...
- Generated html report: file:///.../tests/api/reports/report.html -
============================= 93 passed in 30.52s ==============================`]], 'Terminal')}
<p><code>--self-contained-html</code> puts everything in one file, so it can be attached to a CI run or sent to someone.</p>

<h2>Reading a failure in the report</h2>
<p>To show a real failure, the expected data was changed on purpose to say alice’s card 2045 is a credit card. It is a debit card, so the test that checks her four cards fails:</p>
${shot({ src: 'pytest-html-report.png', alt: 'The pytest-html report: a summary with 1 failed and 8 passed, and the failed test expanded with its code and the assertion error', caption: 'A pytest-html report with one deliberate failure. The token value is shortened here.' })}
<p>Read it the same way as in the terminal, from the <code>&gt;</code> down:</p>
<ol>
<li>The red row names the test and how long it took.</li>
<li>The <code>&gt;</code> marks the line that failed: <code>assert found == ALICE["cards"]</code>.</li>
<li>The <code>E</code> lines give the difference. pytest hides the three cards that matched and shows the one that did not: <code>{'2045': 'DEBIT'} != {'2045': 'CREDIT'}</code>.</li>
</ol>
<p>Now the investigation starts. Either the app is wrong or the expectation is. Here the demo data says debit, so the expectation is wrong. In a real failure you would check the requirement before deciding.</p>

<h2>The calls behind a failure</h2>
<p>The difference tells you what disagreed, not why. For that, the report shows the log that <a href="/learn/py-logging/">Logging every request and response</a> set up, under each failed test. Here is a test that sent a phone number with spaces:</p>
${shot({ src: 'pytest-html-log.png', alt: 'A failed test in the pytest-html report: the assertion 422 == 200, then the captured log with the three calls the test made and the 422 response body naming the phone field', caption: 'Under the traceback, “Captured log call” lists every call the test made. The last response says why: the phone number is not in the E.164 format.' })}
<p>Read it in this order: the <code>E</code> lines say a 200 was expected and a 422 came back; the last logged call shows the request and the error body, which names the field and the rule. The report holds everything needed to decide whether the app or the test is wrong, without running anything again. <a href="/learn/py-debugging/">Debugging a failed API test</a> follows a failure like this all the way to a bug report.</p>
<p>The top of the report also lists the environment (Python version, plugins) and a summary with checkboxes that filter the table, for example to show only failures in a run of 93 tests.</p>

<h2>Inside the JUnit file</h2>
<p>JUnit XML started with JUnit, a Java test runner, and became the format almost every CI system reads. A short run of two tests, one failing, writes this:</p>
${code({ title: 'reports/junit.xml (shortened)', lang: 'text', src: `
<testsuites name="pytest tests">
  <testsuite name="pytest" errors="0" failures="1" skipped="0" tests="2" time="0.255">
    <testcase classname="tests.test_fail_demo" name="test_a_new_phone_number_is_saved" time="0.160">
      <failure message="assert 422 == 200 ...">... the traceback ...</failure>
    </testcase>
    <testcase classname="tests.test_cards" name="test_alice_has_her_four_cards" time="0.054" />
  </testsuite>
</testsuites>
` })}
<ul>
<li><code>&lt;testsuite&gt;</code> holds the totals: how many tests ran, failed, errored and were skipped, and the time taken.</li>
<li>Each <code>&lt;testcase&gt;</code> is one test, named by its file (<code>classname</code>) and function (<code>name</code>), with its time.</li>
<li>A failing test contains a <code>&lt;failure&gt;</code> element with the message and traceback. A passing one is empty.</li>
</ul>
<p>From this file, a CI system shows a list of failed tests on the pull request, counts across runs, and which tests got slower or started failing on and off. People rarely open it. They see it through the CI system’s pages.</p>

<h2>What else teams add</h2>
<p>Many teams also use <strong>Allure</strong>, a separate reporting tool with steps inside each test, attachments and run history. The suite writes Allure results too, and <a href="/learn/py-allure/">Allure reports</a> covers it. Whatever the tool, a good report answers three questions without a rerun: what failed, what the test sent and got, and what the environment was.</p>

${keyIdea('<p>A run must leave evidence: an HTML report for people, JUnit XML for the CI system, and logs. A failure is read from the marked line down to the difference.</p>')}

${testerEye('<p>A failed test is a question, not a verdict. The report tells you where the app and the expectation disagree; the requirement tells you which one is wrong.</p>')}

${interview({
  say: `<p>“Every run produces a self-contained HTML report with pytest-html and a JUnit XML file that the CI system reads, and CI uploads both with the service logs as artifacts. Every API call is logged, so under each failure the report shows the exact requests and responses. I read the assertion diff, check the expected value against the requirement, then the logged calls. The suite also writes Allure results for a richer report with steps.”</p>`,
  qa: [
    ['What is JUnit XML for if you have an HTML report?', '<p>It is a standard format that CI systems such as GitHub Actions, Jenkins or GitLab read to show pass and fail counts and trends. The HTML report is for people.</p>'],
    ['What does a CI system do with JUnit XML?', '<p>It reads the test cases, failures and times to show failed tests on the pull request, pass and fail counts, and trends such as tests that got slower or fail on and off.</p>'],
  ],
})}
`,
};
