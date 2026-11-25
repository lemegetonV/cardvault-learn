import { keyIdea, testerEye, realWorld, terms, check, recap, table, code, sequence } from '../../src/components.mjs';

const buy = sequence({
  id: 'seq-network',
  label: 'A test asks the network mock to simulate a wallet purchase; the mock asks the card service for a decision and returns it with the trace ID. The test then asks the mock to settle, and the mock sends a clearing record.',
  actors: [
    { id: 'test', label: 'Your test', kind: 'plain' },
    { id: 'net', label: 'network mock', kind: 'mock' },
    { id: 'card', label: 'card service', kind: 'bank' },
  ],
  steps: [
    { from: 'test', to: 'net', label: 'POST /v1/test/purchases', note: 'The test asks for a purchase with a wallet token and an amount, using its `X-Test-Key`. It does not need to know which card the token belongs to.' },
    { from: 'net', to: 'net', kind: 'self', label: 'token → card, new trace_id', note: 'The mock looks the token up in its own map, finds the card, and makes a fresh `trace_id` such as `trc_…`.' },
    { from: 'net', to: 'card', label: 'POST /internal/v1/authorizations', note: 'It sends a real authorization to the card service, with its own service key and the test’s correlation ID.' },
    { from: 'card', to: 'net', kind: 'reply', label: 'APPROVED + hold_id', note: 'The card service decides exactly as it would for any network.' },
    { from: 'net', to: 'test', kind: 'reply', label: 'decision + trace_id', note: 'The mock passes the bank’s answer straight back, status and body unchanged. The test keeps the `trace_id` for clearing.' },
    { from: 'test', to: 'net', label: 'POST …/{trace_id}/settle', note: 'Later, the test asks the mock to settle. With no body, the settle amount is the authorized amount; a body can give a different one.' },
    { from: 'net', to: 'card', label: 'POST /internal/v1/clearing', note: 'The mock builds a clearing record with a new `clearing_id` and sends it.' },
    { from: 'card', to: 'test', kind: 'reply', label: 'clearing result (via the mock)', note: 'The clearing response, with the new `available`, comes back through the mock unchanged.' },
  ],
  caption: 'The mock stands in for the network. The bank cannot tell the difference.',
});

export default {
  minutes: 10,
  lede: 'A real card network connects thousands of banks and millions of shops. CardVault replaces it with a small program, the network mock, that behaves like a network from the bank’s point of view and takes orders from your tests. This lesson shows what it does, how to drive it, and the awkward network behaviours it can produce on purpose.',
  youWill: 'You will simulate a purchase and its clearing, and know the three misbehaviours the mock can switch on.',
  body: `
<h2>What a mock is for</h2>
<p>A <strong>mock</strong> is a stand-in for a system you do not control. It is not under test itself. Its job is to talk to the system under test exactly as the real one would, while letting your tests decide what happens. With a real network you could not say “send me a purchase now” or “send that authorization twice”. With the mock, you can.</p>
<p>The network mock has three jobs:</p>
${table(['Job', 'Endpoint', 'Called by'], [
  ['Issue wallet tokens and remember which card each one belongs to', '`POST /v1/tokens`', 'The wallet operator mock, with its service key'],
  ['Simulate purchases and clearing', '`/v1/test/purchases`, `/v1/test/card-purchases` and settle, reverse, refund', 'Tests, with the test key'],
  ['Misbehave on request', '`/test/behaviour`', 'Tests, with the test key'],
])}
<p>It never sees a card number. Tokens map to the bank’s <code>card_id</code>, which is all a network needs to route a purchase.</p>

<h2>A purchase, then its clearing</h2>
${buy}
${code({ lang: 'json', title: 'POST /v1/test/purchases (on port 8102, with X-Test-Key)', src: `{
  "token_ref": "tok_a11ce0c4ed170000000001",
  "amount": 2500,
  "merchant_name": "Northwind Coffee",
  "mcc": "5814"
}` })}
<p><code>merchant_name</code> and <code>mcc</code> are optional; by default the merchant is “CardVault Test Merchant” with category 5999. The mock does not validate <code>amount</code> or <code>currency</code>, on purpose, so a test can send a zero or negative amount and see the card service reject it with <code>422</code>.</p>
<p>The second purchase endpoint, <code>POST /v1/test/card-purchases</code>, takes a <code>card_id</code> instead of a token and sends <code>token_requestor: CARD</code>. That is a purchase made with the card itself, outside the wallet. It is also how a test can make an unused card “recently used”, so that it becomes eligible for the wallet.</p>
${table(['Clearing call', 'Body', 'Sends'], [
  ['`POST /v1/test/purchases/{trace_id}/settle`', 'Optional `{"amount": …}`; default is the authorized amount', '`SETTLE`'],
  ['`POST /v1/test/purchases/{trace_id}/reverse`', 'Optional `{"amount": …}`; default is the authorized amount', '`REVERSE`'],
  ['`POST /v1/test/purchases/{trace_id}/refund`', 'Required `{"amount": …}`', '`REFUND`'],
])}
${keyIdea(`<p>The mock passes the card service’s answers back unchanged: same status, same body. So a test driving purchases through the mock is really asserting on the bank’s behaviour. The mock only adds the <code>trace_id</code> it generated, and extra fields when a misbehaviour was switched on.</p>`)}

<h2>Misbehaving on purpose</h2>
<p>Real networks are not polite. They resend requests, they give up waiting and retry, and their messages can arrive out of order. The mock can do each of these on demand:</p>
${table(['Control', 'What the mock does', 'What it tests in the bank'], [
  ['`duplicate_authorization`', 'Sends the same authorization, same `trace_id`, twice. The response includes both answers.', 'One hold, the same decision twice'],
  ['`timeout_retry`', 'Gives up on the first attempt after a tiny timeout, then retries with the same `trace_id`.', 'A retry after a lost reply does not double-charge'],
  ['`clearing_before_auth_event`', 'Settles immediately in the same call, so clearing chases the authorization.', 'The transaction history copes with events arriving close together or out of order'],
])}
${code({ lang: 'json', title: 'POST /test/behaviour: duplicate the next purchase only', src: `{
  "controls": [
    { "type": "duplicate_authorization", "fail_next": 1 }
  ]
}` })}
<p>Each control can apply to the next N purchases (<code>fail_next</code>), to a seeded random share of them (<code>rate</code> plus <code>seed</code>, so a run can be repeated exactly), or to every purchase until reset. Posting <code>{"controls": []}</code> switches them all off.</p>
${testerEye(`<p>Use a control together with a check on the bank’s state. For <code>duplicate_authorization</code>, assert that both answers are identical, that <code>available</code> fell only once, and that only one transaction appears in the wallet history. The control creates the situation; your assertions decide whether the bank handled it.</p>`)}

<h2>Its memory</h2>
<p>The mock keeps tokens and purchases in memory only. <code>/test/seed</code> restores the seed tokens and the seed purchases, so a test can even settle one of alice’s seeded authorizations. <code>GET /test/state</code> shows everything it currently knows. A restart forgets everything else, which is acceptable for a mock and one reason to run <code>make reset</code> before a test run.</p>
${realWorld(`<p>A real network sits between thousands of banks, translates between their message formats, routes each purchase by the card number’s first digits, and applies its own rules and fees. None of that is under test here, so the mock keeps only what the bank can observe: requests arriving, with IDs that may repeat.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Mock', 'A controllable stand-in for a system you do not own. Not under test itself.'],
  ['Simulator endpoint', 'A test-only endpoint on the mock that makes it act, such as `POST /v1/test/purchases`.'],
  ['Wallet token', 'A `tok_…` reference the network maps to a `card_id`; the wallet pays with it instead of the number.'],
  ['Behaviour control', 'A switch on the mock that makes it misbehave like a real network, on purpose.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test calls `POST /v1/test/purchases` with `"amount": 0`. Where is it rejected, and with what?',
  options: ['By the mock, with 422', 'By the card service, with 422, passed back unchanged by the mock', 'Nowhere; it is approved', 'By the mock, with 400'],
  answer: 1,
  why: '<p>The mock deliberately does not validate amounts. It forwards the authorization, the card service rejects an amount of zero with <code>422</code>, and the mock passes that answer back.</p>',
})}
${check({
  q: 'With `duplicate_authorization` on for one purchase, a $25 purchase is approved. By how much does `available` fall?',
  options: ['$50, because two authorizations were sent', '$25, because the second has the same trace_id', '$0, because duplicates are declined', 'It depends on the card product'],
  answer: 1,
  why: '<p>The card service recognises the repeated <code>trace_id</code> and returns the stored decision without creating a second hold.</p>',
})}

<h2>Recap</h2>
${recap([
  'The network mock stands in for the card network and takes orders from tests.',
  'It issues wallet tokens, simulates wallet and plain card purchases, and sends clearing records.',
  'It passes the card service’s answers back unchanged, adding the `trace_id`.',
  'Controls make it duplicate, time out and retry, or race clearing, on purpose and repeatably.',
  'Its state lives in memory; `/test/seed` restores seed tokens and purchases.',
])}
`,
};
