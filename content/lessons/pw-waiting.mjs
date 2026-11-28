import { code, figure, interview, table, keyIdea, testerEye } from '../../src/components.mjs';
import { sleepVsWait } from '../diagrams/playwright.mjs';

export default {
  minutes: 11,
  lede: 'Auto-waiting actions and retrying assertions handle most timing for you. A few moments still need a decision: a page that loads data in pages, an answer from the server you want to inspect, a change of page. This lesson shows how to wait for the thing that matters, and why a fixed pause is never the answer.',
  youWill: 'You will be able to choose the right wait for loading data and explain why waitForTimeout makes tests flaky.',
  body: `
<h2>Why not just pause?</h2>
<p>Playwright has a command that pauses a test for a fixed time: <code>page.waitForTimeout(2000)</code> waits two seconds. It is tempting when a test fails because something was not ready yet. It is also the most common mistake in UI tests.</p>
${figure({ svg: sleepVsWait(), caption: 'A fixed pause is either too long or too short. Waiting for a condition is as long as it needs to be.' })}
<p>A fixed pause guesses how long the app will take. On a quick day the guess wastes time, in every test, on every run. On a slow day, such as a busy CI machine, the guess is too short and the test fails although the app works. Playwright’s own documentation says <code>waitForTimeout</code> is for debugging only. Instead, wait for a <strong>condition</strong>: something on the page or the network that tells you the app is ready.</p>

<h2>The page: transactions, 20 at a time</h2>
<p>CardVault’s transactions page loads 20 rows from the server, shows “Loading transactions…” meanwhile, and has a “Load more” button for the next 20. alice has 55 transactions, so the button is pressed twice to see them all. This lesson’s tests sign in as alice and only read.</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/waiting.spec.ts', src: `
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait for the new page to open before going on.
  await page.waitForURL('/wallet');
});
` })}
<p><code>page.waitForURL('/wallet')</code> waits until the browser’s address is the wallet page. It matters here because the next step, <code>page.goto</code>, opens another page directly. Without it, the test could leave the sign-in page before the sign-in had finished, and arrive at the transactions page signed out. (<code>await expect(page).toHaveURL('/wallet')</code>, used in other files, does the same job as an assertion.)</p>

<h2>Wait for the rows</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/waiting.spec.ts', src: `
test('wait for the rows, not for the clock', async ({ page }) => {
  await page.goto('/wallet/transactions');

  // While the rows load, the page shows "Loading transactions…".
  // toHaveCount keeps checking until 20 rows are there.
  await expect(page.getByTestId('txn-row')).toHaveCount(20);
  await expect(page.getByText('Loading transactions')).not.toBeVisible();
});
` })}
<p>This is the most common wait, and it is just a <a href="/learn/pw-assertions/">web-first assertion</a>: describe what the page looks like when it is ready, and let the assertion retry until it does. The second line checks the other side: the loading message has gone.</p>

<h2>Wait for the server’s answer</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/waiting.spec.ts', src: `
test('wait for the server to answer', async ({ page }) => {
  await page.goto('/wallet/transactions');
  await expect(page.getByTestId('txn-row')).toHaveCount(20);

  // Start listening before the click, so the answer cannot arrive unnoticed.
  const answer = page.waitForResponse('**/api/wallet/transactions?*');
  await page.getByRole('button', { name: 'Load more' }).click();
  const response = await answer;

  expect(response.status()).toBe(200);
  await expect(page.getByTestId('txn-row')).toHaveCount(40);
});
` })}
<ol>
<li><code>page.waitForResponse(pattern)</code> waits for the browser to receive a response whose address matches the pattern. In the pattern, <code>**</code> means “anything before this” and <code>*</code> means “anything here”. It returns a promise.</li>
<li>Notice there is <em>no</em> <code>await</code> in front of it. The test stores the promise in <code>answer</code>, clicks, and only then awaits it. If it awaited first, it would wait for a response that only the click can cause, and hang. If it started listening after the click, a fast answer could arrive before anyone was listening. Many codebases write the same thing in one line, <code>const [response] = await Promise.all([page.waitForResponse(pattern), button.click()])</code>, which starts both and waits for both.</li>
<li><code>response.status()</code> is the HTTP status code. This is a plain <code>expect</code>, without <code>await</code>, because the response is already here.</li>
</ol>
<p>Use this when the response itself is part of what you test. When you only need the page to show the result, the row count alone is enough.</p>

<h2>Wait until something goes away</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/waiting.spec.ts', src: `
test('keep loading until there is nothing more', async ({ page }) => {
  await page.goto('/wallet/transactions');
  const loadMore = page.getByRole('button', { name: 'Load more' });

  await loadMore.click(); // rows 21 to 40
  await expect(page.getByTestId('txn-row')).toHaveCount(40);
  await loadMore.click(); // the last rows

  // alice has 55 transactions. When they are all shown, the button goes away.
  await expect(page.getByTestId('txn-row')).toHaveCount(55);
  await expect(loadMore).toBeHidden();
});
` })}
<p>The count check between the clicks matters. Without it, the second click could land while the first page of results was still loading. Each step waits for the result of the one before.</p>
<p>The expected numbers come from known data: alice’s 55 transactions, shown 20 at a time. They are not copied from what the page happened to show.</p>

${keyIdea('<p>Wait for a condition, never for a time: an assertion on the page, the URL, or a server response. Start listening for a response before the action that causes it.</p>')}

<h2>Which wait when</h2>
${table(['You need to wait for', 'Use'], [
  ['Something to appear, change or disappear on the page', '`await expect(locator).toBeVisible()`, `toHaveText`, `toHaveCount`, `toBeHidden`'],
  ['The page to change address', '`await page.waitForURL(url)` or `await expect(page).toHaveURL(url)`'],
  ['A server response you want to inspect', '`const answer = page.waitForResponse(pattern)` before the action, `await answer` after'],
  ['A value that is not on the page, such as data from an API', '`await expect.poll(async () => ...).toBe(value)`'],
  ['A fixed amount of time', 'Nothing: `waitForTimeout` is for debugging only'],
])}
<p><code>expect.poll</code> runs a function again and again until its result matches, like a web-first assertion for any value. The suite’s set-up helper uses it to wait until a new purchase shows up in a customer’s transactions; you will read it in <a href="/learn/pw-api-setup/">API set-up for UI tests</a>.</p>

${testerEye('<p>When a test fails only sometimes, look at what it waits for. A check that reads the page once, a click that fires while a list is reloading, or a fixed pause are the usual causes. The fix is to wait for the specific condition, not to add time; the lesson on <a href="/learn/pw-flaky-tests/">flaky tests</a> goes further.</p>')}

${interview({
  say: `<p>“I never use fixed sleeps. Actions auto-wait for their element, and for loading data I assert on the state the page should reach, like a row count or a message disappearing, which retries until it is true. When I need the response itself, I start waitForResponse before the click and await it after, so the answer can’t be missed. For values outside the page I use expect.poll.”</p>`,
  qa: [
    ['Why is waitForTimeout a bad idea?', '<p>It guesses how long the app needs. Too long wastes time on every run; too short fails on a slow machine although the app works. Waiting for a condition takes exactly as long as needed and documents what the test is waiting for.</p>'],
    ['Why start waitForResponse before the click?', '<p>The response can arrive very quickly after the click. If the test starts listening afterwards, it may miss it and hang until the timeout. Starting the wait first, storing the promise, then clicking and awaiting the promise avoids that race.</p>'],
    ['How do you handle a list that loads more items on demand?', '<p>Click Load more, then assert the new row count before the next click, so each click acts on a page that has finished loading. At the end, assert the total and that the button has gone. The expected numbers come from known test data.</p>'],
  ],
})}
`,
};
