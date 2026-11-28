import { code, terminal, interview, table, keyIdea, shot, testerEye } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'An error message tells you which check failed. It does not always tell you why. For that you want to see what the browser saw at each step. Playwright records it all in a trace, and gives you tools to step through a test live. This lesson opens a real trace from a real intermittent failure and shows the other debugging tools.',
  youWill: 'You will be able to open a trace, read it step by step, and choose between the trace viewer, UI mode and the inspector.',
  body: `
<h2>A failure the error alone does not explain</h2>
<p>While this track was being written, a test from <a href="/learn/pw-config/">the config lesson</a> failed about once in thirty runs. It clicks the Menu button on a narrow screen, then expects the Cards link to appear. The error said only this:</p>
${terminal([['npx playwright test learn/config.spec.ts --repeat-each 30 --workers 6 --retries 1', `    Error: expect(locator).toBeVisible() failed

    Locator: getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Cards' })
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found

    > 24 |   await expect(cardsLink).toBeVisible();
         |                           ^`]], 'Real output, shortened, from the version before the fix')}
<p>So the link never appeared. But did the click happen? Did it hit the button? Was the page still loading? The error cannot say. The trace can.</p>

<h2>The trace viewer</h2>
<p>A <strong>trace</strong> is a recording of a test: every action and assertion, a snapshot of the page before and after each one, the network requests, the browser console and the test’s source. The config keeps one for every failed test (<code>trace: 'retain-on-failure'</code>). Many projects use <code>'on-first-retry'</code> instead, which records only when a failed test is retried: cheaper, but a test that fails without a retry leaves no trace. The error output prints the command to open it:</p>
${terminal([['npx playwright show-trace test-results/…/trace.zip', '']], 'Open a trace')}
${shot({ src: 'pw-trace-viewer.png', alt: 'The Playwright trace viewer. A timeline of page thumbnails across the top. On the left, the list of actions: Before Hooks, two expects, a Click on the Menu button taking 59 milliseconds, and a failed toBeVisible expect taking 5 seconds. In the middle, the page as it was: the wallet on a narrow screen with the Menu button and the navigation closed. Below, details of the failed call.', caption: 'The real trace of that failure. The Click on Menu passed in 59 ms, yet the page snapshot shows the menu still closed. The click landed, but the page did not react.' })}
<ul>
<li><strong>The action list</strong> on the left is the test, step by step, with timings. The failed step is red.</li>
<li><strong>The snapshot</strong> in the middle is the page at the selected step. The Before and After tabs show it on either side of an action.</li>
<li><strong>The tabs below</strong> show the call’s details, the log, any errors, the browser console, the network requests and the source line.</li>
<li><strong>The timeline</strong> across the top shows thumbnails over time, so you can see when the page changed.</li>
</ul>
<p>Here the trace answers the question. The click happened and passed, and the page was already showing alice’s wallet behind it. Yet after the click the navigation was still closed. The page had drawn its HTML, but its scripts had not finished starting up, so the button did not respond to the click yet. That pointed to the fix, explained in <a href="/learn/pw-flaky-tests/">flaky tests</a>: wait for a sign that the page is fully running before clicking.</p>

<h2>Naming the steps</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/debugging.spec.ts', src: `
  await test.step('sign in as alice', async () => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('alice');
    await page.getByLabel('Password').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/wallet');
  });
` })}
<p><code>test.step(name, async () =&gt; { ... })</code> groups lines under a name. In the trace and the HTML report the actions appear folded under “sign in as alice”, so a long test reads like a list of steps, and a failure names the step it happened in.</p>

<h2>Catching errors the page hides</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/debugging.spec.ts', src: `
  // Collect every error the page reports while the test runs.
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
` })}
<p>A page can look fine while its scripts fail in the background. <code>page.on('pageerror')</code> is called for every uncaught script error, and <code>page.on('console')</code> for every message the page writes to the browser console. The test collects the errors in a list, written <code>string[]</code> (“a list of strings”), and at the end checks <code>expect(errors).toEqual([])</code>: no errors at all.</p>

${keyIdea('<p>When the error message is not enough, open the trace: it shows every step, the page before and after it, the network and the console. Name long groups of actions with <code>test.step</code> so traces and reports read clearly.</p>')}

<h2>Debugging live</h2>
${table(['Tool', 'Command', 'Use it to'], [
  ['Trace viewer', '`npx playwright show-trace trace.zip`', 'Examine a run after it happened, including on CI'],
  ['UI mode', '`npx playwright test --ui`', 'Pick tests, run them, and see the same timeline and snapshots straight away; re-run on save'],
  ['Inspector', '`npx playwright test --debug`', 'Open a visible browser paused at the start, then step through action by action'],
  ['A pause in the code', '`await page.pause()`', 'Stop at one line and open the inspector there'],
  ['Headed run', '`npx playwright test --headed`', 'Simply watch the browser'],
  ['Locator picker', 'In UI mode or the inspector', 'Point at an element and get a suggested locator'],
])}
<p>The trace viewer is the one that works after the fact. A test that fails only on CI cannot be paused, but its trace can be downloaded from the run and opened on your computer, as <a href="/learn/pw-ci/">running in CI</a> shows.</p>

${testerEye('<p>Read a trace before changing the test. It is tempting to add a longer timeout and move on, but the trace usually shows the real cause: a click that landed too early, a request that failed, an element covered by a banner. Fixing the cause is what stops the failure coming back.</p>')}

${interview({
  say: `<p>“My first tool is the trace viewer. We keep traces for failed tests, including on CI, and a trace shows every action with before and after snapshots, network calls, console logs and the source line. For example, one intermittent failure looked like a missing menu link; the trace showed the Menu click had landed before the page’s scripts were ready. Locally I use UI mode or --debug to step through, and test.step to name the parts of long tests.”</p>`,
  qa: [
    ['What is a Playwright trace?', '<p>A zip file recording a test run: each action and assertion with DOM snapshots before and after, timings, network requests, console output and the test source. Open it with <code>npx playwright show-trace</code> or at trace.playwright.dev.</p>'],
    ['How do you debug a test that fails only on CI?', '<p>Keep traces on failure in CI, upload them as artifacts, download the trace and open it locally. It shows what the CI browser saw at every step, which usually reveals timing or data differences.</p>'],
    ['What is the difference between UI mode and --debug?', '<p>UI mode is a test explorer with a timeline: pick, run and re-run tests and inspect each step. <code>--debug</code> opens a visible browser and the inspector, paused at the start, so you can step through one run action by action.</p>'],
  ],
})}
`,
};
