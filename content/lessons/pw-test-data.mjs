import { code, terminal, interview, table, keyIdea, testerEye } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'Every check compares the page with an expected value: four cards, a $5,000.00 limit, $30.00 at Northwind Books. Where those values come from decides whether a test proves anything. Where the app itself lives decides where the suite can run. This lesson covers both: the framework’s test data file, and the settings that point the suite at an environment.',
  youWill: 'You will be able to say where each expected value comes from, choose between shared and fresh data, and point the suite at another environment.',
  body: `
<h2>Three kinds of data</h2>
${table(['Kind', 'Example', 'Who may change it'], [
  ['Demo data, known in advance', 'alice and her four cards', 'Nobody: tests only read it'],
  ['Fresh data, made for one test', 'A new customer with a $30.00 purchase', 'That test alone'],
  ['Unique values, made up per run', 'A username that has never been used', 'Nobody else has it'],
])}
<p>Demo data is loaded the same way every time the test environment is set up, so its values can be written into tests. Because many tests share it, a test that changed alice would break every other test that expects her as she was. Tests that change something therefore make their own customer, as <a href="/learn/pw-api-setup/">API set-up</a> showed.</p>

<h2>The test data file</h2>
${code({ lang: 'typescript', title: 'tests/ui/data/test-data.ts', src: `
// alice is a demo customer who is always there. Tests only read her data,
// so they can share her safely, even when they run at the same time.
export const ALICE = { username: 'alice', password: DEMO_PASSWORD };

// alice's four cards, by the last four digits shown on screen.
export const ALICE_CARDS = {
  credit: '4417', // in the wallet
  debit: '2045', // in the wallet
  unusedCredit: '7380', // not used for 120 days, so it cannot be added
  prepaid: '5521', // prepaid cards cannot be added
};

// The purchase made for a new customer before a test.
export const PURCHASE = { merchant: 'Northwind Books', amountInCents: 3000, shownAs: '$30.00' };

// A small picture to upload as a dispute receipt.
export const RECEIPT_FILE = 'data/files/receipt.png';
` })}
<ul>
<li>Each value has one name and one home. A test says <code>ALICE_CARDS.credit</code>, which reads better than <code>'4417'</code> and changes in one place.</li>
<li>The comments say why each card matters, linking the data to the product rules from <a href="/learn/flow-add-to-wallet/">adding a card to the wallet</a>.</li>
<li><code>PURCHASE</code> keeps the amount twice on purpose: in cents for the API, and as the customer sees it for the page. The expected text, <code>$30.00</code>, follows from the amount the test chose. It is not copied from what the app happened to show.</li>
</ul>

<h2>Using it in a test</h2>
${code({ lang: 'typescript', title: 'tests/ui/tests/cards.spec.ts', src: `
// These tests only read alice's cards, so they start with her saved login.
test.use({ storageState: ALICE_LOGIN });

test('alice has her four cards', async ({ cardsPage }) => {
  await cardsPage.open();

  await expect(cardsPage.cards).toHaveCount(4);
  for (const last4 of Object.values(ALICE_CARDS)) {
    await expect(cardsPage.card(last4)).toBeVisible();
  }
});

test('the credit card shows its limit', async ({ cardsPage }) => {
  await cardsPage.open();

  await expect(cardsPage.card(ALICE_CARDS.credit).getByTestId('card-limit')).toHaveText('$5,000.00');
});
` })}
<p><code>Object.values(...)</code> turns an object into a list of its values, here the four last-four strings, so the loop checks each card. The saved login comes from <a href="/learn/pw-saved-login/">logging in once</a>, which suits these tests because they only read.</p>

<h2>Values made up per run</h2>
${code({ lang: 'typescript', title: 'tests/ui/data/test-data.ts', src: `
// A username that has never been used: usernames lock after a few wrong
// passwords, so each run needs a new one.
export function unusedUsername(): string {
  return \`nobody-\${Date.now()}\`;
}
` })}
<p><code>Date.now()</code> is the number of milliseconds since 1970, different on every run, so each run gets a name like <code>nobody-1795765742123</code>. <a href="/learn/pw-flaky-tests/">Flaky tests</a> showed why: the same made-up name on every run eventually locked the account and broke the test.</p>

${keyIdea('<p>Read shared demo data, never change it. Make fresh data for any test that changes something. Make values unique when the app remembers them. Expected values come from the data the test controls, not from copying the app’s output.</p>')}

<h2>Which environment?</h2>
${code({ lang: 'typescript', title: 'tests/ui/config.ts', src: `
// The web app's address. Tests open pages with short paths such as "/login".
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

// The password shared by the demo customers (alice, bob, charlie and dana).
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'CardVault-Demo-1';
` })}
<p>Addresses live in <code>config.ts</code>, met in <a href="/learn/pw-project/">a Playwright project</a>. <code>process.env.BASE_URL</code> reads an <strong>environment variable</strong>, a setting given to a program when it starts. <code>??</code> means “if that is not set, use this”. So the suite runs against your own computer by default, and against another copy of CardVault when told to:</p>
${terminal([['BASE_URL=https://cardvault.example.com npx playwright test', '']], 'Point the browser at another copy of CardVault')}
<p>That moves the browser. The API client talks to the services directly, so their addresses (<code>AUTH_URL</code>, <code>WALLET_URL</code> and the others in <code>config.ts</code>) are set the same way when the whole suite moves.</p>
<p>Secrets, such as passwords for a shared environment, are passed the same way, from the CI system’s secret store. They never go into the repository.</p>

${testerEye('<p>When a test fails on one environment and passes on another, look at the data first: is the demo data the same there, has someone changed it by hand, is the environment older? Tests that create their own data are far less sensitive to this, which is one more reason to prefer them for anything that changes state.</p>')}

${interview({
  say: `<p>“Test data is in one file. Shared demo users like alice are read-only, so tests can share them and run in parallel. Any test that changes state gets a fresh customer created through the API, and values the app remembers, like usernames for failed logins, are made unique per run. Expected values come from the data we control, not from copying the app’s output. Environment addresses come from environment variables with local defaults, and secrets come from CI.”</p>`,
  qa: [
    ['How do you manage test data in UI tests?', '<p>Known demo data for read-only checks, fresh data created through the API for tests that change state, unique generated values where the app remembers them, and all constants in one data file. No test depends on another test’s data.</p>'],
    ['How do you run the same suite against different environments?', '<p>Read addresses and credentials from environment variables with sensible local defaults, set <code>baseURL</code> from them in the config, and pass secrets from the CI secret store.</p>'],
    ['Where should an expected value come from?', '<p>From a requirement or from data the test controls, such as the amount it chose for a purchase. Copying what the app currently shows only proves the app is consistent with itself.</p>'],
  ],
})}
`,
};
