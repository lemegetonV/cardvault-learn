import { code, interview, table, keyIdea, sequence, testerEye } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'Playwright is known for driving browsers, but it can also send HTTP requests directly, with no page at all. That is useful in two ways: to check the API on its own, and to check that the page shows what the API says. This lesson uses the request fixture against CardVault’s services, and shows how page.request differs from it.',
  youWill: 'You will be able to call an API from a Playwright test and use it to check what the page shows.',
  body: `
<h2>Two ways into CardVault</h2>
<p>A customer reaches CardVault through the web app, which calls the bank’s services behind the scenes. A test can also call those services directly, the way the <a href="/learn/py-first-test/">pytest track</a> does in Python. In Playwright, that is the <code>request</code> fixture you met in <a href="/learn/pw-builtin-fixtures/">built-in fixtures</a>. The service addresses come from <code>config.ts</code>, like the web app’s:</p>
${code({ lang: 'typescript', title: 'tests/ui/config.ts', src: `
export const AUTH_URL = process.env.AUTH_URL ?? 'http://localhost:8001';
export const CARDS_URL = process.env.CARDS_URL ?? 'http://localhost:8002';
` })}

<h2>Sign in and list cards, with no browser</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/api-requests.spec.ts', src: `
test('sign in through the API and list alice’s cards', async ({ request }) => {
  // The request fixture sends HTTP requests straight to a service, with no browser.
  const login = await request.post(\`\${AUTH_URL}/v1/auth/login\`, {
    data: { username: 'alice', password: DEMO_PASSWORD },
  });
  expect(login.status()).toBe(200);
  const token = (await login.json()).access_token;

  const cards = await request.get(\`\${CARDS_URL}/v1/cards\`, {
    headers: { Authorization: \`Bearer \${token}\` },
  });
  expect(cards.status()).toBe(200);
  expect((await cards.json()).items).toHaveLength(4);
});
` })}
<ol>
<li><code>request.post(url, { data })</code> sends a POST request. An object given as <code>data</code> is sent as JSON. The login service answers with an <strong>access token</strong>: a signed piece of text that proves who you are on later requests.</li>
<li><code>(await login.json()).access_token</code> reads the body, then takes one field from it. The brackets make the <code>await</code> happen first.</li>
<li>The cards service wants the token in an <code>Authorization</code> header, as <code>Bearer</code> followed by the token. <code>headers</code> adds it.</li>
<li><code>toHaveLength(4)</code> checks the length of a list. These are plain assertions on values the test already has, so they check once.</li>
</ol>
<p>This test takes about a tenth of a second, because no browser starts. When the browser adds nothing to what you are checking, an API test is faster and steadier.</p>

<h2>Check the page against the API</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/api-requests.spec.ts', src: `
  const cardList = page.getByTestId('card-list');
  await expect(cardList.getByRole('listitem')).toHaveCount(apiCards.length);
  for (const card of apiCards) {
    await expect(cardList).toContainText(\`•••• \${card.last4}\`);
  }
` })}
<p>This is the end of a <strong>hybrid</strong> test, one that uses the API and the browser together. It first asks the cards service which cards alice has (the same two requests as above, keeping <code>items</code> as <code>apiCards</code>), then signs in on the page and opens <code>/cards</code>. The page must list as many cards as the API returned, and show each card’s last four digits. The <code>for...of</code> loop, from <a href="/learn/pw-typescript-basics/">TypeScript basics</a>, runs one assertion per card.</p>
<p>The expected values come from the API, not from the page, so the test checks that the web app shows the bank’s data faithfully. It would catch a page that dropped a card or mixed up numbers.</p>

<h2>page.request versus request</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/api-requests.spec.ts', src: `
  // page.request sends the browser's cookies, so the web app knows who is asking.
  const signedIn = await page.request.get('/api/cards');
  expect(signedIn.status()).toBe(200);

  // The request fixture has its own, empty cookie jar.
  const signedOut = await request.get('/api/cards');
  expect(signedOut.status()).toBe(401);
` })}
<p>This test signs alice in on the page first. <code>/api/cards</code> is the web app’s own route, which keeps the token in a cookie for the browser. <code>page.request</code> is a request client that shares the page’s context, so it sends the sign-in cookie, and the answer is 200. The separate <code>request</code> fixture has no cookies here, so the same address answers 401, “not signed in”. (If a file sets a saved login with <code>storageState</code>, as the next lesson does, the <code>request</code> fixture loads those cookies too.)</p>
${sequence({
  id: 'request-kinds',
  label: 'Who sends the cookie',
  actors: [
    { id: 'p', label: 'page.request', kind: 'plain' },
    { id: 'r', label: 'request', kind: 'plain' },
    { id: 'w', label: 'Web app', kind: 'bank' },
  ],
  steps: [
    { from: 'p', to: 'w', label: 'GET /api/cards + cookie', note: 'Shares the page’s context, so the sign-in cookie goes along.' },
    { from: 'w', to: 'p', label: '200, the cards', kind: 'reply', note: 'The web app knows the caller is alice.' },
    { from: 'r', to: 'w', label: 'GET /api/cards', note: 'A separate client with an empty cookie jar.' },
    { from: 'w', to: 'r', label: '401', kind: 'reply', note: 'No cookie, so not signed in.' },
  ],
  caption: 'Use page.request to call the app as the signed-in browser; use request for independent API calls.',
})}

${keyIdea('<p>The <code>request</code> fixture sends HTTP requests with no browser: fast checks of the API, set-up data, or expected values for a page. <code>page.request</code> does the same but shares the page’s cookies.</p>')}

${table(['Need', 'Use'], [
  ['Call a service directly', '`request.get(url, { headers })`, `request.post(url, { data })`'],
  ['Call the web app as the signed-in browser', '`page.request.get(path)`'],
  ['Read the status', '`response.status()`, or `response.ok()` for 200 to 299'],
  ['Read the body', '`await response.json()` or `await response.text()`'],
  ['A client with its own base URL and headers', '`await playwright.request.newContext({ baseURL, extraHTTPHeaders })`'],
])}

${testerEye('<p>Playwright’s API client is good enough for checks that support UI tests: set-up, expected values, quick sanity checks. A full API test suite, with schema checks, negative cases and database checks, is usually clearer in a tool built for it, such as pytest and requests in the <a href="/learn/py-negative-tests/">API track</a>. Knowing both, and when to use which, is a strong interview answer.</p>')}

${interview({
  say: `<p>“Playwright’s request fixture is an HTTP client that needs no browser. I use it for quick API checks and in hybrid tests: get the expected data from the API, then assert the page shows it, like the cards list. page.request shares the page’s cookies, so it calls the web app as the signed-in user; the plain request fixture starts with no cookies. For set-up, API calls are much faster than clicking through the UI.”</p>`,
  qa: [
    ['How do you make an API call in a Playwright test?', '<p>Ask for the <code>request</code> fixture and call <code>request.get</code>, <code>post</code>, <code>put</code> or <code>delete</code> with a URL and options such as <code>data</code> and <code>headers</code>. Then check <code>response.status()</code> and <code>await response.json()</code>.</p>'],
    ['What is the difference between request and page.request?', '<p><code>page.request</code> belongs to the page’s browser context and shares its cookies, so requests carry the page’s sign-in. The <code>request</code> fixture is a separate client with its own empty cookie store.</p>'],
    ['What is a hybrid test and why use one?', '<p>A test that uses the API and the UI together, for example creating data or fetching expected values through the API and checking the UI. It is faster than doing everything in the browser and takes its expected values from the system of record, not from the screen.</p>'],
  ],
})}
`,
};
