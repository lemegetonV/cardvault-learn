import { code, terminal, interview, keyIdea, testerEye, table } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'A suite that only runs on your computer protects nothing while you sleep. Continuous integration, CI, runs it on a fresh machine every time someone proposes a change, and blocks the change if a test fails. CardVault’s Playwright suite runs in GitHub Actions. This lesson reads its workflow file step by step and shows what you get when a run fails.',
  youWill: 'You will be able to read a Playwright CI workflow, say why each step is there, and find the report and traces of a failed run.',
  body: `
<h2>When it runs</h2>
<p>GitHub Actions reads workflow files from <code>.github/workflows/</code>. The pytest track met the idea in <a href="/learn/py-ci/">running in CI</a>; this file does the same for the browser tests.</p>
${code({ lang: 'yaml', title: '.github/workflows/ui-tests.yml', src: `
name: ui-tests

# Runs the Playwright suite (tests/ui) against a full CardVault stack started in the runner.
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

concurrency:
  group: ui-tests-\${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
` })}
<ul>
<li><code>on</code> lists the triggers: every pull request, every change that lands on <code>main</code>, and a Run button in GitHub (<code>workflow_dispatch</code>).</li>
<li><code>concurrency</code> cancels a run that is still going when a newer commit arrives on the same pull request, so only the latest code is tested.</li>
</ul>

<h2>The steps</h2>
${code({ lang: 'yaml', title: '.github/workflows/ui-tests.yml', src: `
jobs:
  ui-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Get the code
        uses: actions/checkout@v5

      - name: Start CardVault
        uses: ./.github/actions/start-stack

      - name: Set up Node.js
        uses: actions/setup-node@v5
        with:
          node-version: "22"

      - name: Install the test tools
        working-directory: tests/ui
        run: npm ci

      - name: Install the browser
        working-directory: tests/ui
        run: npx playwright install --with-deps chromium

      - name: Check the TypeScript
        working-directory: tests/ui
        run: npm run typecheck

      - name: Run the tests
        working-directory: tests/ui
        run: npx playwright test
` })}
${table(['Step', 'Why'], [
  ['Get the code', 'The runner is a brand-new Linux machine with nothing on it'],
  ['Start CardVault', 'A full copy of the app, built from the same commit, with its demo data: the tests never touch a shared environment'],
  ['Set up Node.js', 'The same major version as on your computer'],
  ['`npm ci`', 'Installs exactly the versions in `package-lock.json`, unlike `npm install`, which may update them'],
  ['Install the browser', '`--with-deps` also installs the Linux libraries the browser needs'],
  ['Check the TypeScript', 'A type mistake fails in seconds, before any browser starts'],
  ['Run the tests', 'All projects: setup, learn, framework and phone'],
])}
<p>On CI, the environment variable <code>CI</code> is set, so the config from <a href="/learn/pw-flaky-tests/">flaky tests</a> allows one retry. A test that fails and then passes is reported as flaky, and the run stays green.</p>

<h2>The steps that run even after a failure</h2>
${code({ lang: 'yaml', title: '.github/workflows/ui-tests.yml', src: `
      # Screenshots differ slightly between machines, so the visual tests run
      # inside Playwright's Docker image, where their saved pictures were made.
      - name: Run the visual tests
        if: always()
        working-directory: tests/ui
        run: npm run visual

      - name: Upload the report
        if: always()
        uses: actions/upload-artifact@v6
        with:
          name: ui-test-report
          path: |
            tests/ui/playwright-report/
            tests/ui/test-results/
            tests/ui/visual-report/
            tests/ui/visual-results/
          retention-days: 14
` })}
<ul>
<li>Normally a failed step stops the job. <code>if: always()</code> runs a step anyway, so the screenshot tests still run and the evidence is still saved after a failure.</li>
<li>The visual tests run in Playwright’s Docker image, for the reason <a href="/learn/pw-visual/">visual comparisons</a> told: their pictures were made there.</li>
<li><code>upload-artifact</code> keeps files from the run for 14 days, as a zip called an <strong>artifact</strong>: the HTML reports, and the screenshots and traces of failed tests.</li>
</ul>
${terminal([['(GitHub Actions log, the visual step)', `Running 2 tests using 1 worker

  ✓  1 [visual] › visual/visual.spec.ts:8:1 › the sign-in page looks as it did (403ms)
  ✓  2 [visual] › visual/visual.spec.ts:13:1 › alice’s credit card on the Cards page looks as it did (618ms)

  2 passed (1.6s)`]], 'Real output from a CI run')}

<h2>When a run fails</h2>
<p>The pull request shows a red cross next to <strong>ui-tests</strong>. The log lists the failures, as in this real run from before the visual tests moved into Docker:</p>
${terminal([['(GitHub Actions log, the test step)', `  ✘  62 [learn] › learn/visual.spec.ts:8:1 › the sign-in page looks as it did (981ms)
  ✘  65 [learn] › learn/visual.spec.ts:8:1 › the sign-in page looks as it did (retry #1) (1.3s)

    Error: expect(page).toHaveScreenshot(expected) failed

      1363 pixels (ratio 0.01 of all image pixels) are different.

  2 failed
  67 passed (39.1s)`]], 'Real output, shortened')}
<ol>
<li>Read the error in the log: which test, which check, what was expected.</li>
<li>Download the <code>ui-test-report</code> artifact from the run’s summary page and unzip it.</li>
<li>Open the report with <code>npx playwright show-report playwright-report</code>, or a trace with <code>npx playwright show-trace</code>, as in <a href="/learn/pw-debugging/">debugging</a>. The trace shows what the CI browser saw at every step.</li>
</ol>

${keyIdea('<p>CI starts a fresh copy of the app, installs exact versions, checks types, runs every project with one retry, and uploads the reports and traces even when tests fail. A failed run is investigated from the downloaded trace, not by guessing.</p>')}

<h2>When the suite grows</h2>
<p>This suite takes under a minute, so one job is enough. A larger one is split with <a href="/learn/pw-parallel/">sharding</a>: a <code>matrix</code> starts several copies of the job, each runs <code>npx playwright test --shard=\${{ matrix.shard }}/4</code> with the <code>blob</code> reporter, and a last job joins the results with <code>npx playwright merge-reports</code>. Scheduled runs, with <code>on: schedule</code>, can add other browsers at night.</p>

${testerEye('<p>A red CI run is a question, not a verdict. Check whether the same test fails on <code>main</code>, read the trace, then decide: a real bug to report, a test to fix, or an environment problem. Never make a run green by removing or skipping the test that failed.</p>')}

${interview({
  say: `<p>“Our Playwright suite runs in GitHub Actions on every pull request and on main. The job starts a fresh copy of the app with Docker Compose, installs exact package versions with npm ci and Chromium with its system libraries, type-checks, and runs all projects with one retry on CI. Visual tests run in Playwright’s Docker image. The HTML report, screenshots and traces are uploaded as an artifact even on failure, so I debug a CI failure by opening its trace locally.”</p>`,
  qa: [
    ['How do you run Playwright tests in CI?', '<p>Check out the code, start or point to the app, install dependencies with <code>npm ci</code>, install browsers with <code>npx playwright install --with-deps</code>, run <code>npx playwright test</code>, and upload the report and traces with <code>if: always()</code>.</p>'],
    ['What is the difference between npm ci and npm install?', '<p><code>npm ci</code> installs exactly what the lock file says and fails if it does not match <code>package.json</code>, so every run uses the same versions. <code>npm install</code> may update versions and the lock file.</p>'],
    ['How would you speed up a slow CI run?', '<p>Shard across several jobs with <code>--shard</code> and merge the blob reports, cache dependencies, run only Chromium on pull requests and other browsers on a schedule, and keep journeys few.</p>'],
  ],
})}
`,
};
