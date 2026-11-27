import { code, terminal, shot, interview, keyIdea, testerEye, table, sequence } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'pytest-html is one page with a list of tests. Allure is a reporting tool many teams use instead, because it shows what happened inside each test as named steps, with files attached, and can compare runs over time. The suite writes Allure results on every run. This lesson shows how, and how to read the report.',
  youWill: 'You will be able to explain the two halves of Allure (the pytest plugin and the report tool), produce a report, read a failed test’s steps and attachments, and describe steps, labels and history.',
  body: `
<h2>Two halves</h2>
<p>Allure works in two separate stages, made by two separate programs. Keeping them apart lets many test runners, in many languages, feed one report format.</p>
${sequence({
  id: 'allure-stages',
  label: 'From a test run to an Allure report',
  actors: [
    { id: 'p', label: 'pytest', kind: 'plain' },
    { id: 'g', label: 'allure-pytest', kind: 'plain' },
    { id: 'r', label: 'allure-results/', kind: 'event' },
    { id: 'c', label: 'Allure tool', kind: 'plain' },
  ],
  steps: [
    { from: 'p', to: 'g', label: 'each test runs', note: 'pytest runs the tests as usual. The allure-pytest plugin watches each one.' },
    { from: 'g', to: 'r', label: 'JSON per test', note: 'For every test it writes a JSON file with the result, the steps and the attached files. This is raw data, not a report.' },
    { from: 'c', to: 'r', label: 'allure generate', note: 'Later, the Allure command-line tool reads the folder.' },
    { from: 'c', to: 'c', label: 'HTML report site', kind: 'self', note: 'It builds a website: the report you open in a browser.' },
  ],
  caption: 'The plugin collects; the tool builds the report. They can run on different machines, minutes apart.',
})}
${table(['Half', 'What it is', 'How you get it'], [
  ['allure-pytest', 'A pytest plugin (Python) that writes raw results', '`pip install allure-pytest`, in the suite’s requirements'],
  ['Allure report tool', 'A command-line program that turns results into a website', 'Allure 3 runs on Node.js: `npx allure@3.33.0 ...`, with nothing to install first'],
])}

<h2>Making a report</h2>
${terminal([
  ['pytest --alluredir=allure-results', '(the tests run as usual, and one JSON file per test lands in allure-results/)'],
  ['npx allure@3.33.0 generate allure-results --output allure-report', ''],
  ['npx allure@3.33.0 open allure-report', '(serves the report and opens it in your browser)'],
], 'Terminal')}
<p><code>--alluredir</code> is the option the plugin adds to pytest. Without it, the plugin does nothing, so an ordinary <code>pytest</code> run is unchanged. <code>npx</code> comes with Node.js and runs a tool straight from the npm registry. The report is a small website, and <code>open</code> serves it on a local address.</p>

<h2>The overview</h2>
${shot({ src: 'allure-overview.png', alt: 'The Allure report overview: 94 tests, 1 failed and 93 passed, with a tree of test files and a coloured bar of results per file; the failed test is expanded', caption: 'A run of the suite with one extra, deliberately failing test. Each file shows a bar of its results.' })}
<p>The tabs across the top group results in other ways. Allure also tells two kinds of failure apart. A test whose assertion failed is <strong>failed</strong>: the app answered something the test did not expect, and the report files it under product errors in <strong>Categories</strong>. A test that crashed with some other exception, such as a typo in the test or a service that was down, is <strong>broken</strong>. That split is the first question in any triage: is the app wrong, or the test or the environment?</p>

<h2>Inside a failed test: steps</h2>
<p>A <strong>step</strong> is a named part of a test that Allure times and records on its own. Clicking the failed test shows its steps:</p>
${shot({ src: 'allure-steps.png', alt: 'The failed test in Allure: three steps, one per API call, with the PATCH step opened to show the request body and response body attachments; the response body names the phone field; then the assertion error', caption: 'Each API call is a step. The PATCH step is open, with the response body that explains the failure.' })}
<p>Nobody wrote these steps inside the test. They come from the same hook that logs every call in <a href="/learn/py-logging/">Logging every request and response</a>:</p>
${code({ title: 'tests/api/api/client.py', src: `
    # Without --alluredir these do nothing, so plain pytest runs are not affected.
    with allure.step(title):
        if sent:
            allure.attach(sent, name="request body", attachment_type=allure.attachment_type.TEXT)
        if got:
            allure.attach(got, name="response body", attachment_type=allure.attachment_type.JSON)
` })}
<ul>
<li><code>with allure.step(title):</code> opens a step named after the call, such as <code>PATCH .../v1/profile -&gt; 422 in 9 ms</code>. Everything inside the <code>with</code> block belongs to it.</li>
<li><code>allure.attach(text, name=..., attachment_type=...)</code> attaches a piece of text to the current step. The type tells the report how to show it; JSON is shown formatted.</li>
<li>The bodies were already passed through <code>hide_secrets</code>, so the report holds no tokens or passwords.</li>
</ul>
<p>The report also attached the captured log as step 4, and shows the assertion with its code at the end. Everything the pytest-html report has is here, organised by step.</p>

<h2>Steps and labels you write yourself</h2>
<p>Teams often add steps in the tests too, so the report reads like a test case, and labels to group and filter. The suite does not, to keep its tests short, but this is how it looks:</p>
${code({ title: 'Example · steps and labels in a test', src: `
import allure


@allure.feature("Cards")
@allure.severity(allure.severity_level.CRITICAL)
def test_a_lost_card_cannot_be_used(customer):
    with allure.step("Report the card lost"):
        CardsApi(customer["token"]).report_lost(card_id)
    with allure.step("Try a purchase with it"):
        response = CardNetworkApi().make_purchase(token_ref, amount=500)
    assert response.json()["decision"] == "DECLINED"
` })}
<p><code>@allure.feature</code> and <code>@allure.severity</code> are <strong>labels</strong>: the report can filter by them, for example to show only critical failures. Labels and markers from <a href="/learn/py-markers/">Markers</a> play similar roles; markers choose what runs, labels organise the report.</p>

<h2>History and trends</h2>
<p>A single report shows one run. Allure can also keep a small history file from run to run, and then shows trends: whether a test fails on and off, which is how it flags <strong>flaky</strong> tests, and whether a test has become slower. This needs the history saved between runs, for example as a CI artifact or on a report server. The suite’s CI does not keep history yet, so each run’s report stands alone.</p>

${keyIdea('<p>allure-pytest writes raw results during the run; the Allure tool turns them into a report later. Steps show what happened inside a test, attachments hold the evidence, labels group the results, and history shows trends.</p>')}

${testerEye('<p>Attach evidence at the point where it is created, as the suite does with each call. A report that holds the request and response next to the failure saves the first hour of every investigation.</p>')}

${interview({
  say: `<p>“The suite writes Allure results with allure-pytest, and CI builds the report with the Allure command-line tool next to the pytest-html report. A response hook on our shared requests Session makes every API call an Allure step, with the request and response bodies attached and secrets masked, so a failed test shows exactly which call went wrong and what came back. Categories separate product errors from test defects, and with history kept between runs Allure shows flaky tests and trends.”</p>`,
  qa: [
    ['What is the difference between allure-pytest and the Allure command-line tool?', '<p>allure-pytest is a pytest plugin that writes raw JSON results during the run, when <code>--alluredir</code> is given. The command-line tool reads those results later and generates the HTML report. One collects, the other presents.</p>'],
    ['Why use Allure over pytest-html?', '<p>Steps inside each test, attachments such as request and response bodies, labels to filter by feature or severity, categories of failure, and history across runs. pytest-html is simpler and needs nothing extra, which is why many suites produce both.</p>'],
    ['How does Allure detect flaky tests?', '<p>From history: when the same test has both passed and failed across recent runs, or passed on a retry, the report marks it as flaky. That needs the history kept between runs.</p>'],
  ],
})}
`,
};
