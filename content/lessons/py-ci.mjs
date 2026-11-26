import { code, interview, keyIdea, testerEye, sequence } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'Tests that run only when someone remembers are not much protection. CI, continuous integration, runs the suite automatically on every change and blocks changes that break it. This lesson reads the suite’s GitHub Actions workflow step by step.',
  youWill: 'You will be able to explain what the CI workflow does, when it runs, where its results go, and how scheduled runs, Docker and code-quality checks fit in.',
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
        run: pytest -n 4 --html=reports/report.html --self-contained-html --junitxml=reports/junit.xml
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
    { from: 'r', to: 'g', label: 'report + logs', kind: 'reply', note: 'The HTML report, the JUnit file and the app’s logs are uploaded, even when tests failed, and kept for 14 days.' },
    { from: 'g', to: 'g', label: 'green or red', kind: 'self', note: 'The pull request shows the result. A red check warns everyone not to merge.' },
  ],
  caption: 'The runner is thrown away afterwards, so every run starts from nothing.',
})}

<p>Two details matter. The upload steps carry <code>if: always()</code>, so the evidence is saved even when the tests fail, which is exactly when you need it. And the app runs on the runner, so the result does not depend on a shared environment that someone else may have changed.</p>

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
  say: `<p>“The suite runs in GitHub Actions on every pull request and every push to main. The workflow checks out the code, starts the application on the runner, installs the test dependencies, runs pytest in parallel with an HTML and a JUnit report, and uploads the reports and the service logs as artifacts even on failure. A nightly scheduled run is a common addition, and the same commands work in Jenkins or GitLab.”</p>`,
  qa: [
    ['What triggers your pipeline?', '<p>Pull requests and pushes to main, plus a manual trigger. A schedule trigger can add nightly runs.</p>'],
    ['Why upload reports with if: always()?', '<p>Because later steps are normally skipped after a failure, and a failure is exactly when you need the report and logs.</p>'],
    ['How do tests get the right environment in CI?', '<p>Either the pipeline starts the app itself, as here, or it points the suite at a shared environment by setting the config environment variables, with secrets from the CI secret store.</p>'],
  ],
})}
`,
};
