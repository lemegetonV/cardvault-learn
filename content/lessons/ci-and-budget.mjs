import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table } from '../../src/components.mjs';
import { ciFlow } from '../diagrams/testing.mjs';

export default {
  minutes: 8,
  lede: 'This lesson is optional depth. CardVault runs its whole stack, ten containers in CI, inside a single GitHub Actions runner on every push. That is only possible because it was designed to fit. This lesson shows what CI does today and the resource budget your test suites will have to live within.',
  youWill: 'You will learn what CardVault’s CI checks, how the stack is squeezed onto a small runner, and what that means for the suites you will add.',
  body: `
<h2>What runs on every push</h2>
<p><strong>Continuous integration</strong> (CI) means every change is built and checked automatically, so problems show up within minutes of being pushed. CardVault’s workflow, <code>app-ci.yml</code>, has two jobs.</p>
${figure({ svg: ciFlow() })}
<p>The first job is quick and needs no running stack: Python lint and format checks, a check that the published event schemas match the code, and a type check and lint of the web app with no warnings allowed. The second job, <strong>stack-smoke</strong>, builds every image, starts the full stack, seeds it and runs <code>make smoke</code>, the end-to-end script you met in <a href="/learn/running-cardvault/">Running CardVault</a>.</p>
<p>Whatever happens, the job then records each container’s memory and CPU use in the run’s summary, uploads the logs of every service as an artifact kept for 7 days, and tears the stack down. A failed run still leaves its evidence behind.</p>

<h2>Fitting into a small machine</h2>
<p>CardVault is sized for a GitHub-hosted runner with 2 virtual CPUs and 8 GB of memory, the smallest it can expect, and the whole stack must fit there alongside the tests. A CI override file, <code>docker-compose.ci.yml</code>, makes that work:</p>
${table(['Change', 'Why'], [
  ['A memory limit on every container: 256 MB for each Python service and the web app, 512 MB for Postgres, 1.5 GB for Redpanda', 'No container can starve the others'],
  ['Redpanda in development mode, one CPU, 1 GB', 'The event bus is the largest single cost'],
  ['No Redpanda Console', 'A tool for people, not needed by tests'],
  ['INFO logs', 'Less output to store and read'],
  ['Image layers cached per image', 'Later runs rebuild only what changed'],
])}
<p>The recorded measurements in CardVault’s architecture notes show the full stack healthy in 35 to 38 seconds on a 2-vCPU runner, using a little under 1 GB of memory after the smoke test. The stated targets are under 3 minutes to start and under 5 GB with tests running.</p>
${keyIdea(`<p>A test environment has a budget, like any other system. Knowing it up front shapes how many tests run in parallel, how long waits can be, and what evidence you keep.</p>`)}

<h2>What this means for the test suites</h2>
<p>The pytest and Playwright suites in the later tracks will run in this same kind of job, against a stack started inside the runner. Three consequences follow:</p>
<ul>
<li><strong>Parallelism is limited.</strong> With 2 CPUs, a handful of parallel workers is plenty; more will slow everything down.</li>
<li><strong>Waits must be short and bounded.</strong> Test mode already shortens retry delays for this reason: relay retries start at 0.2 seconds and cap at 2.</li>
<li><strong>Evidence must be collected on failure.</strong> Logs, correlation IDs and screenshots are what make a red CI run understandable.</li>
</ul>
<p>Scheduled runs against stage, where seeded bugs are on, would be a separate job: the same tests, pointed at a different environment through configuration.</p>
${testerEye(`<p>Treat CI timing as a signal. If the smoke stage or your suite suddenly takes much longer, something changed: a slower start, a wait that now always times out, a leak. The resource summary in each run makes such drift visible before it becomes a failure.</p>`)}
${realWorld(`<p>Larger organisations run tests against shared, long-lived environments, or start short-lived ones in Kubernetes for each change. Both cost far more than one runner. Starting everything inside the CI job is the cheapest way to get an isolated, realistic environment, as long as the system is designed to fit.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Continuous integration (CI)', 'Building and checking every change automatically as it is pushed.'],
  ['Runner', 'The machine that executes a CI job. CardVault is sized for a 2-vCPU, 8 GB one.'],
  ['Artifact', 'A file a CI run keeps after it ends, such as service logs.'],
  ['Resource budget', 'The CPU, memory and time a test environment may use.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'The stack-smoke job fails during `make smoke`. Are the service logs still available?',
  options: ['No, a failed job keeps nothing', 'Yes: collecting and uploading logs runs always, even after a failure', 'Only if you re-run it', 'Only the web app’s'],
  answer: 1,
  why: '<p>The resource, log and tear-down steps run whatever the outcome, so a failure leaves its evidence.</p>',
})}
${check({
  q: 'Why does test mode use much shorter retry delays than normal mode?',
  options: ['To hide errors', 'So tests that exercise retries finish in seconds within CI’s time budget', 'Because the clock is moved', 'Normal mode does not retry'],
  answer: 1,
  why: '<p>Retry delays run on real time. Short delays keep fault and recovery tests fast enough to run on every push.</p>',
})}

<h2>Recap</h2>
${recap([
  'CI runs a quick checks job and a full stack-smoke job on every push.',
  'Logs and resource use are kept even when the run fails.',
  'A CI override fits the stack into 2 vCPUs and 8 GB with memory limits.',
  'The stack starts in well under a minute and uses about 1 GB.',
  'Future suites must keep parallelism modest, waits bounded and evidence collected.',
])}
`,
};
