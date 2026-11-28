import { code, terminal, interview, table, keyIdea, testerEye } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'A full run is right before a merge. While you write or fix a test, you want one file, one test, or the handful that cover a feature. This lesson shows how to choose what runs: by file, by name, by tag and by project, and how to skip or focus tests from inside the code.',
  youWill: 'You will be able to run exactly the tests you need from the command line and mark tests to skip or focus.',
  body: `
<h2>From the command line</h2>
<p>Everything starts with <code>npx playwright test</code>, run in <code>tests/ui</code>. Words after it narrow the run. A plain word is matched against file paths:</p>
${table(['Command', 'Runs'], [
  ['`npx playwright test`', 'Every test in every project'],
  ['`npx playwright test learn/running.spec.ts`', 'One file'],
  ['`npx playwright test running`', 'Every file whose path contains “running”'],
  ['`npx playwright test learn/running.spec.ts:9`', 'The test that starts on line 9'],
])}
<p>To choose by the test’s name instead, use <code>-g</code>, short for <code>--grep</code>. It matches the full name, including any <code>describe</code> group:</p>
${terminal([['npx playwright test -g "wrong password"', `Running 1 test using 1 worker

  ✓  1 [learn] › learn/running.spec.ts:9:1 › a wrong password is refused @smoke (535ms)

  1 passed (1.2s)`]], 'Real output')}

<h2>Tags</h2>
<p>A <strong>tag</strong> is a label that starts with <code>@</code>. You give it to a test in an options object between the name and the function:</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/running.spec.ts', src: `
// Tags are labels you can choose tests by: npx playwright test --grep @smoke
test('the sign-in page opens', { tag: '@smoke' }, async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
});
` })}
<p>A <strong>smoke test</strong> is a quick check that the most important things work at all, run first so a broken build is spotted in seconds. Tags appear at the end of the test’s name, so <code>--grep @smoke</code> finds them, and <code>--grep-invert</code> runs everything else:</p>
${terminal([
  ['npx playwright test --grep @smoke', `Running 2 tests using 1 worker

  ✓  1 [learn] › learn/running.spec.ts:4:1 › the sign-in page opens @smoke (436ms)
  ✓  2 [learn] › learn/running.spec.ts:9:1 › a wrong password is refused @smoke (510ms)

  2 passed (1.6s)`],
  ['npx playwright test --grep-invert @smoke learn/running.spec.ts', `Running 2 tests using 1 worker

  ✓  1 [learn] › learn/running.spec.ts:20:1 › the sign-in page has a title in the browser tab (307ms)
  ✓  2 [learn] › learn/running.spec.ts:25:1 › the username field can be typed into (272ms)

  2 passed (1.3s)`],
], 'Real output')}
<p>Before running anything, <code>--list</code> shows which tests a command would pick:</p>
${terminal([['npx playwright test --list learn/running.spec.ts', `Listing tests:
  [learn] › learn/running.spec.ts:4:1 › the sign-in page opens
  [learn] › learn/running.spec.ts:9:1 › a wrong password is refused
  [learn] › learn/running.spec.ts:20:1 › the sign-in page has a title in the browser tab
  [learn] › learn/running.spec.ts:25:1 › the username field can be typed into
Total: 4 tests in 1 file`]], 'Real output')}

<h2>A test that must work every time</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/running.spec.ts', src: `
test('a wrong password is refused', { tag: '@smoke' }, async ({ page }) => {
  // A new made-up username on every run. CardVault locks a username after a
  // few wrong passwords, so reusing one name would lock it after a few runs.
  await page.goto('/login');
  await page.getByLabel('Username').fill(\`nobody-\${Date.now()}\`);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByTestId('login-error')).toHaveText('Wrong username or password.');
  await expect(page).toHaveURL('/login');
});
` })}
<p>This test once used the same made-up name every time. Run a few times in a row, it began to fail with “Too many attempts. The account is locked for a while.”, because the app was doing its job. <code>Date.now()</code> is the current time in milliseconds, so each run types a name nobody has used. A test that runs often must not wear down the state it depends on.</p>

<h2>Skipping and focusing in the code</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/running.spec.ts', src: `
test('the username field can be typed into', async ({ page, browserName }) => {
  // test.skip with a condition skips this test only where the condition is true.
  // browserName is a fixture: 'chromium', 'firefox' or 'webkit'.
  test.skip(browserName === 'webkit', 'An example of skipping one browser');

  await page.goto('/login');
  await expect(page.getByLabel('Username')).toBeEditable();
});
` })}
<p>Here the condition is never true, because the suite runs in Chromium, so the test runs. In a real suite, a condition skip records a known gap, such as a feature one browser does not support, with the reason in the report. The other markers:</p>
${table(['Marker', 'Effect'], [
  ['`test.only(...)`', 'Run only this test (or the tests marked only). For your own computer; never commit it'],
  ['`test.skip(...)`', 'Do not run it; reported as skipped'],
  ['`test.fixme(...)`', 'Skip it because it is broken and needs fixing; reported as skipped'],
  ['`test.fail(...)`', 'The test is expected to fail; it is reported as an error if it passes'],
  ['`test.slow()`', 'Triple the time limit for this test'],
])}
<p>A forgotten <code>test.only</code> would quietly turn a full CI run into a run of one test. Many projects add <code>forbidOnly: !!process.env.CI</code> to the config, which makes a CI run fail if one is left in.</p>

${keyIdea('<p>Narrow a run by file, line, name (<code>-g</code>), tag (<code>--grep @tag</code>) or project. Check with <code>--list</code> first. In the code, <code>skip</code>, <code>fixme</code> and <code>fail</code> record known gaps with a reason; <code>only</code> is for your own computer.</p>')}

<h2>More useful flags</h2>
${table(['Flag', 'What it does'], [
  ['`--project=learn`', 'Run one project (its dependencies run first)'],
  ['`--headed`', 'Show the browser window'],
  ['`--ui`', 'UI mode: pick tests, watch them and step through each action'],
  ['`--debug`', 'Open the inspector and pause before each action'],
  ['`--last-failed`', 'Run only the tests that failed last time'],
  ['`--repeat-each=5`', 'Run each test five times, to catch tests that fail only sometimes'],
  ['`--workers=1`', 'Run one test at a time'],
])}
<p>The <code>scripts</code> in <code>package.json</code> give the common ones short names: <code>npm test</code>, <code>npm run learn</code> and <code>npm run report</code>.</p>

${testerEye('<p>Tags work best when they describe purpose, not people or dates: <code>@smoke</code> for the quick gate, perhaps <code>@slow</code> or a feature name. Then a pipeline can run <code>--grep @smoke</code> on every push and the full suite before a release.</p>')}

${interview({
  say: `<p>“Day to day I run a single file or line, or filter by name with -g. We tag a few fast, critical tests @smoke and run them with --grep, and --list confirms what a filter picks. In code, I use test.skip with a condition and a reason for known gaps, fixme for broken tests, and never commit test.only; forbidOnly on CI catches it if someone does. To hunt a flaky test I use --repeat-each.”</p>`,
  qa: [
    ['How do you run only smoke tests?', '<p>Tag them, for example <code>{ tag: \'@smoke\' }</code>, and run <code>npx playwright test --grep @smoke</code>. <code>--grep-invert @smoke</code> runs the rest.</p>'],
    ['What is the difference between test.skip and test.fixme?', '<p>Both stop the test running and show it as skipped. <code>fixme</code> says the test is broken and should be fixed; <code>skip</code>, often with a condition, says the test does not apply in that situation. Both take a reason that appears in the report.</p>'],
    ['How do you stop test.only reaching CI?', '<p>Set <code>forbidOnly: !!process.env.CI</code> in the config. On CI, a run that finds <code>test.only</code> fails straight away instead of silently running one test.</p>'],
  ],
})}
`,
};
