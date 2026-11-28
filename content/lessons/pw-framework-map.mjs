import { code, terminal, interview, tree, figure, keyIdea, testerEye } from '../../src/components.mjs';
import { frameworkLayers } from '../diagrams/playwright.mjs';

export default {
  minutes: 10,
  lede: 'Part 1 kept every test in one plain file, with every click written out. That is the clearest way to learn, and it stops scaling quickly: sign-in is written out dozens of times, and a renamed button means changing every file that clicks it. A test framework is the small set of shared pieces that fixes this. This lesson gives you the map of CardVault’s framework before the next four lessons open each piece.',
  youWill: 'You will be able to name each folder of the framework, say what it is for, and follow one test through it.',
  body: `
<h2>The problem the framework solves</h2>
<p>Count the sign-ins in Part 1: the same four lines open more than twenty test files. If the Sign in button were renamed tomorrow, every one of those files would need the same change.</p>
<p>A framework puts each kind of knowledge in exactly one place. How to find things on a page lives in a page object. How to create a customer lives in an API client. Which values the tests use lives in a data file. Tests are left with one job: saying what they check.</p>

<h2>The folders</h2>
${tree([
  ['playwright.config.ts', 1, 'Adds two projects for the tests/ folder: framework, and phone'],
  ['config.ts', 1, 'Where the app is (from Part 1, unchanged)'],
  ['fixtures.ts', 1, 'Our own fixtures: page objects, the API client, a new customer'],
  ['pages/', 1, 'One page object per page of the app'],
  ['LoginPage.ts', 2, 'Sign in'],
  ['WalletPage.ts', 2, 'The Checkout wallet and its cards'],
  ['CardsPage.ts', 2, 'The Cards page'],
  ['TransactionsPage.ts', 2, 'The transaction list and its filters'],
  ['TransactionPage.ts', 2, 'One transaction, and the dispute form'],
  ['components/', 1, 'Parts that appear on many pages (met in Module 7)'],
  ['Toast.ts, ConsentDialog.ts, Menu.ts', 2, 'Messages, the wallet terms, the phone menu'],
  ['api/', 1, 'Set-up through the services, without a browser'],
  ['CardVaultApi.ts', 2, 'Create a customer, make a purchase, count transactions'],
  ['data/', 1, 'Test data in one place'],
  ['test-data.ts', 2, 'alice, her cards, the purchase, unique names'],
  ['files/', 2, 'The receipt picture for disputes'],
  ['tests/', 1, 'The framework tests'],
  ['sign-in.spec.ts', 2, 'Signing in, right and wrong'],
  ['cards.spec.ts', 2, 'alice’s cards, with her saved login'],
  ['transactions.spec.ts', 2, 'Filtering; a new customer’s purchase and dispute'],
  ['wallet-journey.spec.ts', 2, 'Add a card to the wallet and remove it (Module 7)'],
  ['dispute-journey.spec.ts', 2, 'Dispute a purchase from start to end (Module 7)'],
  ['learn/', 1, 'Part 1, untouched'],
], 'tests/ui')}
<p>Part 1’s <code>learn/</code> folder stays as it was. The framework sits beside it, so you can compare a plain test with its framework version.</p>

<h2>How the pieces depend on each other</h2>
${figure({ svg: frameworkLayers(), caption: 'Tests use fixtures and test data; fixtures build the page objects and the API client. Tests hold the steps and the checks; page objects hold the locators and never decide whether a test passed.' })}
<ul>
<li><strong>Tests</strong> read like a list of steps a person would follow: open the transactions page, filter to settled, expect only settled rows.</li>
<li><strong>Fixtures</strong> are Playwright’s way of handing things to a test, met in <a href="/learn/pw-builtin-fixtures/">built-in fixtures</a>. The framework adds its own.</li>
<li><strong>Page objects</strong> know where things are on a page and how to do things there.</li>
<li><strong>The API client</strong> creates the data a test needs, quickly, before the browser opens a page.</li>
<li><strong>Test data</strong> keeps names, numbers and files out of the tests, each with a note on where it comes from.</li>
</ul>

${keyIdea('<p>A framework gives each kind of knowledge one home: locators in page objects, set-up in the API client, values in test data, and the wiring in fixtures. Tests only say what they check, so a change in the app means a change in one place.</p>')}

<h2>One test, end to end</h2>
${code({ lang: 'typescript', title: 'tests/ui/tests/transactions.spec.ts', src: `
  test('dispute the purchase, with a note and a receipt', async ({ customer, transactionsPage, transactionPage, page }) => {
    await transactionsPage.open();
    await transactionsPage.openTransaction(PURCHASE.merchant);
    await transactionPage.openDispute('Wrong amount', 'I was charged twice', RECEIPT_FILE);

    await expect(page.getByRole('status').filter({ hasText: 'Dispute opened' })).toBeVisible();
    await expect(transactionPage.disputeOpenBadge).toHaveText('DISPUTE OPEN');
  });
` })}
<p>Compare it with <a href="/learn/pw-forms/">forms and uploads</a>, where the same dispute took a set-up helper, a sign-in, three clicks and four form fields written out. Here is what happens when it runs:</p>
<ol>
<li>The test asks for <code>customer</code>. The fixture uses the API client to create a brand-new customer, give them a purchase at Northwind Books, and sign them in through the sign-in page.</li>
<li>It asks for <code>transactionsPage</code> and <code>transactionPage</code>, so the fixtures build those page objects around the same browser page.</li>
<li>The test calls the page objects’ actions, which do the clicking and typing. <code>PURCHASE</code> and <code>RECEIPT_FILE</code> come from <code>data/test-data.ts</code>.</li>
<li>The two <code>expect</code> lines are the test’s own: the checks stay in the test, where a reader expects them.</li>
</ol>

<h2>Running it</h2>
${terminal([['npx playwright test --project=framework', `Running 12 tests using 2 workers

  ✓   1 [setup] › learn/saved-login.setup.ts:5:1 › sign in as alice and save the login (584ms)
  ✓   3 [framework] › tests/cards.spec.ts:8:1 › alice has her four cards (421ms)
  ✓   4 [framework] › tests/cards.spec.ts:17:1 › the credit card shows its limit (366ms)
  ✓   5 [framework] › tests/sign-in.spec.ts:4:1 › alice signs in and sees her wallet (704ms)
  ✓   2 [framework] › tests/dispute-journey.spec.ts:7:1 › dispute a purchase and see it marked in the list @phone (2.0s)
  ✓   6 [framework] › tests/sign-in.spec.ts:13:1 › a wrong password is refused (796ms)
  ✓   8 [framework] › tests/transactions.spec.ts:9:3 › alice’s transactions › filter to settled transactions (584ms)
  ✓   7 [framework] › tests/dispute-journey.spec.ts:29:1 › a purchase can only be disputed once (1.5s)
  ✓   9 [framework] › tests/transactions.spec.ts:23:3 › a new customer’s purchase › the purchase is in the list (1.3s)
  ✓  11 [framework] › tests/transactions.spec.ts:31:3 › a new customer’s purchase › dispute the purchase, with a note and a receipt (1.3s)
  ✓  10 [framework] › tests/wallet-journey.spec.ts:6:1 › add a card to the wallet, then remove it @phone (3.7s)
  ✓  12 [framework] › tests/wallet-journey.spec.ts:31:1 › Add card stays disabled until the terms are accepted (797ms)

  12 passed (9.7s)`]], 'Real output. The two journey files are the subject of Module 7.')}
<p>The framework has its own project in the config, so <code>--project=framework</code> runs only its tests, after the setup project that saves alice’s login. Plain <code>npx playwright test</code> runs both parts.</p>

${testerEye('<p>A framework is worth its cost only while it stays simple. Every piece here exists because Part 1 showed the same thing repeated. Resist adding layers “in case”: a reader should be able to go from a test to the click it makes in one or two jumps.</p>')}

${interview({
  say: `<p>“Our Playwright framework has four parts around the tests. Page objects hold each page’s locators and actions. A small API client creates test data through the services, which is faster and more reliable than the UI. Custom fixtures, made with test.extend, hand tests their page objects and a fresh signed-in customer. Test data lives in one file with notes on where values come from. Tests stay short and only contain steps and assertions.”</p>`,
  qa: [
    ['Walk me through your framework’s structure.', '<p>Tests in <code>tests/</code>; page objects in <code>pages/</code>; an API client in <code>api/</code> for set-up; custom fixtures in <code>fixtures.ts</code> that wire them together; test data in <code>data/</code>; settings in <code>playwright.config.ts</code> and <code>config.ts</code>. Each layer only uses the one below.</p>'],
    ['Why not keep everything in the test files?', '<p>Repetition. The same locators and set-up appear in many tests, so a change in the app means many edits, and long tests hide what they check. Shared pieces make each change happen once and keep tests readable.</p>'],
    ['Where do assertions go: in the test or in the page object?', '<p>In the test. Page objects describe the page and perform actions; the test decides what must be true. That keeps each test’s expectations visible and lets different tests check different things on the same page.</p>'],
  ],
})}
`,
};
