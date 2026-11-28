import { code, terminal, interview, keyIdea, shot, testerEye } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'Time for a real browser test: open CardVault’s sign-in page, sign in as alice and check that her wallet appears. It is one short file with nothing around it, so you can see every line. Then you will run it, watch it, and read the report.',
  youWill: 'You will be able to read, run and explain a complete Playwright test, line by line.',
  body: `
<h2>What the test should prove</h2>
<p>Before writing code, decide what a passing test means. For signing in, a customer expects two things: after entering a correct username and password, they land on their wallet, and the wallet page is actually shown. Those two facts come from how the product works, not from whatever the app happens to do today.</p>
${shot({ src: 'login.png', alt: 'The CardVault sign-in page with username and password fields and a Sign in button.', caption: 'The page the test starts on. alice is a demo customer; her password, <code>CardVault-Demo-1</code>, is known demo data.' })}

<h2>The test</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/first-test.spec.ts', src: `
import { test, expect } from '@playwright/test';

test('alice can sign in and see her wallet', async ({ page }) => {
  await page.goto('/login');

  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill('CardVault-Demo-1');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL('/wallet');
  await expect(page.getByRole('heading', { name: 'Checkout wallet' })).toBeVisible();
});
` })}
<p>Line by line:</p>
<ol>
<li><code>import { test, expect } from '@playwright/test';</code> takes two names out of the Playwright package. <code>test</code> declares a test; <code>expect</code> makes checks. The curly brackets mean “just these two names from that package”.</li>
<li><code>test('alice can sign in…', async ({ page }) =&gt; { ... })</code> declares one test. The first value is its name, which appears in the results, so write it as a sentence about behaviour. The second is the test itself: an <code>async</code> arrow function, as in <a href="/learn/pw-async-await/">the lesson on await</a>.</li>
<li><code>({ page })</code> asks Playwright for a <strong>page</strong>: a fresh tab in a fresh browser context, made just for this test and closed when it ends. Things a test asks for by name like this are called <strong>fixtures</strong>; the lesson on <a href="/learn/pw-builtin-fixtures/">built-in fixtures</a> explains them.</li>
<li><code>page.goto('/login')</code> opens a page. The address is short because the settings file names the base address, <code>http://localhost:3000</code>, and Playwright puts the two together.</li>
<li><code>page.getByLabel('Username')</code> finds the text field whose label says “Username”, the way a person would find it. <code>.fill('alice')</code> sets the field’s value to “alice”, replacing anything already in it.</li>
<li><code>page.getByRole('button', { name: 'Sign in' })</code> finds the button called “Sign in”. The <code>{ name: ... }</code> part is an <strong>object</strong>: values with names, in curly brackets. <code>.click()</code> clicks it. The next lesson, on <a href="/learn/pw-locators/">locators</a>, covers these ways of finding things.</li>
<li><code>expect(page).toHaveURL('/wallet')</code> checks that the browser’s address is now the wallet page.</li>
<li><code>expect(...heading...).toBeVisible()</code> checks that the “Checkout wallet” heading is on the screen.</li>
</ol>
<p>The blank lines split the test into three parts: get to the starting point, do the thing, check the result. Many teams call this <strong>arrange, act, assert</strong>.</p>

<h2>Playwright waits for you</h2>
<p>Notice what the test does not contain: no pauses, no “sleep for two seconds”. After the click, CardVault needs a moment to sign alice in and load the wallet. Playwright handles that in two places:</p>
<ul>
<li>Before <code>fill</code> and <code>click</code>, it waits until the element is there, visible and ready to use. This is <strong>auto-waiting</strong>.</li>
<li><code>expect(...).toHaveURL(...)</code> and <code>toBeVisible()</code> keep checking until the page matches, for up to 5 seconds, and only then fail. These are <strong>web-first assertions</strong>, covered in their <a href="/learn/pw-assertions/">own lesson</a>.</li>
</ul>

${keyIdea('<p>A Playwright test is an async function that receives a fresh <code>page</code>. It goes to a page, acts on it through locators, and checks the result with web-first assertions that wait for the page to catch up.</p>')}

<h2>Run it</h2>
<p>CardVault must be running on your computer, and the suite’s tools installed once (the lesson on <a href="/learn/pw-project/">the project</a> explains each step):</p>
${terminal([
  ['cd tests/ui', ''],
  ['npm install', ''],
  ['npx playwright install chromium', ''],
  ['npx playwright test learn/first-test.spec.ts', `Running 2 tests using 1 worker

  ✓  1 [setup] › learn/saved-login.setup.ts:5:1 › sign in as alice and save the login (549ms)
  ✓  2 [learn] › learn/first-test.spec.ts:6:1 › alice can sign in and see her wallet (557ms)

  2 passed (2.1s)`],
], 'Real output')}
<p>Each line names the <strong>project</strong> (<code>[learn]</code>, a group of tests with shared settings), the file and line, the test name and how long it took. The first line, <code>[setup]</code>, is a step the suite always runs first: it signs alice in once and saves the login for later lessons. Ignore it until <a href="/learn/pw-saved-login/">logging in once</a>; your test is line 2. A <strong>worker</strong> is one process that runs tests; with more files, Playwright uses several at once.</p>
<p>By default the browser is <strong>headless</strong>: it runs without a window, which is faster and works on servers. Two options let you watch:</p>
${terminal([
  ['npx playwright test --headed', ''],
  ['npx playwright test --ui', ''],
], 'Watching a run')}
<p><code>--headed</code> opens a real browser window. <code>--ui</code> opens UI mode, where you pick tests, run them, and step back through each action to see the page at that moment. You will use UI mode a lot in <a href="/learn/pw-debugging/">debugging</a>.</p>

<h2>The HTML report</h2>
<p>Every run also writes an HTML report. <code>npx playwright show-report</code> opens it in your browser:</p>
${shot({ src: 'pw-html-report.png', alt: 'The Playwright HTML report: six passed tests grouped by file, each with its duration.', caption: 'A real report after running two files from the suite. Click a test to see its steps; a failed test also shows its error, a screenshot and a recording.' })}

${testerEye('<p>Be honest about what the test proves. It shows that a correct sign-in reaches the wallet page and that the page is drawn. It does not check that alice’s four cards appear, or that a wrong password is refused. Those are separate tests, each with its own clear name, so that a failure tells you exactly what broke.</p>')}

${interview({
  say: `<p>“A Playwright test is an async function that gets a fresh page fixture: a new tab in an isolated browser context. My first test goes to the sign-in page, fills the fields found by their labels, clicks the button found by its role, and then checks the URL and the wallet heading with web-first assertions. There are no sleeps: actions auto-wait for the element, and assertions retry until the page matches or a timeout passes.”</p>`,
  qa: [
    ['What does the page fixture give you?', '<p>A new browser tab in a new, isolated browser context, created for this test and closed after it. Every test gets its own, so no cookies or sign-ins leak between tests.</p>'],
    ['Why is there no wait after clicking Sign in?', '<p>Because <code>expect(page).toHaveURL()</code> and <code>toBeVisible()</code> are web-first assertions: they keep checking until the page matches, up to a timeout. Actions such as <code>click()</code> also wait until their element is ready. A fixed sleep would be slower and still fail on a slow day.</p>'],
    ['What is the difference between headed, headless and UI mode?', '<p>Headless runs the browser with no window, the default, fast and fine for CI. Headed shows the browser window so you can watch. UI mode is an interactive app for picking tests, watching them run and stepping back through every action.</p>'],
  ],
})}
`,
};
