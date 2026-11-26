import { code, terminal, shot, interview, keyIdea, testerEye, table } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'When a test fails in CI at night, nobody watches the terminal. The run has to leave evidence behind: what failed, where, with which values, and enough context to start investigating. This lesson covers the suite’s reports and how to read a failure in one.',
  youWill: 'You will be able to produce and read the suite’s HTML report, explain what the JUnit file is for, and describe what Allure adds.',
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
============================= 72 passed in 23.91s ==============================`]], 'Terminal')}
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

<h2>What to add when you file a bug</h2>
<ul>
<li>The request: method, URL and body.</li>
<li>The response: status code and body, including the <code>correlation_id</code>, which lets developers find this exact request in the service logs.</li>
<li>Expected and actual, and where the expected value comes from.</li>
</ul>
<p>The suite’s CI job also saves the services’ logs next to the report, so the evidence for a failure is all in one place.</p>

<h2>Allure, the other report you will hear about</h2>
<p><strong>Allure</strong> is a popular reporting tool. With the allure-pytest plugin, pytest writes raw results, and the Allure command-line tool turns them into a richer site than pytest-html: history across runs, named steps inside a test, attached request and response bodies, and grouping by feature.</p>
${code({ title: 'Example · Allure steps and attachments', src: `
import allure


def test_report_a_card_lost(customer):
    with allure.step("Report the card lost"):
        response = cards_api.report_lost(card_id)
    allure.attach(response.text, name="response", attachment_type=allure.attachment_type.JSON)
` })}
<p>The suite uses pytest-html because it needs nothing extra to install or run. Allure is worth knowing for interviews, because many teams use it.</p>

${keyIdea('<p>A run must leave evidence: an HTML report for people, JUnit XML for the CI system, and logs. A failure is read from the marked line down to the difference.</p>')}

${testerEye('<p>A failed test is a question, not a verdict. The report tells you where the app and the expectation disagree; the requirement tells you which one is wrong.</p>')}

${interview({
  say: `<p>“Every run produces a self-contained HTML report with pytest-html and a JUnit XML file that the CI system reads, and CI uploads both with the service logs as artifacts. When something fails I read the assertion diff, check the expected value against the requirement, and file the request, the response and its correlation ID. I have also used Allure, which adds steps, attachments and history.”</p>`,
  qa: [
    ['What is JUnit XML for if you have an HTML report?', '<p>It is a standard format that CI systems such as GitHub Actions, Jenkins or GitLab read to show pass and fail counts and trends. The HTML report is for people.</p>'],
    ['What would you include in a bug report from an API test?', '<p>The request, the response with status and body, the correlation ID, expected versus actual, where the expectation comes from, and the environment.</p>'],
    ['What does Allure add over pytest-html?', '<p>Run history and trends, steps inside a test, attachments such as request and response bodies, and grouping by feature or severity.</p>'],
  ],
})}
`,
};
