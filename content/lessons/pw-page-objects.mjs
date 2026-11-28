import { code, interview, table, keyIdea, testerEye } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'A page object is a small class that knows one page of the app: where its fields and buttons are, and how to do things there. Tests call it instead of writing locators themselves. It is the best-known pattern in UI testing, and the first thing interviewers ask about. This lesson builds CardVault’s sign-in page object line by line, then shows the before and after.',
  youWill: 'You will be able to read and write a page object in TypeScript, and explain what belongs in it and what does not.',
  body: `
<h2>Before: the same lines everywhere</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/first-test.spec.ts', src: `
  await page.goto('/login');

  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill('CardVault-Demo-1');
  await page.getByRole('button', { name: 'Sign in' }).click();
` })}
<p>These four steps, give or take the password’s spelling, open more than twenty files in Part 1. They mix two kinds of knowledge: <em>what</em> the test does (sign in as alice) and <em>how</em> the page works (a field labelled Username, a button called Sign in). A page object takes the “how” away from the tests.</p>

<h2>The sign-in page object</h2>
${code({ lang: 'typescript', title: 'tests/ui/pages/LoginPage.ts', src: `
import { Page, Locator } from '@playwright/test';

// The sign-in page. A page object keeps a page's locators and actions in one
// place, so tests say what they do ("sign in") instead of how (fill, fill, click).
export class LoginPage {
  readonly page: Page;
  readonly username: Locator;
  readonly password: Locator;
  readonly signInButton: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.page = page;
    this.username = page.getByLabel('Username');
    this.password = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: 'Sign in' });
    this.error = page.getByTestId('login-error');
  }

  async open() {
    await this.page.goto('/login');
  }

  async signIn(username: string, password: string) {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.signInButton.click();
  }
}
` })}
<ul>
<li><strong>A class</strong> is a template for making objects that hold values and functions together. <code>export class LoginPage</code> defines one and lets other files import it. <code>new LoginPage(page)</code> makes an object from it.</li>
<li><strong>Fields.</strong> <code>readonly username: Locator</code> declares a value every <code>LoginPage</code> object holds, with its type. <code>readonly</code> means it is set once and never replaced. <code>Page</code> and <code>Locator</code> are Playwright’s own types, imported on the first line.</li>
<li><strong>The constructor</strong> runs once, when the object is made. It receives the browser page and builds each locator. <code>this</code> means “the object being made”, so <code>this.username = ...</code> stores the locator in the object’s field.</li>
<li>Building a locator does not touch the page, as you saw in <a href="/learn/pw-locators/">locators</a>. The constructor only describes where things are; nothing is searched until a test acts on a locator.</li>
<li><strong>Methods</strong> are functions that belong to the class. <code>open()</code> and <code>signIn()</code> are <code>async</code> because they wait for the browser, so callers write <code>await loginPage.signIn(...)</code>.</li>
</ul>

<h2>After: a test that says what it does</h2>
${code({ lang: 'typescript', title: 'tests/ui/tests/sign-in.spec.ts', src: `
test('a wrong password is refused', async ({ loginPage, page }) => {
  await loginPage.open();
  await loginPage.signIn(unusedUsername(), 'not-the-password');

  await expect(loginPage.error).toBeVisible();
  await expect(page).toHaveURL('/login');
});
` })}
<p>The test asks for <code>loginPage</code> by name, like a built-in fixture; <a href="/learn/pw-custom-fixtures/">custom fixtures</a> shows where it comes from. If the Sign in button is renamed, only <code>LoginPage.ts</code> changes, and every test keeps working.</p>

<h2>Locators that take a value</h2>
${code({ lang: 'typescript', title: 'tests/ui/pages/CardsPage.ts', src: `
  // One card in the list, found by the last four digits of its number.
  card(last4: string): Locator {
    return this.cards.filter({ hasText: \`•••• \${last4}\` });
  }

  // The card's "Available" amount, for example "$4,970.00".
  available(last4: string): Locator {
    return this.card(last4).getByTestId('card-available');
  }
` })}
<p>Some things on a page come in many copies: four cards, twenty rows. A method that takes a value and <strong>returns a locator</strong> covers them all. <code>card('4417')</code> narrows the list to one card, as in <a href="/learn/pw-narrowing/">narrowing a match</a>. It is not <code>async</code>, because making a locator does not wait for anything. The test then checks whatever it needs: <code>await expect(cardsPage.card('4417')).toBeVisible()</code>.</p>

<h2>An action with several steps</h2>
${code({ lang: 'typescript', title: 'tests/ui/pages/TransactionPage.ts', src: `
  // Fill in the dispute form and send it. The note and the receipt are optional.
  async openDispute(reason: string, note = '', receiptFile = '') {
    await this.disputeButton.click();
    await this.reason.selectOption({ label: reason });
    if (note) await this.note.fill(note);
    if (receiptFile) await this.receipt.setInputFiles(receiptFile);
    await this.openDisputeButton.click();
  }
` })}
<p><code>note = ''</code> gives a parameter a <strong>default value</strong>, so callers can leave it out: <code>openDispute('Wrong amount')</code> works. <code>if (note)</code> is true only for text that is not empty, so the optional fields are filled only when a value is given. The method is named after what a customer does, not after the clicks.</p>

${keyIdea('<p>A page object holds a page’s locators as fields, built in the constructor, and its actions as methods named after what a user does. Tests call those methods and keep the assertions for themselves.</p>')}

<h2>What goes where</h2>
${table(['In the page object', 'In the test'], [
  ['Locators, as fields or methods that return one', 'Which page objects to use, in which order'],
  ['Actions a user takes: open, sign in, filter, open a dispute', 'The data: which customer, which reason'],
  ['Waiting that is part of an action, when needed', 'Every `expect`: what must be true'],
])}
<p>Keeping assertions out of page objects means one page object serves every test: one test checks that a dispute opens, another that the note counter works, using the same methods. A page object that asserts would decide for the test what “correct” means.</p>

${testerEye('<p>Keep page objects plain: one class per page, no inheritance chains, no “base page” with dozens of helpers. When a part appears on many pages, such as a menu or a toast, a small class for that part is cleaner than copying it into every page object.</p>')}

${interview({
  say: `<p>“We use the Page Object Model. Each page of the app has a class in pages/ that takes Playwright’s page in its constructor, stores readonly locators for its fields and buttons, and has async methods for user actions, like signIn or openDispute. Methods that pick one item, like a card by its last four digits, return a locator. Assertions stay in the tests, so page objects can be reused and tests show what they verify.”</p>`,
  qa: [
    ['What is the Page Object Model and why use it?', '<p>A pattern where each page is a class holding its locators and actions. Tests call those methods, so locators live in one place, a UI change means one edit, and tests read as user steps.</p>'],
    ['Should page objects contain assertions?', '<p>Generally no. They describe and act; tests decide what must be true. Many teams allow small checks that an action finished, but expected results belong in the test, where they are visible and specific to that test.</p>'],
    ['How do you handle lists, like rows or cards, in a page object?', '<p>A field for the whole list and a method that takes a value and returns a filtered locator, for example <code>card(last4)</code>. Tests then assert on the returned locator.</p>'],
  ],
})}
`,
};
