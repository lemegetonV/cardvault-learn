import { code, interview, keyIdea, testerEye, sequence } from '../../src/components.mjs';

export default {
  minutes: 12,
  lede: 'Tests that run only when someone remembers are not much protection. CI, continuous integration, runs the suite automatically on every change and blocks changes that break it. This lesson reads the suite’s GitHub Actions workflow step by step.',
  youWill: 'You will be able to explain what the CI workflow does, when it runs, how it publishes its reports, and how scheduled runs, Docker and code-quality checks fit in.',
  body: `
<h2>What CI does</h2>
<p><strong>CI</strong> is a service that watches the repository. When code changes, it starts a fresh machine, gets the code, runs the checks you describe, and reports green or red on the change. The suite uses <strong>GitHub Actions</strong>, which reads a workflow file from <code>.github/workflows/</code>.</p>

<h2>When it runs</h2>
${code({ lang: 'yaml', title: '.github/workflows/api-tests.yml', src: `
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
` })}
<p>The file is written in <strong>YAML</strong>, a format of names and values where indentation shows what belongs to what, like Python. This part says: run on every push to main, on every pull request, and when someone presses “Run workflow” by hand (<code>workflow_dispatch</code>).</p>

<h2>The steps</h2>
${code({ lang: 'yaml', title: '.github/workflows/api-tests.yml', src: `
      - name: Get the code
        uses: actions/checkout@v5

      - name: Start CardVault
        uses: ./.github/actions/start-stack

      - name: Set up Python
        uses: actions/setup-python@v6
        with:
          python-version: "3.13"

      - name: Install the test libraries
        working-directory: tests/api
        run: pip install -r requirements.txt

      - name: Run the tests
        working-directory: tests/api
        run: pytest -n 4 --html=reports/report.html --self-contained-html --junitxml=reports/junit.xml --alluredir=reports/allure-results
` })}

${sequence({
  id: 'ci-run',
  label: 'One CI run, in order',
  actors: [
    { id: 'g', label: 'GitHub', kind: 'plain' },
    { id: 'r', label: 'runner', kind: 'plain' },
    { id: 'a', label: 'CardVault', kind: 'bank' },
  ],
  steps: [
    { from: 'g', to: 'r', label: 'start a fresh machine', note: 'A pull request is opened. GitHub starts an empty Ubuntu machine, called a runner.' },
    { from: 'r', to: 'r', label: 'checkout', kind: 'self', note: 'The runner downloads the repository at the change being tested.' },
    { from: 'r', to: 'a', label: 'start the app', note: 'CardVault starts on the runner itself, so every run tests a clean app with known data.' },
    { from: 'r', to: 'r', label: 'install, run pytest -n 4', kind: 'self', note: 'Python and the libraries are installed, then the suite runs in four processes.' },
    { from: 'r', to: 'a', label: '30 s load test', note: 'If the tests passed, a short Locust load test checks the services stay fast under a little load.' },
    { from: 'r', to: 'r', label: 'build Allure report', kind: 'self', note: 'Node.js is set up and the Allure tool turns the raw results into a report, pass or fail.' },
    { from: 'r', to: 'g', label: 'reports + logs', kind: 'reply', note: 'All the reports and the app’s logs are uploaded, even when tests failed, and kept for 14 days.' },
    { from: 'g', to: 'g', label: 'green or red', kind: 'self', note: 'The pull request shows the result. A red check warns everyone not to merge.' },
  ],
  caption: 'The runner is thrown away afterwards, so every run starts from nothing.',
})}

<h2>Publishing the reports</h2>
<p>After the tests, the workflow builds the reports and keeps them:</p>
${code({ lang: 'yaml', title: '.github/workflows/api-tests.yml', src: `
      - name: Run a short load test (Locust)
        working-directory: tests/perf
        run: |
          pip install -r requirements.txt
          locust --headless --users 10 --spawn-rate 5 --run-time 30s --only-summary --html ../api/reports/load-test.html

      - name: Set up Node.js (for the Allure report tool)
        if: always()
        uses: actions/setup-node@v5
        with:
          node-version: "22"

      - name: Build the Allure report
        if: always()
        working-directory: tests/api
        run: npx --yes allure@3.33.0 generate reports/allure-results --output reports/allure-report
...
      - name: Upload the report
        if: always()
        uses: actions/upload-artifact@v6
        with:
          name: api-test-report
          path: tests/api/reports/
          retention-days: 14
` })}
<ul>
<li>The load test, which the Locust lessons cover in <a href="/learn/py-perf-pass-fail/">Pass or fail: budgets and CI</a>, has no <code>if:</code>, so it runs only when the tests passed. There is no point timing a broken app.</li>
<li><code>if: always()</code> on the other steps makes them run even after a failure, which is exactly when you need the reports.</li>
<li><code>run: |</code> starts a block of several commands, one per line.</li>
<li>An <strong>artifact</strong> is a file a CI run keeps after the machine is gone. This one is a ZIP of the <code>reports/</code> folder: the pytest-html report, <code>junit.xml</code>, the Allure report, the load test report and the app’s logs. You download it from the run’s page.</li>
</ul>
<p>Teams that want reports in a browser without downloading often publish the Allure report to a web page, such as GitHub Pages, which also makes it easy to keep Allure’s history between runs.</p>

<p>One more detail matters: the app runs on the runner, so the result does not depend on a shared environment that someone else may have changed.</p>

<h2>Scheduled runs</h2>
<p>Teams often also run a suite on a timetable, for example every night against a shared test environment. GitHub Actions does that with a <code>schedule</code> trigger written in cron format:</p>
${code({ lang: 'yaml', title: 'Example · a nightly run', src: `
on:
  schedule:
    - cron: "0 2 * * *"   # every day at 02:00 UTC
` })}
<p>The five fields are minute, hour, day of month, month and day of week; <code>*</code> means every.</p>

<h2>Docker, in one paragraph</h2>
<p><strong>Docker</strong> packages a program with everything it needs into an image, which runs the same way on any machine as a container. CardVault’s services run as containers, which is how the CI step can start the whole app on a bare runner. A test suite can be packaged the same way, so it runs with the exact Python version and libraries everywhere.</p>

<h2>Code quality, in one paragraph</h2>
<p>Many teams add a step that checks the test code itself before running it. <strong>ruff</strong> is a fast Python linter and formatter: <code>ruff check</code> finds mistakes such as unused imports, and <code>ruff format</code> lays code out the same way for everyone. The suite is kept clean with both.</p>

${keyIdea('<p>CI runs the suite on every change, on a fresh machine with a fresh copy of the app, and saves the report and logs whatever the result. A red run stops a broken change from being merged.</p>')}

${testerEye('<p>A test suite is only useful if people trust it. Keep CI fast and reliable, and treat a flaky test as a bug to fix, not a reason to rerun until green.</p>')}

${interview({
  say: `<p>“The suite runs in GitHub Actions on every pull request and every push to main. The workflow checks out the code, starts the application on the runner, installs the test dependencies, runs pytest in parallel, then a 30-second Locust load test, builds the pytest-html, JUnit and Allure reports, and uploads them with the service logs as one artifact, even on failure. A nightly scheduled run is a common addition, and the same commands work in Jenkins or GitLab.”</p>`,
  qa: [
    ['What triggers your pipeline?', '<p>Pull requests and pushes to main, plus a manual trigger. A schedule trigger can add nightly runs.</p>'],
    ['Why upload reports with if: always()?', '<p>Because later steps are normally skipped after a failure, and a failure is exactly when you need the report and logs.</p>'],
    ['How do tests get the right environment in CI?', '<p>Either the pipeline starts the app itself, as here, or it points the suite at a shared environment by setting the config environment variables, with secrets from the CI secret store.</p>'],
  ],
})}
`,
};
