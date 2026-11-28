import { code, figure, interview, table, keyIdea, shot, testerEye } from '../../src/components.mjs';
import { routeFlow } from '../diagrams/playwright.mjs';

export default {
  minutes: 12,
  lede: 'How does the transactions page look when there are none, or when the server is down? With real data those screens are hard to reach: alice always has 55 transactions and the services are usually up. Playwright can stand between the page and the server and answer requests itself. This lesson shows how to fake an answer, fake a failure and change one field of a real answer.',
  youWill: 'You will be able to mock and modify network responses with page.route and explain what a mocked test does and does not prove.',
  body: `
<h2>Standing in the middle</h2>
<p>CardVault’s pages are client pages: they open first, then ask the web app for data with HTTP requests, such as <code>/api/wallet/transactions?limit=20</code> for the list. <code>page.route(pattern, handler)</code> tells Playwright: when this page sends a request that matches the pattern, give it to my handler instead of sending it. This is called <strong>mocking</strong> or <strong>intercepting</strong> the network. It only sees requests the <em>browser</em> sends: calls the web app’s server makes to the services behind it never pass through the browser, so they cannot be mocked this way. That is why the pattern targets the web app’s <code>/api/...</code> addresses.</p>
${figure({ svg: routeFlow(), caption: 'A matched request goes to your handler first. It can answer, pass the request on and change the answer, or stop it.' })}
<p>Every test in this file signs in as alice first. The route is set up before the page that sends the request is opened, so the very first request is caught. The pattern is kept in one constant at the top of the file:</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/network-mocking.spec.ts', src: `
// The address the transactions page asks for its list.
const TRANSACTIONS_API = '**/api/wallet/transactions?*';
` })}
<p>In this pattern, <code>**</code> matches any start of the address, and <code>?*</code> means a literal question mark followed by any query, such as <code>?limit=20</code>.</p>

<h2>Fake an empty list</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/network-mocking.spec.ts', src: `
test('an empty list shows the empty message', async ({ page }) => {
  // page.route catches matching requests. fulfill answers them with our own
  // response, so the request never reaches CardVault.
  await page.route(TRANSACTIONS_API, (route) =>
    route.fulfill({ json: { items: [], next_cursor: null } }),
  );

  await page.goto('/wallet/transactions');

  await expect(page.getByText('No transactions match these filters.')).toBeVisible();
});
` })}
<ul>
<li>The handler receives a <code>route</code>: the caught request, waiting for a decision.</li>
<li><code>route.fulfill({ json })</code> answers it with status 200 and the given object as the JSON body. The shape copies the real service’s answer: a list of <code>items</code> and a <code>next_cursor</code> for “Load more” (<code>null</code> means there is no next page).</li>
<li>The page has no way to tell the answer is fake, so it shows its empty state, which is the thing under test.</li>
</ul>

<h2>Fake a failure, then recover</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/network-mocking.spec.ts', src: `
test('a server error shows an error and a Try again button', async ({ page }) => {
  await page.route(TRANSACTIONS_API, (route) =>
    route.fulfill({
      status: 503,
      json: { error_code: 'UNAVAILABLE', message: 'The service is not available' },
    }),
  );

  await page.goto('/wallet/transactions');

  const error = page.getByTestId('error-state');
  await expect(error).toContainText('The service is not available (UNAVAILABLE)');

  // Stop catching requests. The next request reaches the real service again.
  await page.unroute(TRANSACTIONS_API);
  await error.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByTestId('txn-row')).toHaveCount(20);
});
` })}
${shot({ src: 'pw-error-state.png', alt: 'The Wallet transactions page with its filters, and below them a red message, The service is not available (UNAVAILABLE), and a Try again button.', caption: 'The error screen, reached on demand. CardVault shows the server’s message and code, and offers to try again.' })}
<p>Status 503 means “service unavailable”. The body follows CardVault’s error format, an <code>error_code</code> and a <code>message</code>, and the page shows both. <code>page.unroute</code> removes the route, so pressing Try again reaches the real service, and alice’s first 20 transactions appear. One test covers the failure and the recovery.</p>

<h2>Change one field of the real answer</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/network-mocking.spec.ts', src: `
test('change one field in the real response', async ({ page }) => {
  await page.route(TRANSACTIONS_API, async (route) => {
    // Let the request through, wait for the real answer, change it, pass it on.
    const response = await route.fetch();
    const body = await response.json();
    body.items[0].merchant_name = 'A shop with a very long name that goes on and on';
    await route.fulfill({ response, json: body });
  });

  await page.goto('/wallet/transactions');

  await expect(page.getByTestId('txn-row').first()).toContainText('A shop with a very long name');
  await expect(page.getByTestId('txn-row')).toHaveCount(20);
});
` })}
<p><code>route.fetch()</code> sends the request to the real server and returns its response. The handler changes one merchant name and answers with <code>fulfill({ response, json })</code>: the real status and headers, with the changed body. Everything else is real data. This is handy for an edge case that is hard to create, such as a very long name, without building a whole fake answer.</p>

${keyIdea('<p><code>page.route</code> catches matching requests before they leave the browser. <code>fulfill</code> answers with your data, <code>fetch</code> then <code>fulfill</code> changes a real answer, <code>abort</code> fails the request, and <code>unroute</code> stops catching.</p>')}

<h2>What a mocked test proves</h2>
<p>A mocked test checks the <em>page’s</em> behaviour for a given answer: the empty message, the error screen, how a long name fits. It proves nothing about the service, because the service never answered. If the real service changed the shape of its answer, a test with a hand-written fake would still pass. So keep most tests on real data, and mock for states that are hard to reach otherwise, such as errors, empty lists and rare values.</p>

${table(['To', 'Use'], [
  ['Answer with your own data', '`route.fulfill({ json })` or `{ status, json }`'],
  ['Change part of the real answer', '`const r = await route.fetch()`, then `route.fulfill({ response: r, json })`'],
  ['Fail the request, as if offline', '`route.abort()`'],
  ['Let it through unchanged', '`route.continue()`'],
  ['Stop catching', '`page.unroute(pattern)`'],
  ['Catch for every page in the context', '`context.route(pattern, handler)`'],
])}

${testerEye('<p>Mocking is how UI tests cover failure screens without breaking a shared environment. In an interview, say both halves: you mock to reach states the real system rarely shows, and you keep end-to-end tests on real data so a change in the API is still caught. Contract tests between the page and the API close the gap in between.</p>')}

${interview({
  say: `<p>“I use page.route to intercept requests from the page. With fulfill I return my own JSON, for example an empty list or a 503 to check the empty and error states; with route.fetch I get the real response and change one field, for edge cases like a very long merchant name. Mocked tests prove how the UI handles a response, not that the backend is right, so most of my tests run against real data and mocking is for hard-to-reach states.”</p>`,
  qa: [
    ['Can page.route mock the calls your backend makes to other services?', '<p>No. It only intercepts requests the browser sends. Server-to-server calls need a mock service or a test double on the server side.</p>'],
    ['How do you mock an API response in Playwright?', '<p>Call <code>page.route(pattern, route =&gt; route.fulfill({ status, json }))</code> before the page sends the request. Matching requests get your response and never reach the server.</p>'],
    ['How do you change a real response instead of replacing it?', '<p>In the handler, call <code>route.fetch()</code> to get the real response, change the parsed body, then <code>route.fulfill({ response, json: changed })</code>. Status and headers stay real.</p>'],
    ['What are the risks of mocking?', '<p>The test no longer checks the backend, and a hand-written fake can drift from the real API, so the test passes while the real page breaks. Mock for states that are hard to create, keep the fake’s shape close to the real one, and keep real end-to-end tests too.</p>'],
  ],
})}
`,
};
