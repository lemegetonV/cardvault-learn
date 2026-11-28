import { code, interview, keyIdea, testerEye, task, reveal } from '../../src/components.mjs';

export default {
  minutes: 13,
  lede: 'Many Playwright interviews include a short live task: “here is a page, write a test for it”, or “here is a test, make it better”. The interviewer watches how you think as much as what you type. This lesson gives a routine to follow out loud, then three tasks of rising difficulty, each with hints and a model solution that was run against CardVault.',
  youWill: 'You will be able to write a Playwright test, a page object and an improved version of a weak test, while explaining your choices out loud.',
  body: `
<h2>A routine to say out loud</h2>
<ol>
<li><strong>Restate the goal as a user would.</strong> “So the customer signs in and should see four cards.”</li>
<li><strong>Say where the expected values come from.</strong> Known demo data, a requirement, or data the test creates.</li>
<li><strong>Pick locators the way a user finds things.</strong> Role and label first, a test id when nothing else fits, as in <a href="/learn/pw-locators/">locators</a>.</li>
<li><strong>Write the smallest test that passes, and run it.</strong> A green run early proves the set-up.</li>
<li><strong>Check results with web-first assertions.</strong> Never a fixed pause.</li>
<li><strong>Say what you would add with more time.</strong> Negative cases, a page object, a phone run.</li>
</ol>

<h2>Task 1: a plain test</h2>
${task(`<p>CardVault runs at <code>http://localhost:3000</code>, which is the <code>baseURL</code>. The demo customer <code>alice</code> (password <code>CardVault-Demo-1</code>) has four cards. Write one test, with no page objects, that signs in as alice, opens the Cards page, and checks that there are four cards and that the card ending 4417 is a credit card.</p>
<ul>
<li>The sign-in form has fields labelled Username and Password and a Sign in button, and leads to <code>/wallet</code>.</li>
<li>The Cards page lists cards in an element with test id <code>card-list</code>; each card shows text like <code>CREDIT •••• 4417</code>.</li>
</ul>`)}
${reveal('Hint 1: the shape', `<p>Three parts: sign in (and wait for <code>/wallet</code>), open <code>/cards</code>, then two checks. Narrow the list to one card with <code>filter({ hasText: ... })</code>.</p>`)}
${reveal('Hint 2: the trap', `<p>Going to <code>/cards</code> straight after clicking Sign in can land on the sign-in page again, because the login cookie arrives with the sign-in response. What should you wait for first?</p>`)}
${reveal('A model solution', `${code({ lang: 'typescript', title: 'Example · tests/practice/cards.spec.ts', src: `
import { test, expect } from '@playwright/test';

test('alice sees her four cards, including the credit card 4417', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill('CardVault-Demo-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');

  await page.goto('/cards');
  const cards = page.getByTestId('card-list').getByRole('listitem');
  await expect(cards).toHaveCount(4);
  await expect(cards.filter({ hasText: '•••• 4417' })).toContainText('CREDIT');
});
`})}<p>Say while writing: “I wait for <code>/wallet</code> because the cookie comes with the response. Four comes from the demo data, not from looking at the page.”</p>`, 'answer')}

<h2>Task 2: a page object</h2>
${task(`<p>Add a page object for the Profile page at <code>/profile</code>. It has a heading <em>Profile</em> and an email field with test id <code>profile-email</code>. Then write a test, starting from alice’s saved login (<code>ALICE_LOGIN</code> from <code>config.ts</code>), that checks her email is <code>alice@example.com</code>.</p>`)}
${reveal('Hint 1: the class', `<p>Copy the shape of <code>LoginPage</code> from <a href="/learn/pw-page-objects/">page objects</a>: readonly fields, a constructor that takes <code>page</code> and builds the locators, and an <code>open()</code> method.</p>`)}
${reveal('Hint 2: the field', `<p>The email is in an input. Which assertion checks what is typed in an input: <code>toHaveText</code> or <code>toHaveValue</code>?</p>`)}
${reveal('A model solution', `${code({ lang: 'typescript', title: 'Example · tests/practice/profile.spec.ts', src: `
import { test, expect, Page, Locator } from '@playwright/test';
import { ALICE_LOGIN } from '../../config';

class ProfilePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly email: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Profile' });
    this.email = page.getByTestId('profile-email');
  }

  async open() {
    await this.page.goto('/profile');
  }
}

test.use({ storageState: ALICE_LOGIN });

test('alice’s profile shows her email', async ({ page }) => {
  const profilePage = new ProfilePage(page);
  await profilePage.open();
  await expect(profilePage.heading).toBeVisible();
  await expect(profilePage.email).toHaveValue('alice@example.com');
});
`})}<p>In the real framework the class would go in <code>pages/ProfilePage.ts</code> with a fixture in <code>fixtures.ts</code>, so tests could ask for <code>profilePage</code> by name. Say so: it shows you know where things belong.</p>`, 'answer')}

<h2>Task 3: improve a weak test</h2>
${task(`<p>A colleague wrote this test. It passes most of the time. Explain what is wrong with it, then rewrite it.</p>
${code({ lang: 'typescript', title: 'Example · a weak test', src: `
test('settled filter', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#username').fill('alice');
  await page.locator('#password').fill('CardVault-Demo-1');
  await page.locator('form button').click();
  await page.goto('/wallet/transactions');
  await page.locator('select').selectOption('SETTLED');
  await page.locator('button.btn-primary').click();
  await page.waitForTimeout(3000);
  const rows = await page.locator('.txn').count();
  expect(rows).toBeGreaterThan(0);
});
`})}`)}
${reveal('Hint: count the problems', `<p>There are at least five: how elements are found, a missing wait after sign-in, a fixed pause, a check that does not wait, and a check that would pass even if the filter did nothing.</p>`)}
${reveal('A model answer', `<ul>
<li><strong>Locators by structure.</strong> <code>#username</code>, <code>form button</code> and <code>.txn</code> break when the page’s markup changes. Use labels, roles and test ids.</li>
<li><strong>No wait after sign-in.</strong> The <code>goto</code> can race the login cookie. Wait for <code>/wallet</code>.</li>
<li><strong>A fixed pause.</strong> Three seconds is too long on a fast day and too short on a slow one.</li>
<li><strong>A check that does not wait.</strong> <code>count()</code> answers once; <code>expect(...)</code> on a number cannot retry.</li>
<li><strong>A check that proves little.</strong> More than zero rows would be true without the filter. Check the filter’s effect.</li>
</ul>
${code({ lang: 'typescript', title: 'Example · the rewrite', src: `
test('settled transactions are shown after filtering', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill('CardVault-Demo-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');

  await page.goto('/wallet/transactions');
  await page.getByLabel('Status').selectOption('SETTLED');
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(page).toHaveURL(/status=SETTLED/);
  await expect(page.getByTestId('txn-row').first()).toBeVisible();
  // The filter's effect: no row shows any other status.
  await expect(page.getByTestId('txn-status').filter({ hasNotText: 'SETTLED' })).toHaveCount(0);
});
`})}<p>The last line is the one that proves the filter worked: rows are there, and none has another status. With the framework, these lines become the <code>filter to settled transactions</code> test in <a href="/learn/pw-framework-map/">the framework map</a>.</p>`, 'answer')}

${keyIdea('<p>In live coding, say the goal, the source of each expected value and your locator choice before typing. Write the smallest passing test, then improve it. When reviewing code, name each problem and its risk before fixing it.</p>')}

${testerEye('<p>Interviewers forgive a typo; they remember silence and guessing. If you forget an API, say what you want it to do (“I need to wait until the URL changes”) and reach for the closest thing you know. That is how you work on the job, too.</p>')}

${interview({
  say: `<p>“I’d start by restating what the user does and where the expected values come from, then write the smallest test with role and label locators and web-first assertions, run it, and only then refactor into a page object or add cases. I never use fixed waits; I wait for the URL or for the element that proves the step finished.”</p>`,
  qa: [
    ['How do you approach a live Playwright coding task?', '<p>Clarify the behaviour and the data, list the cases, write the simplest test with user-facing locators, run it early, then improve: page object, more cases, what I’d add with time.</p>'],
    ['What do you look for when reviewing someone’s Playwright test?', '<p>Brittle CSS or XPath locators, fixed waits, assertions that don’t wait, checks that would pass without the feature working, missing set-up waits, shared data and tests that depend on each other.</p>'],
    ['Why is waitForTimeout a problem?', '<p>It waits a fixed time whatever the page does: slow when the page is fast, flaky when the page is slow. Waiting for a condition, such as an element or a URL, is both faster and reliable.</p>'],
  ],
})}
`,
};
