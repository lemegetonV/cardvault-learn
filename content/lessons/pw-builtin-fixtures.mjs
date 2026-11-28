import { code, figure, interview, table, keyIdea, testerEye } from '../../src/components.mjs';
import { fixtureLayers } from '../diagrams/playwright.mjs';

export default {
  minutes: 11,
  lede: 'Every test so far began with async ({ page }). That { page } is a request: “give me a browser tab”. Playwright calls the things a test can ask for fixtures. This lesson tours the built-in ones, page, context, browser, request and testInfo, and shows when each is the right tool.',
  youWill: 'You will be able to explain what a fixture is and pick the right built-in fixture for a test.',
  body: `
<h2>What a fixture is</h2>
<p>A <strong>fixture</strong> is something a test needs that Playwright prepares before the test starts and tidies up after it ends. The test names the fixtures it wants inside <code>{ }</code>, and Playwright creates only those. Python’s pytest uses the same word for the same idea.</p>
<p>The braces are a TypeScript feature called <strong>destructuring</strong>: Playwright passes the test one object holding every fixture, and <code>{ page, request }</code> takes out just the two named ones.</p>
${figure({ svg: fixtureLayers(), caption: 'How the built-in fixtures fit together. The browser is shared; everything inside a context belongs to one test.' })}

<h2>page and context</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/fixtures.spec.ts', src: `
test('context: two tabs share one sign-in', async ({ context, page }) => {
  // page is the first tab in context. Sign in there.
  await signIn(page, 'alice');

  // A second tab in the same context has the same cookies, so it is signed in too.
  const secondTab = await context.newPage();
  await secondTab.goto('/cards');
  await expect(secondTab.getByRole('heading', { name: 'Cards' })).toBeVisible();
});
` })}
<p><code>page</code> is one browser tab. <code>context</code> is the browser profile that tab lives in, made fresh for this test. <code>context.newPage()</code> opens another tab in the same profile. It shares the cookies, so it is signed in too. This is how you test what a customer sees in two tabs at once.</p>
<p><code>signIn</code> is a small function at the top of this file, because several tests here sign in, some on two pages. It holds the same four steps you have been writing, and takes the page and the username as inputs:</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/fixtures.spec.ts', src: `
async function signIn(page: Page, username: string) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');
}
` })}
<p><code>page: Page</code> says the input must be a browser tab; <code>Page</code> is a type that comes from Playwright, imported at the top of the file.</p>

<h2>browser: two customers at once</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/fixtures.spec.ts', src: `
test('browser: two customers side by side', async ({ browser }) => {
  // Each new context is a separate, empty browser profile.
  const aliceContext = await browser.newContext();
  const bobContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  const bob = await bobContext.newPage();

  await signIn(alice, 'alice');
  await signIn(bob, 'bob');

  // Each customer sees only their own cards.
  await expect(alice.getByTestId('wallet-cards').getByRole('listitem')).toHaveCount(4);
  await expect(bob.getByTestId('wallet-cards').getByRole('listitem')).toHaveCount(2);

  // Contexts you create yourself, you close yourself.
  await aliceContext.close();
  await bobContext.close();
});
` })}
<p><code>browser</code> is the running browser itself. <code>browser.newContext()</code> makes a separate profile, so alice and bob are signed in side by side without seeing each other’s cookies. New contexts still get the settings from the config file, such as <code>baseURL</code>. The expected counts come from the demo data: alice has four cards, bob has two.</p>
<p>The <code>page</code> and <code>context</code> fixtures are closed by Playwright. Contexts you make yourself are yours to close, which is what the last two lines do.</p>

<h2>request: HTTP without a browser</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/fixtures.spec.ts', src: `
test('request: send HTTP requests without a page', async ({ request }) => {
  // request uses the same baseURL as page.goto.
  const response = await request.get('/api/health');

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: 'ok', service: 'web' });
});
` })}
<p><code>request</code> sends HTTP requests straight from the test, with no browser involved, so it is fast. <code>response.json()</code> reads the body as an object. <code>toEqual</code> compares objects by their contents, field by field; <code>toBe</code> would ask whether they are the very same object, which two separately made objects never are. The lesson on <a href="/learn/pw-api-requests/">API requests</a> uses <code>request</code> in earnest.</p>

<h2>testInfo: about the test itself</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/fixtures.spec.ts', src: `
test('testInfo: facts about the running test', async ({ page }, testInfo) => {
  // testInfo is the second parameter, outside the { }.
  expect(testInfo.title).toBe('testInfo: facts about the running test');
  expect(testInfo.project.name).toBe('learn');

  // Attach a screenshot to this test's entry in the HTML report.
  await page.goto('/login');
  await testInfo.attach('sign-in page', { body: await page.screenshot(), contentType: 'image/png' });
});
` })}
<p><code>testInfo</code> describes the running test: its title, its project, whether it has failed so far, how many times it has been retried. <code>testInfo.attach</code> adds a file to the test’s entry in the HTML report. Here it is a screenshot of the page, from <code>page.screenshot()</code>, which returns the picture as data.</p>

${keyIdea('<p>A fixture is something a test asks for in <code>{ }</code>; Playwright makes it before the test and cleans it up after. <code>page</code> and <code>context</code> are new for every test, <code>browser</code> is shared, <code>request</code> talks HTTP without a browser.</p>')}

<h2>The built-in fixtures</h2>
${table(['Fixture', 'What it is', 'New for each test?'], [
  ['`page`', 'One browser tab, ready to use', 'Yes'],
  ['`context`', 'The browser profile the page is in', 'Yes'],
  ['`browser`', 'The running browser', 'No, one per worker'],
  ['`request`', 'Sends HTTP requests with no browser', 'Yes'],
  ['`browserName`', '`chromium`, `firefox` or `webkit`', 'A plain value'],
  ['`testInfo`', 'Facts about the running test (second parameter)', 'Yes'],
])}
<p>A <strong>worker</strong> is one of the separate processes Playwright uses to run tests in parallel; <a href="/learn/pw-parallel/">parallel runs</a> covers them. You can also write your own fixtures, such as “a signed-in wallet page”, which is how the CardVault framework will remove repeated set-up in <a href="/learn/pw-custom-fixtures/">custom fixtures</a>.</p>

${testerEye('<p>Pick the lightest fixture that proves the point. To check data through the API, <code>request</code> is far faster than driving pages. To test two customers or two tabs, use separate contexts rather than signing out and in again, which tests the sign-out flow by accident.</p>')}

${interview({
  say: `<p>“Fixtures are what a Playwright test receives in its parameter object: Playwright sets them up before the test and tears them down after. page and context are fresh per test, which gives isolation; browser is shared per worker; request is an API client that uses the same base URL. For two users at once I create two contexts from browser and close them myself, and I use testInfo to attach evidence to the report.”</p>`,
  qa: [
    ['What is the difference between a browser, a context and a page?', '<p>The browser is the running Chromium, Firefox or WebKit process. A context is an isolated profile inside it with its own cookies and storage, like an incognito window. A page is one tab inside a context. Pages in the same context share a sign-in; different contexts do not.</p>'],
    ['How would you test two users interacting at the same time?', '<p>Create two contexts with <code>browser.newContext()</code>, open a page in each, sign each in as a different user, and act in both. Close the contexts at the end, because only built-in fixtures are closed automatically.</p>'],
    ['Why does a test get a new context instead of a new browser?', '<p>Starting a browser is slow; creating a context takes milliseconds and is just as isolated. Sharing one browser per worker and a new context per test gives both speed and independence.</p>'],
  ],
})}
`,
};
