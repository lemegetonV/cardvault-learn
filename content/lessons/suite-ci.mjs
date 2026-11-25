import { figure, keyIdea, testerEye, terms, check, recap, code } from '../../src/components.mjs';
import { ciPipeline } from '../diagrams/suite.mjs';

export default {
  minutes: 12,
  lede: 'A suite that only runs when someone remembers to run it protects very little. Continuous integration (CI) runs it on every change, on a clean machine, and blocks a change that breaks something. This lesson walks through the GitHub Actions workflow that runs CardVault’s API suite, step by step, and the choices that make its results trustworthy.',
  youWill: 'You will learn when the workflow runs, how it starts a whole CardVault inside the runner, why the serial pass runs even after a failure, and what evidence it keeps.',
  body: `
<h2>A clean machine for every change</h2>
<p><strong>GitHub Actions</strong> runs <strong>workflows</strong>, files in <code>.github/workflows/</code> that list <strong>jobs</strong>, each made of <strong>steps</strong>. Each job gets a fresh virtual machine, a <strong>runner</strong>, which is thrown away afterwards. Nothing carries over from an earlier run, so a pass in CI cannot depend on something left behind on someone’s laptop.</p>
${code({ title: '.github/workflows/api-tests.yml (part)', lang: 'yaml', src: `
on:
  push:
    branches: [main, test/api]
  pull_request:
  workflow_dispatch:

concurrency:
  group: api-tests-\${{ github.event.pull_request.number || github.ref }}-\${{ github.event_name }}
  cancel-in-progress: true
` })}
<p>The workflow runs on pushes to the two branches that matter, on every pull request, and on demand (<code>workflow_dispatch</code> adds a “Run workflow” button). The <code>concurrency</code> block gives each pull request its own group and cancels an older run when a newer push arrives, so the runner does not spend time testing code that has already been replaced.</p>

<h2>The two jobs</h2>
${figure({ svg: ciPipeline(), caption: 'Lint is fast and runs beside the tests. The dashed steps run whatever happened above them, so evidence exists for every run.' })}
<p>The <strong>lint</strong> job runs <code>ruff</code>, a Python linter and formatter, over the suite’s own code. It fails on style problems and likely mistakes such as unused imports. It is a separate job so a formatting slip is reported within a minute, without waiting for the stack to start.</p>
<p>The <strong>api-tests</strong> job does the real work. Its first step uses a shared action in the repository that starts the whole CardVault stack in the runner with Docker, with the CI memory settings from the first track’s <a href="/learn/ci-and-budget/">CI and the resource budget</a>, and waits until it is ready. Then <code>uv sync --frozen</code> installs exactly the versions in the lock file (<code>--frozen</code> refuses to change it), and the tests run in the two passes from <a href="/learn/suite-parallel-serial/">Parallel and serial tests</a>.</p>

<h2>Running the second pass after a failure</h2>
${code({ title: '.github/workflows/api-tests.yml (part)', lang: 'yaml', src: `
      - name: Run the suite in parallel
        working-directory: tests/api
        env:
          TEST_ENV: local
        run: >
          uv run pytest -n auto
          --alluredir allure-results
          --junitxml reports/junit-parallel.xml

      - name: Run the serial tests (shared clock, faults) on their own
        if: success() || failure()
        working-directory: tests/api
        env:
          TEST_ENV: local
        run: >
          uv run pytest -m serial
          --alluredir allure-results
          --junitxml reports/junit-serial.xml
` })}
<p>By default, a step is skipped once an earlier step has failed. Here that would hide information: if one parallel test fails, you still want to know whether the serial tests pass. <code>if: success() || failure()</code> runs the step in both cases (but not if the run was cancelled). <code>--junitxml</code> writes results in JUnit XML, a format almost every CI tool can read and display. Both passes write to the same <code>allure-results</code> folder, so one report covers them.</p>
<p>The <code>&gt;</code> after <code>run:</code> is YAML’s folded style: the indented lines below are joined into one line, which keeps a long command readable.</p>

<h2>Evidence that outlives the runner</h2>
<p>The runner disappears when the job ends, so anything worth keeping must be uploaded. The last steps all carry <code>if: always()</code>: they build the Allure report, save every container’s logs, upload those together with the JUnit files as one downloadable <strong>artifact</strong> kept for 14 days, and finally stop the stack. A failed run therefore leaves exactly the evidence that <a href="/learn/suite-evidence/">Evidence when a test fails</a> described: the requests with their correlation IDs, and the logs to search them in.</p>
${keyIdea(`<p>CI runs the suite on a fresh machine for every change, keeps going after a failure so the whole picture is reported, and uploads its evidence before the machine is thrown away.</p>`)}
${testerEye(`<p>When CI is red and your machine is green, compare the two runs’ evidence before changing anything. The usual differences are timing (CI machines are slower and busier), versions (the lock file versus what is installed locally) and leftover state on your machine that CI does not have.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Continuous integration (CI)', 'Running the build and tests automatically on every change.'],
  ['Workflow', 'A GitHub Actions file listing when to run and which jobs to run.'],
  ['Runner', 'The fresh virtual machine a job runs on, thrown away afterwards.'],
  ['Artifact', 'Files a workflow uploads so they can be downloaded after the run.'],
  ['JUnit XML', 'A common file format for test results that most CI tools can display.'],
  ['Linter', 'A tool that checks code for style problems and likely mistakes without running it.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'The parallel pass fails. Without `if: success() || failure()`, what would happen to the serial pass?',
  options: ['It would run anyway', 'It would be skipped, so the run would say nothing about the serial tests', 'It would fail too', 'It would run first'],
  answer: 1,
  why: '<p>Steps are skipped after a failure by default. The condition makes the serial pass run regardless, so one failure does not hide the state of seventeen other tests.</p>',
})}
${check({
  q: 'Why are the logs and the Allure report uploaded as an artifact instead of left on the runner?',
  options: ['To save time', 'The runner is deleted when the job ends, so anything not uploaded is lost', 'GitHub requires it', 'To share them publicly'],
  answer: 1,
  why: '<p>Each job’s machine is temporary. Uploading the evidence is the only way to read it after the run, which is exactly when a failure needs it.</p>',
})}
${check({
  q: 'Two pushes to the same pull request arrive a minute apart. What does the `concurrency` block do?',
  options: ['Runs both in full', 'Cancels the run for the older push, so only the newer code is tested', 'Queues the second until tomorrow', 'Merges them'],
  answer: 1,
  why: '<p>Both runs share a group, and <code>cancel-in-progress</code> stops the older one. Its result would describe code that has already been replaced.</p>',
})}

<h2>Recap</h2>
${recap([
  'The workflow runs on pushes, pull requests and on demand, on a fresh runner each time.',
  'Lint runs beside the tests; the tests start a whole stack, then run two passes.',
  'The serial pass runs even after a failure, so the full picture is reported.',
  'Reports, JUnit files and logs are uploaded as one artifact before the runner is thrown away.',
])}
`,
};
