import { code, terminal, interview, table, keyIdea, testerEye } from '../../src/components.mjs';

export default {
  minutes: 12,
  lede: 'A flaky test passes and fails without any change to the app or the test. It is the most expensive kind of test, because every failure has to be checked and people soon stop trusting the suite. This lesson uses three real flaky tests from writing this very suite: how they were found, what caused each one, and how each was fixed.',
  youWill: 'You will be able to find a flaky test, trace it to its cause and fix it without simply adding time.',
  body: `
<h2>Finding them: run things many times</h2>
<p>A test that fails one time in thirty will pass most runs, so a single run proves little. Playwright can repeat every test and run many at once, which also makes the machine busy, the condition under which timing problems show up:</p>
${terminal([['npx playwright test learn/config.spec.ts -g "Menu" --repeat-each 30 --workers 6 --retries 1', `Running 31 tests using 6 workers

  ✘  23 [learn] › learn/config.spec.ts:16:1 › on a narrow screen the links hide behind a Menu button (6.6s)

  1 flaky
    [learn] › learn/config.spec.ts:16:1 › on a narrow screen the links hide behind a Menu button
  30 passed (19.1s)`]], 'Real output, shortened, from the version before the fix')}
<p><code>--repeat-each 30</code> runs the test 30 times. <code>--retries 1</code> runs a failed test once more; a test that failed and then passed is reported as <strong>flaky</strong>, separately from passed and failed. Repeating the whole suite the same way, with <code>--repeat-each 4 --workers 4</code>, turned up three flaky tests in this track.</p>

<h2>Case 1: clicking before the page was ready</h2>
<p>The Menu test above. Its <a href="/learn/pw-debugging/">trace</a> showed the click landing on a page that looked finished but whose scripts had not started yet, so the click did nothing. Auto-waiting checks that the button is visible, stable and enabled, and it was. It cannot know that the page’s code is not yet listening. The fix waits for something that only appears once the page is fully running:</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/config.spec.ts', src: `
  // Wait until the wallet has loaded alice's cards. Until the page has
  // finished starting up, the Menu button may not respond to a click yet.
  await expect(page.getByTestId('wallet-cards').getByRole('listitem')).toHaveCount(4);
` })}
<p>The cards are fetched by the page’s own script, so when they are on screen, that script is running and the button will respond.</p>

<h2>Case 2: moving the clock too early</h2>
<p>The session-timeout tests in <a href="/learn/pw-time-devices/">time, places and devices</a> sometimes saw no warning at all. The page starts its timer only after asking the server how long the session has left. On a busy machine that answer was sometimes slower than the test, which moved the fake clock before the timer existed. The fix waits for the answer:</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/time.spec.ts', src: `
    const session = page.waitForResponse('**/api/auth/session');
    await signInAsAlice(page);
    await session;
` })}

<h2>Case 3: wearing out the data</h2>
<p>The wrong-password test in <a href="/learn/pw-running-tests/">running what you want</a> passed alone and failed when run repeatedly, with “Too many attempts. The account is locked for a while.” It always used the same made-up username, and CardVault locks a username after a few wrong passwords. Nothing was wrong with the timing. The test was changing state it relied on. The fix gives each run a new name with <code>Date.now()</code>.</p>

${keyIdea('<p>Flaky tests have causes. Find them by repeating tests under load, read the trace, and fix the cause: wait for a real sign that the app is ready, or give each test its own data. More time and more retries only hide the problem.</p>')}

<h2>Common causes and their fixes</h2>
${table(['Cause', 'Sign', 'Fix'], [
  ['Acting before the page is ready', 'Click passes, nothing happens', 'Wait for a sign the page is running, such as its data on screen'],
  ['Checking once instead of waiting', 'Fails on slow days', 'Web-first assertions, never a fixed pause'],
  ['A response that arrives after the check', 'Old value seen', 'Wait for the response or the new value'],
  ['Shared or used-up data', 'Fails in a full run, passes alone', 'A fresh customer or unique values per test'],
  ['Order between tests', 'Fails when run alone or in another order', 'Make each test set up what it needs'],
  ['Things that change by themselves', 'Times, dates, random values differ', 'Control them: fake clock, mocked data, masks'],
])}

<h2>Retries: a safety net, not a fix</h2>
${code({ lang: 'typescript', title: 'tests/ui/playwright.config.ts', src: `
  // Retry a failed test once on CI only. Locally, a failure stays a failure.
  retries: process.env.CI ? 1 : 0,
` })}
<p>One retry on CI keeps a rare hiccup in the environment from blocking everyone, and the report still marks the test as flaky so it gets looked at. Locally there are no retries, so you see every failure. A test that needs retries to pass regularly is a test to fix, or a bug in the app to report: sometimes the flakiness is real, and customers feel it too.</p>

${testerEye('<p>Treat a flaky test as a bug with a deadline. Look at the trace first, then ask whether the app or the test is at fault. A button that ignores clicks for a moment after the page appears is worth mentioning to developers, even after the test has been fixed to wait for it.</p>')}

${interview({
  say: `<p>“I find flaky tests with --repeat-each and several workers, which adds load, then read the trace. In our suite three came up: a click before the page’s scripts were ready, fixed by waiting for the page’s data; a fake clock moved before the app’s timer started, fixed by waiting for the session response; and a test locking a reused username, fixed with unique data. I avoid fixed waits and treat retries as a CI safety net, not a fix.”</p>`,
  qa: [
    ['What causes flaky UI tests?', '<p>Mostly timing and data: acting or checking before the app is ready, fixed sleeps, responses that arrive late, tests sharing or using up data, tests depending on order, and uncontrolled time or randomness. Sometimes the app itself is unreliable.</p>'],
    ['How do you find a flaky test?', '<p>Run it many times with <code>--repeat-each</code> and several workers, check the HTML report’s Flaky filter after CI runs, and open the traces of the failed attempts.</p>'],
    ['Are retries a good fix for flakiness?', '<p>No. One retry on CI can absorb rare environment problems, and Playwright marks such tests as flaky. The fix is to find and remove the cause, otherwise real intermittent bugs get hidden.</p>'],
  ],
})}
`,
};
