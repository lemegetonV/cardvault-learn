import { code, interview, sequence, keyIdea, testerEye } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'Before the dispute test can click anything, someone must exist who has made a purchase. Doing that through the browser would mean testing sign-up and checkout in every dispute test. A UI test should use the browser for what it checks and get everything else ready the fast way: by calling the services directly. This lesson reads the small API client that does it.',
  youWill: 'You will be able to explain why UI tests set up data through the API, read the API client, and wait for data that arrives a moment later.',
  body: `
<h2>Why not set up through the UI?</h2>
<ul>
<li><strong>Speed.</strong> One HTTP call takes milliseconds. Driving pages to the same state takes seconds, and every test repeats it.</li>
<li><strong>Reliability.</strong> Every extra page a test passes through is another chance to fail for a reason that has nothing to do with what it checks.</li>
<li><strong>Focus.</strong> When a dispute test fails, the cause should be in disputes, not in sign-up three pages earlier.</li>
<li><strong>Some things have no page.</strong> In CardVault, purchases happen at a shop’s checkout, outside the bank’s app. A test needs a way to make one happen.</li>
</ul>
<p>So the rule is: set up through the API, check through the UI. Here the sign-in goes through the page, which also proves the sign-in page works for a new customer. Signing in through the API and loading the saved state, as in <a href="/learn/pw-saved-login/">logging in once</a>, would be faster; it is a choice, not a rule.</p>

<h2>The API client</h2>
${code({ lang: 'typescript', title: 'tests/ui/api/CardVaultApi.ts', src: `
// A small client for the CardVault services, used to set up data before a UI test.
// Setting up through the API is fast and reliable; the browser is kept for what the test checks.
export class CardVaultApi {
  readonly request: APIRequestContext;

  constructor(request: APIRequestContext) {
    this.request = request;
  }
` })}
<p>The same shape as a page object: a class that receives what it works with in its constructor. Here that is Playwright’s <code>request</code> fixture from <a href="/learn/pw-api-requests/">API requests in Playwright</a>, whose type is <code>APIRequestContext</code>. The <code>api</code> fixture makes one per test with <code>new CardVaultApi(request)</code>.</p>

<h2>Creating a customer</h2>
${code({ lang: 'typescript', title: 'tests/ui/api/CardVaultApi.ts', src: `
  // Create a brand-new customer with one credit card. With inWallet set to false,
  // the card is not in the wallet yet, so a test can add it.
  async createCustomer(inWallet: boolean): Promise<Customer> {
    const response = await this.request.post(\`\${WALLET_URL}/test/customers\`, {
...
      data: { cards: [{ product: 'CREDIT', enrolled: inWallet }] },
    });
    expect(response.status()).toBe(201);
    const body = await response.json();
    return {
      username: body.username,
      password: body.password,
      last4: body.cards[0].last4,
      tokenRef: body.cards[0].token_ref,
    };
  }
` })}
<ul>
<li>Test environments usually offer a way to create data. CardVault’s test environment has one that creates a customer with exactly the cards you describe; the line left out adds the header that allows it.</li>
<li><code>Promise&lt;Customer&gt;</code> says the method returns, once awaited, a <code>Customer</code>: an <strong>interface</strong>, TypeScript’s way of naming an object’s fields and their types, declared at the top of the file.</li>
<li><code>expect(response.status()).toBe(201)</code> fails the set-up at once if creation did not work. A clear “set-up failed” is far easier to read than a test that fails later for no visible reason.</li>
<li>The method returns only what tests need, with names that suit TypeScript: <code>tokenRef</code> rather than the service’s <code>token_ref</code>.</li>
</ul>

<h2>Making a purchase</h2>
${code({ lang: 'typescript', title: 'tests/ui/api/CardVaultApi.ts', src: `
  // Pay a shop with the customer's card, the way a checkout would.
  async makePurchase(customer: Customer, merchant: string, amountInCents: number) {
    const response = await this.request.post(\`\${CARD_NETWORK_URL}/v1/test/purchases\`, {
...
      data: { token_ref: customer.tokenRef, amount: amountInCents, merchant_name: merchant },
    });
    expect(response.status()).toBe(200);
  }
` })}
<p>The card network is the outside system that carries a payment from a shop to the bank; in the test environment a simulator plays that part, as <a href="/learn/flow-purchase/">the purchase flow</a> describes. Amounts are whole cents, so $30.00 is <code>3000</code>.</p>

<h2>Waiting for data that arrives later</h2>
<p>The purchase is accepted at once, but it reaches the customer’s transaction list a moment later, after the bank has processed it. If the test opened the page straight away, the list could still be empty. The <code>customer</code> fixture waits for it:</p>
${code({ lang: 'typescript', title: 'tests/ui/fixtures.ts', src: `
    // The purchase reaches the transaction list a moment later. Wait until it is there.
    await expect.poll(() => api.countTransactions(customer)).toBe(1);
` })}
<p><code>expect.poll(fn)</code> calls the function again and again until its result passes the check, or the time runs out (the expect timeout, 5 seconds by default). It is the API version of a web-first assertion from <a href="/learn/pw-assertions/">web-first assertions</a>: no fixed pause, and it moves on the moment the purchase is there. <code>() =&gt; api.countTransactions(customer)</code> is a small function written in place, so <code>poll</code> can call it each time.</p>

${sequence({
  id: 'api-setup-run',
  label: 'The customer fixture, step by step',
  actors: [
    { id: 'f', label: 'customer fixture', kind: 'plain' },
    { id: 'w', label: 'Wallet service', kind: 'bank' },
    { id: 'n', label: 'Card network', kind: 'mock' },
    { id: 't', label: 'Transactions', kind: 'bank' },
    { id: 'b', label: 'Browser', kind: 'plain' },
  ],
  steps: [
    { from: 'f', to: 'w', label: 'create customer', note: 'A new customer with one credit card already in the wallet.' },
    { from: 'f', to: 'n', label: 'purchase $30.00', note: 'The simulator pays Northwind Books with the card, like a shop’s checkout.' },
    { from: 'n', to: 't', label: 'a moment later', note: 'The bank records the purchase in the customer’s transactions.' },
    { from: 'f', to: 't', label: 'poll: 1 yet?', note: '`expect.poll` asks until the list has one transaction.' },
    { from: 'f', to: 'b', label: 'sign in', note: 'The only browser step in the set-up: signing in on the page, which also checks the sign-in page.' },
  ],
  caption: 'A few quick HTTP calls and one sign-in. The test’s own steps start on a page that already has the data.',
})}

${keyIdea('<p>Set up through the API, check through the UI. Wrap the calls in a small client, fail fast when set-up fails, and use <code>expect.poll</code> to wait for data that arrives a moment later.</p>')}

${testerEye('<p>API set-up assumes the API works. When it breaks, every UI test that uses it fails at once, which is noisy but honest: the failure names the set-up step. Keep separate API tests for those endpoints, so you know which side is broken. CardVault’s pytest suite does exactly that.</p>')}

${interview({
  say: `<p>“UI tests set up their data through the API: our CardVaultApi class wraps Playwright’s request fixture and creates a fresh customer and a purchase in a few calls. It is faster and more reliable than driving the UI, and keeps each test focused on what it checks. Set-up asserts each response, so a broken set-up fails clearly. Data that is processed asynchronously is awaited with expect.poll instead of a sleep.”</p>`,
  qa: [
    ['Why set up test data through the API in UI tests?', '<p>It is much faster, less flaky, and keeps the test focused on the feature under test. The UI is kept for the behaviour being checked; set-up flows have their own tests.</p>'],
    ['What is expect.poll and when do you use it?', '<p>It retries a function until its value passes the matcher or times out. Use it for non-UI conditions that become true later, like data arriving through a background process, instead of fixed sleeps.</p>'],
    ['What if the set-up API itself is broken?', '<p>The set-up asserts each response, so tests fail at the set-up step with a clear message. Separate API tests cover those endpoints, which shows whether the API or the UI is at fault.</p>'],
  ],
})}
`,
};
