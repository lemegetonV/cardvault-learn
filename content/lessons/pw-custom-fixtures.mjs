import { code, interview, figure, keyIdea, testerEye } from '../../src/components.mjs';
import { fixtureChain } from '../diagrams/playwright.mjs';

export default {
  minutes: 11,
  lede: 'Page objects need someone to make them: <code>new LoginPage(page)</code> at the top of every test would bring back the repetition the framework removed. Playwright’s answer is the same mechanism that gives you <code>page</code> and <code>request</code>: fixtures. You can add your own, and a test receives them just by naming them. This lesson reads CardVault’s <code>fixtures.ts</code>.',
  youWill: 'You will be able to write a custom fixture with test.extend, explain use(), and say when a fixture is built and by whom.',
  body: `
<h2>Fixtures, again</h2>
<p>In <a href="/learn/pw-builtin-fixtures/">built-in fixtures</a> a test listed what it needed, <code>async ({ page, request }) =&gt; ...</code>, and Playwright created each one for that test. A <strong>custom fixture</strong> works the same way, except that you write the code that creates it. Tests cannot tell the difference.</p>

<h2>Declaring the fixtures</h2>
${code({ lang: 'typescript', title: 'tests/ui/fixtures.ts', src: `
// Everything our own fixtures give a test, by name.
type CardVaultFixtures = {
  loginPage: LoginPage;
  walletPage: WalletPage;
  cardsPage: CardsPage;
  transactionsPage: TransactionsPage;
  transactionPage: TransactionPage;
  ...
  api: CardVaultApi;
  customer: Customer;
  ...
};
` })}
<p>The <code>...</code> lines hide four more names that Module 7 adds: three component objects (<code>toast</code>, <code>consentDialog</code>, <code>menu</code>) and <code>customerWithCard</code>.</p>
<p><code>type</code> gives a name to the shape of an object: here, which fixture names exist and what type each value has. TypeScript uses it to check that a test asking for <code>loginPage</code> really gets a <code>LoginPage</code>, and to suggest the page object’s methods as you type.</p>

<h2>Building them</h2>
${code({ lang: 'typescript', title: 'tests/ui/fixtures.ts', src: `
// test.extend makes a new \`test\` that has Playwright's fixtures and ours.
// Each fixture builds its value, hands it to the test with use(), and anything
// after use() runs when the test has finished.
export const test = base.extend<CardVaultFixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
` })}
<ul>
<li><code>base</code> is Playwright’s own <code>test</code>, imported under another name with <code>import { test as base }</code>. <code>base.extend(...)</code> returns a new <code>test</code> function that has all of Playwright’s fixtures plus ours.</li>
<li><code>&lt;CardVaultFixtures&gt;</code> in angle brackets passes the type to <code>extend</code>, so it knows the names and types of the new fixtures.</li>
<li>Each fixture is an <code>async</code> function. Its first parameter lists the fixtures it needs, exactly like a test: <code>loginPage</code> needs <code>page</code>.</li>
<li><code>use(value)</code> hands the value to the test and waits while the test runs. Code before <code>use</code> is set-up; code after it would be clean-up, and it runs even when the test fails.</li>
</ul>
<p>The file ends with <code>export { expect };</code>, so tests import both from one place: <code>import { test, expect } from '../fixtures';</code>. That import is the only change a test file needs to use the framework.</p>

<h2>A fixture that does real work</h2>
${code({ lang: 'typescript', title: 'tests/ui/fixtures.ts', src: `
  // A brand-new customer with one card in the wallet and one purchase on it,
  // already signed in. Only tests that ask for \`customer\` pay for this set-up.
  customer: async ({ api, loginPage }, use) => {
    const customer = await api.createCustomer(true);
    await api.makePurchase(customer, PURCHASE.merchant, PURCHASE.amountInCents);

    // The purchase reaches the transaction list a moment later. Wait until it is there.
    await expect.poll(() => api.countTransactions(customer)).toBe(1);

    await signIn(loginPage, customer);
    await use(customer);
  },
` })}
<p><code>customer</code> needs two other fixtures: <code>api</code> for the set-up and <code>loginPage</code> to sign in. <code>signIn</code> is a plain function near the top of the file: it opens the sign-in page, signs in, and waits for the wallet. A second fixture, <code>customerWithCard</code>, uses it too, for a customer whose card is not in the wallet yet. The API part is the subject of <a href="/learn/pw-api-setup/">the next lesson</a>. What matters here is the order Playwright builds things in:</p>
${figure({ svg: fixtureChain(), caption: 'Asking for one fixture pulls in everything it depends on. Each fixture is built once per test, so the test and customer share the same page.' })}
<ul>
<li><strong>On demand.</strong> A fixture is built only when a test, or another fixture, asks for it. The alice tests never name <code>customer</code>, so they never create one.</li>
<li><strong>Once per test.</strong> Within one test, every fixture is built once and shared. The <code>page</code> that <code>customer</code> signed in is the same <code>page</code> inside <code>transactionsPage</code>, which is why the test starts signed in.</li>
<li><strong>Fresh for every test.</strong> The next test gets new fixtures: a new page, new page objects, a new customer. Isolation from <a href="/learn/pw-hooks-isolation/">hooks and test isolation</a> still holds.</li>
</ul>

<h2>In a test</h2>
${code({ lang: 'typescript', title: 'tests/ui/tests/transactions.spec.ts', src: `
  test('the purchase is in the list', async ({ customer, transactionsPage }) => {
    await transactionsPage.open();

    await expect(transactionsPage.rows).toHaveCount(1);
    await expect(transactionsPage.rows.first()).toContainText(PURCHASE.merchant);
    await expect(transactionsPage.rows.first()).toContainText(PURCHASE.shownAs);
  });
` })}
<p>The test never uses the <code>customer</code> variable, yet it names it. Naming it is how the test says “I need a new customer with a purchase, signed in”; the fixture does the rest before the first line runs.</p>

${keyIdea('<p><code>base.extend&lt;Types&gt;({ ... })</code> adds fixtures. Each one lists the fixtures it needs, builds a value, and passes it to <code>use()</code>; code after <code>use()</code> cleans up. Fixtures are built on demand, once per test, and fresh for the next test.</p>')}

<h2>Fixtures or beforeEach?</h2>
<p>A <code>beforeEach</code> hook runs for every test in its file, whether the test needs it or not, and shares its values through variables declared outside the tests. A fixture runs only for tests that ask, hands its value straight to them, and can be reused from any file. Hooks still suit small things inside one file; fixtures suit set-up that many files share.</p>

${testerEye('<p>A test customer here is never deleted: the test environment can be reset, and every test makes its own, so leftovers do not get in the way. Where data must be removed, put the clean-up after <code>await use(...)</code> in the fixture. It runs even when the test fails, which a last line in the test would not.</p>')}

${interview({
  say: `<p>“We extend Playwright’s test with test.extend. Our fixtures create the page objects, an API client, and a customer fixture that creates a fresh customer with a purchase through the API and signs them in. Tests import test and expect from our fixtures file and simply name what they need. Fixtures are lazy, built once per test and isolated between tests, and any clean-up goes after use, so it runs even if the test fails.”</p>`,
  qa: [
    ['How do you create a custom fixture in Playwright?', '<p>Call <code>test.extend</code> with an object of fixture functions. Each takes the fixtures it depends on and a <code>use</code> function, builds its value, calls <code>await use(value)</code>, and does any teardown afterwards. Export the new <code>test</code> and import it in specs.</p>'],
    ['What is the difference between a fixture and beforeEach?', '<p>A hook runs for every test in its scope and passes values through outer variables. A fixture is on demand, reusable across files, passes its value directly, can depend on other fixtures, and keeps set-up and teardown together.</p>'],
    ['Can fixtures depend on each other?', '<p>Yes. A fixture lists other fixtures as parameters, and Playwright builds them first, once per test. In our framework <code>customer</code> uses <code>api</code> and <code>loginPage</code>, and <code>loginPage</code> uses <code>page</code>.</p>'],
  ],
})}
`,
};
