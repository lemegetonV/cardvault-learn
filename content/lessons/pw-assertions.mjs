import { code, terminal, figure, interview, table, keyIdea, testerEye } from '../../src/components.mjs';
import { retryTimeline } from '../diagrams/playwright.mjs';

export default {
  minutes: 12,
  lede: 'An assertion is the line that decides whether a test passes. In a browser, the answer is often not ready yet: a list is still loading, a badge is about to change. Playwright’s web-first assertions solve this by checking again and again until the page matches. This lesson shows how they work and the ones you will use most.',
  youWill: 'You will be able to choose the right web-first assertion and explain why it does not need a wait.',
  body: `
<h2>The problem with checking once</h2>
<p>Imagine a check that reads the page once: “is the wallet heading on the screen right now?” If CardVault is a little slow today and the heading appears 300 milliseconds later, the check fails, even though the app is fine. Add a fixed pause before it and the test becomes slow every day, and still fails on a slower day. This is the classic cause of <strong>flaky</strong> UI tests: tests that pass and fail at random without any change.</p>

<h2>Web-first assertions</h2>
<p>Playwright’s assertions about the page, such as <code>expect(locator).toBeVisible()</code>, work differently. They find the element and check it, and if it does not match yet, they check again, and again, until it matches or a timeout passes. By default that timeout is 5 seconds. Playwright calls them <strong>web-first assertions</strong>; you may also hear “auto-retrying assertions”.</p>
${figure({ svg: retryTimeline(), caption: 'An illustration: the check runs several times while the page is loading and passes at the first check after the page changes.' })}
<p>You can see the retries in a real failure. When a soft check in this lesson’s file was changed to expect the wrong text, the call log said:</p>
${terminal([['npx playwright test', `    Error: expect(locator).toContainText(expected) failed

    Locator: getByRole('listitem').filter({ hasText: '4417' })
    Expected substring: "DEBIT"
    Received string:    "CREDIT •••• 4417Expires 06/29ENROLLEDRemove from wallet"
    Timeout: 5000ms

    Call log:
      - Expect "soft toContainText" getByRole('listitem').filter({ hasText: '4417' }) with timeout 5000ms
      - waiting for getByRole('listitem').filter({ hasText: '4417' })
        13 × locator resolved to <li class="card" data-testid="wallet-card-ca4d0000-a11c-4000-8000-000000000001">…</li>
           - unexpected value "CREDIT •••• 4417Expires 06/29ENROLLEDRemove from wallet"`]], 'Real output, with one expected value changed on purpose')}
<p><code>13 ×</code> means Playwright found the card and compared its text 13 times in 5 seconds before giving up. <code>Received string</code> is all the text inside the card, joined together.</p>

<h2>The assertions in this lesson’s file</h2>
<p>Every test signs in as alice first and finishes on her wallet page. They only read the page.</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/assertions.spec.ts', src: `
test('visible, and the text it shows', async ({ page }) => {
  const heading = page.getByRole('heading', { level: 1 });

  await expect(heading).toBeVisible();
  await expect(heading).toHaveText('Checkout wallet');
});

test('how many: alice has four cards', async ({ page }) => {
  await expect(page.getByTestId('wallet-cards').getByRole('listitem')).toHaveCount(4);
});
` })}
<ul>
<li><code>{ level: 1 }</code> asks for the top-level heading, the page title, whatever it says.</li>
<li><code>toHaveText</code> checks the element’s whole text. <code>toContainText</code>, below, checks part of it.</li>
<li><code>toHaveCount(4)</code> checks how many elements match. The cards arrive from the server after the page opens, so this check typically fails a few times quietly and then passes.</li>
</ul>
${code({ lang: 'typescript', title: 'tests/ui/learn/assertions.spec.ts', src: `
test('part of the text: why the prepaid card cannot be added', async ({ page }) => {
  const prepaid = page.getByRole('listitem').filter({ hasText: '5521' });

  await expect(prepaid).toContainText('Not eligible');
  // .not turns any check around: the prepaid card has no Add button.
  await expect(prepaid.getByRole('button', { name: 'Add to wallet' })).not.toBeVisible();
});

test('the page address and the browser tab title', async ({ page }) => {
  await expect(page).toHaveURL('/wallet');
  await expect(page).toHaveTitle(/CardVault/);
});
` })}
<ul>
<li><code>.not</code> reverses an assertion, and it waits too: <code>not.toBeVisible()</code> passes as soon as the element is not visible, or does not exist at all.</li>
<li>Assertions on <code>page</code> check the whole page: its address with <code>toHaveURL</code> and the browser tab’s title with <code>toHaveTitle</code>. <code>/CardVault/</code> is a pattern that means “contains CardVault”.</li>
</ul>

<h2>Soft assertions</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/assertions.spec.ts', src: `
test('soft assertions report every problem, not just the first', async ({ page }) => {
  const credit = page.getByRole('listitem').filter({ hasText: '4417' });

  // A failed soft check is recorded, and the test carries on to the next line.
  await expect.soft(credit).toContainText('CREDIT');
  await expect.soft(credit).toContainText('ENROLLED');
  await expect.soft(credit.getByRole('button', { name: 'Remove from wallet' })).toBeEnabled();
});
` })}
<p>A normal assertion stops the test at the first failure. <code>expect.soft</code> records the failure and lets the test carry on, so one run reports every problem with the card. The test is still marked failed at the end. In the real output above, two soft checks were changed to be wrong, and the report listed both errors.</p>

<h2>Web-first or plain?</h2>
<p>Not every <code>expect</code> waits. It depends on what you give it:</p>
${code({ lang: 'typescript', title: 'Example · the two kinds of expect', src: `
// Web-first: given a locator or the page. It retries, so it needs await.
await expect(page.getByTestId('card-list')).toBeVisible();

// Plain: given a value you already have. It checks once, straight away.
const count = await page.getByRole('listitem').count();
expect(count).toBe(4);
` })}
<p>The second form reads the page once, at that moment, and then compares a plain number. If the list is still loading, <code>count</code> may be 0 and the test fails. Prefer the web-first form whenever you are checking the page.</p>

${keyIdea('<p>Assertions on a locator or the page retry until they pass or 5 seconds go by. Use them instead of reading a value and comparing it, and never put a fixed wait in front of them.</p>')}

<h2>The assertions you will use most</h2>
${table(['Assertion', 'Passes when'], [
  ['`toBeVisible()` / `toBeHidden()`', 'The element is on screen / is not, or does not exist'],
  ['`toHaveText(text)`', 'Its whole text matches (a string or a pattern)'],
  ['`toContainText(text)`', 'Its text contains this'],
  ['`toHaveCount(n)`', 'The locator matches exactly n elements'],
  ['`toHaveValue(value)`', 'A field holds this value'],
  ['`toBeChecked()`', 'A checkbox or radio button is ticked'],
  ['`toBeEnabled()` / `toBeDisabled()`', 'A button or field can / cannot be used'],
  ['`toBeEmpty()`', 'A field holds no text, or an element has no content'],
  ['`toHaveAttribute(name, value)`', 'An attribute has this value'],
  ['`expect(page).toHaveURL(url)`', 'The browser’s address matches'],
  ['`expect(page).toHaveTitle(title)`', 'The tab title matches'],
])}
<p>To change the timeout for one check, pass it: <code>toBeVisible({ timeout: 10_000 })</code>. To change it for every check, set <code>expect: { timeout }</code> in the config.</p>

${testerEye('<p>Retrying is not the same as being lenient. The assertion still checks exactly what you wrote; it only gives the page time to get there. If the badge never turns to ENROLLED, the test fails after 5 seconds with the value it actually saw. A bigger timeout is right only when the product is allowed to take longer.</p>')}

${interview({
  say: `<p>“Playwright’s web-first assertions, like toBeVisible, toHaveText and toHaveURL, take a locator or the page and retry until the condition holds or the timeout passes, 5 seconds by default. That removes most timing flakiness without sleeps. I use plain expect only on values I already have, use expect.soft when I want every failure in one run, and keep timeouts at the default unless the requirement allows something slower.”</p>`,
  qa: [
    ['What is a web-first assertion?', '<p>An assertion on a locator or page that re-checks the condition until it passes or times out. Because the web page changes over time, checking repeatedly is more reliable than checking once after a guessed delay.</p>'],
    ['What is the difference between toHaveText and toContainText?', '<p><code>toHaveText</code> checks the whole text of the element, <code>toContainText</code> checks that the text includes a substring. Both accept a regular expression and both retry.</p>'],
    ['When would you use a soft assertion?', '<p>When several independent checks describe one screen and I want to see all the failures from one run, for example every field on a details card. The test still fails at the end. For steps that later steps depend on, I use normal assertions so the test stops early.</p>'],
  ],
})}
`,
};
