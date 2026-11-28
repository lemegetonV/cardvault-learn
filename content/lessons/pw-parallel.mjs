import { code, terminal, interview, table, keyIdea, figure, testerEye } from '../../src/components.mjs';
import { shardsWorkers } from '../diagrams/playwright.mjs';

export default {
  minutes: 10,
  lede: 'A suite of a few hundred browser tests run one after another can take most of an hour. Playwright runs several tests at the same time, and can split a suite across machines, so the same suite finishes in minutes. This lesson shows how it does that, what it asks of your tests, and how CardVault’s suite behaves with one worker and with two.',
  youWill: 'You will be able to explain workers, parallel mode and sharding, and say what makes tests safe to run side by side.',
  body: `
<h2>Workers</h2>
<p>A <strong>worker</strong> is a separate process that runs tests, each with its own browser. Playwright starts several workers and hands them test files, one file at a time. By default it uses half of the computer’s processor cores; on a four-core machine that is two. The whole CardVault suite shows the difference:</p>
${table(['Command', 'Result'], [
  ['`npx playwright test`', '67 passed (28.8s), two workers'],
  ['`npx playwright test --workers=1`', '67 passed (46.0s), one worker'],
])}
<p>The same 67 tests, about a third less time. <code>--workers</code> on the command line, or <code>workers</code> in the config, sets the number. More workers is not always faster: each one runs a browser, and the app under test has to answer them all.</p>

<h2>Inside one file</h2>
<p>By default the tests in one file run in order, in one worker, which keeps a file’s tests from surprising each other. A file can ask for its tests to be shared out too:</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/parallel.spec.ts', src: `
// By default, the tests in one file run one after another in one worker.
// This line lets the tests in this file run at the same time in several workers.
test.describe.configure({ mode: 'parallel' });
` })}
${code({ lang: 'typescript', title: 'tests/ui/learn/parallel.spec.ts', src: `
// Each test only reads alice's data, so they cannot get in each other's way.
for (const path of ['/wallet', '/wallet/transactions', '/cards', '/profile']) {
  test(\`the page \${path} opens\`, async ({ page }, testInfo) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // parallelIndex says which worker ran this test: 0, 1, 2 ...
    console.log(\`worker \${testInfo.parallelIndex} opened \${path}\`);
  });
}
` })}
<ul>
<li><code>for (const path of [...])</code> repeats the block once for each item in the list, so this loop creates four tests. The backquotes make a <strong>template string</strong>: <code>\${path}</code> inside it is replaced by the value, so each test gets its own name.</li>
<li><code>testInfo.parallelIndex</code> is the number of the worker running the test. The test prints it, so the run shows who did what.</li>
</ul>
${terminal([['npx playwright test learn/parallel.spec.ts', `Running 5 tests using 2 workers
  ✓  1 [setup] › learn/saved-login.setup.ts:5:1 › sign in as alice and save the login (489ms)
worker 0 opened /wallet
  ✓  2 [learn] › learn/parallel.spec.ts:18:3 › the page /wallet opens (800ms)
worker 1 opened /wallet/transactions
  ✓  3 [learn] › learn/parallel.spec.ts:18:3 › the page /wallet/transactions opens (931ms)
worker 0 opened /cards
  ✓  4 [learn] › learn/parallel.spec.ts:18:3 › the page /cards opens (836ms)
worker 1 opened /profile
  ✓  5 [learn] › learn/parallel.spec.ts:18:3 › the page /profile opens (821ms)
  5 passed (3.3s)`]], 'Real output, blank lines removed')}
<p>Two workers took turns. With <code>--workers=1</code> every line says <code>worker 0</code> and the run takes 3.8s instead of 3.3s. The setup project from <a href="/learn/pw-saved-login/">logging in once</a> still runs first, whatever the number of workers. <code>fullyParallel: true</code> in the config does the same as this line for every file.</p>

${keyIdea('<p>Workers run test files side by side, each with its own browser. Parallel mode shares out the tests inside a file as well. Neither changes what a test does; both only work if no test depends on another.</p>')}

<h2>Sharding: more than one machine</h2>
<p>When one machine is not enough, <strong>sharding</strong> splits the suite into parts and runs each part on a different machine, usually separate CI jobs. <code>--shard=1/2</code> means “run the first half”:</p>
${figure({ svg: shardsWorkers(), caption: 'Two shards, each with two workers. Each shard runs about half of the files, and each worker in it takes files one at a time.' })}
${terminal([['npx playwright test --shard=1/2', `Running 35 tests using 2 workers, shard 1 of 2
  35 passed (16.3s)`], ['npx playwright test --shard=2/2', `Running 33 tests using 2 workers, shard 2 of 2
  33 passed (14.9s)`]], 'Real output, progress dots removed')}
<p>35 and 33 make 68, one more than the suite’s 67: each shard runs the setup step, because each machine needs its own saved login. Each shard writes its own report; the <code>blob</code> reporter from <a href="/learn/pw-reports/">reports and evidence</a> saves results so that <code>npx playwright merge-reports</code> can join them into one.</p>

<h2>What parallel runs ask of your tests</h2>
${table(['Rule', 'Why', 'In CardVault’s suite'], [
  ['No test relies on another', 'Order and worker are not fixed', 'Each test signs in or loads the saved login itself'],
  ['Tests that change data use their own data', 'Two workers could change the same thing at once', 'A new test customer per test that changes data'],
  ['Shared accounts are only read', 'Reading cannot disturb another test', 'Tests that use alice never change her data'],
  ['Unique values where needed', 'A name used twice can clash', 'The wrong-password test makes a new username each run'],
])}
<p>These are the same habits that prevent <a href="/learn/pw-flaky-tests/">flaky tests</a>. A test that fails only when run in parallel is usually sharing something it should not.</p>

${testerEye('<p>When a suite becomes slow, check first that tests are independent, then add workers, then shard on CI. If tests fail with more workers, the fix is in the data, not in fewer workers. Also watch the app: many workers at once is a small load test, and a test environment can struggle before the tests do.</p>')}

${interview({
  say: `<p>“Playwright runs test files in parallel worker processes, half the CPU cores by default. Tests inside a file run in order unless the file uses parallel mode or the config sets fullyParallel. To spread a large suite across CI machines we use --shard, and merge the blob reports afterwards. All of this relies on isolated tests: each test sets up its own state, tests that change data get their own customer, and shared accounts are read-only.”</p>`,
  qa: [
    ['What is a worker in Playwright?', '<p>An operating-system process that runs tests with its own browser. Workers share nothing, so tests in different workers cannot see each other’s pages or sign-ins. The count is set with <code>workers</code> or <code>--workers</code>.</p>'],
    ['What is the difference between workers and sharding?', '<p>Workers run tests in parallel on one machine. Sharding splits the suite between machines, with <code>--shard=1/3</code> and so on, each shard then using its own workers. Results are joined with <code>merge-reports</code>.</p>'],
    ['Your tests pass alone but fail in parallel. What do you look for?', '<p>Shared state: two tests changing the same account or record, a test relying on another having run first, or values such as names that clash. The fix is independent data per test, not fewer workers.</p>'],
  ],
})}
`,
};
