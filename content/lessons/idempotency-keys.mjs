import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, code, sequence } from '../../src/components.mjs';

const lostReply = sequence({
  id: 'seq-idem',
  label: 'A client reports a card lost, the response is lost on the way back, and the client retries with the same Idempotency-Key. The service replays the first answer instead of acting twice.',
  actors: [
    { id: 'app', label: 'alice’s app', kind: 'plain' },
    { id: 'card', label: 'card service', kind: 'bank' },
    { id: 'keys', label: 'idempotency_keys', kind: 'plain' },
  ],
  steps: [
    { from: 'app', to: 'card', label: 'report-lost, key K1', note: 'The app sends `POST /v1/cards/{id}/report-lost` with the header `Idempotency-Key: K1`. It made up K1 itself, a fresh random value for this one intended action.' },
    { from: 'card', to: 'keys', label: 'claim K1: IN_PROGRESS', note: 'Before doing anything, the service records K1 for this caller and endpoint, with a fingerprint of the request, and marks it in progress.' },
    { from: 'card', to: 'card', kind: 'self', label: 'card → LOST, event', note: 'The real work happens: the card becomes LOST and a `CARD_LOST` event is queued.' },
    { from: 'card', to: 'keys', label: 'store 200 + body', note: 'The service saves the exact response next to K1.' },
    { from: 'card', to: 'app', kind: 'reply', label: '200 … lost on the way', note: 'The response leaves the service, but the connection drops. The app sees a timeout and cannot tell whether the card was reported.' },
    { from: 'app', to: 'card', label: 'same request, same K1', note: 'The app retries with the same body and the same key. That is the whole trick: a retry reuses the key; a new action gets a new one.' },
    { from: 'card', to: 'keys', label: 'K1 is done', note: 'The service finds K1 finished, with a matching fingerprint.' },
    { from: 'card', to: 'app', kind: 'reply', label: '200, Idempotent-Replayed: true', note: 'It replays the stored response byte for byte, with `Idempotent-Replayed: true`. Nothing runs twice and no second event is published.' },
  ],
  caption: 'The retry gets the first answer back instead of a second action.',
});

export default {
  minutes: 11,
  lede: 'Networks fail in an awkward way: sometimes a request arrives and does its work, but the answer never makes it back. The caller cannot tell “it never happened” from “it happened and I missed the reply”. This lesson shows how CardVault makes it safe to simply try again.',
  youWill: 'You will learn what an idempotency key is, every answer it can produce, and the other places CardVault guards against doing things twice.',
  body: `
<h2>The problem with retrying</h2>
<p>Suppose an app asks the bank to send money and the request times out. If it does nothing, the money might not have been sent. If it tries again, the money might be sent twice. Neither choice is safe unless the server can recognise a repeat.</p>
<p>An operation is <strong>idempotent</strong> when doing it twice has the same effect as doing it once. Some operations are naturally like that: reporting a card lost twice still leaves one lost card, as <a href="/learn/card-lifecycle/">the last lesson</a> showed. Others are not: “add this card to the wallet” or “open a dispute” would happily run twice. An <strong>idempotency key</strong> makes any operation safe to repeat.</p>

<h2>How a key works</h2>
${lostReply}
<p>The key is chosen by the <em>client</em>, usually a random UUID, one per intended action. CardVault stores it with three things:</p>
<ul>
<li><strong>Who and where:</strong> the caller (the customer ID or the service name) and the endpoint. alice’s key can never replay bob’s response, even if they pick the same value.</li>
<li><strong>A fingerprint</strong> of the method, the path and the body, to spot a key reused for something different.</li>
<li><strong>The response</strong>, once there is one, to replay exactly.</li>
</ul>

<h2>Every possible answer</h2>
${table(['Situation', 'Answer'], [
  ['No `Idempotency-Key` header', 'The request runs normally. The key is optional.'],
  ['A new key', 'The request runs, and its response is stored.'],
  ['The same key, same request, finished', 'The stored status and body, with `Idempotent-Replayed: true`.'],
  ['The same key, same request, still running', '`409 IDEMPOTENCY_IN_PROGRESS`. Wait and try again.'],
  ['The same key, a different body or path', '`422 IDEMPOTENCY_KEY_REUSED`.'],
  ['A key longer than 128 characters', '`422 VALIDATION_ERROR`.'],
])}
<p>Two details are easy to miss:</p>
<ul>
<li><strong>Client errors are replayed; server errors are not.</strong> If the first attempt got <code>409</code> or <code>422</code>, the retry gets the same <code>409</code> or <code>422</code>. If it got a <code>5xx</code>, the key is forgotten, so a retry really runs again. A server error means “try again”; a client error means “this request is wrong”, and repeating it will not change that.</li>
<li><strong>Keys expire after 24 hours</strong> on the shared clock, and <code>/test/reset</code> clears them all.</li>
</ul>
${keyIdea(`<p>The rule for clients is short: <strong>a retry reuses the key; a new action gets a new key.</strong> A client that makes a fresh key for every attempt has no protection at all, and one that reuses a key for a different action gets <code>422</code>.</p>`)}

<h2>Where CardVault accepts a key</h2>
${table(['Service', 'Endpoints'], [
  ['card', 'report-lost, reissue, close'],
  ['enrollment', 'add a card to the wallet, remove one, opt out, opt in'],
  ['profile', 'send a verification code, verify a code'],
  ['wallet-txn', 'open a dispute'],
])}

<h2>Other ways CardVault avoids doing things twice</h2>
<p>Idempotency keys protect customer actions. Machine-to-machine traffic carries its own natural IDs, and each one plays the same role:</p>
${table(['What arrives', 'Recognised by', 'A repeat gets'], [
  ['An authorization from the network', '`trace_id`', 'The original decision, and no second hold'],
  ['A clearing record', '`clearing_id`', 'The original result; a different body is `422 CLEARING_ID_REUSED`'],
  ['A push to the wallet operator', '`Idempotency-Key: <enrollment_id>:<version>`', 'The operator’s original `202`, and no second callback'],
  ['An event read by enrollment or wallet-txn', 'Its `event_id`, kept in a processed-events table', 'Skipped'],
])}
<p>The pattern is always the same: a stable ID for “this one piece of work”, remembered by the receiver. You will meet the last two again in <a href="/learn/enrolment/">Enrolment and the wallet operator</a> and <a href="/learn/consumers-and-dead-letters/">Consumers, retries and dead letters</a>.</p>
${testerEye(`<p>Good idempotency tests send the same thing twice and check the <em>side effects</em>, not only the response: one lost card and one <code>CARD_LOST</code> event, one hold, one dispute. Then try the edges: same key with a changed body (<code>422</code>), two identical requests at the same moment (one runs, the other gets <code>409 IDEMPOTENCY_IN_PROGRESS</code> or the replay), and a retry after a <code>5xx</code> fault, which must run again.</p>`)}
${realWorld(`<p>Payment APIs across the industry use this same header and the same rules. Twenty-four hours is a common retention; a real bank picks it from how long its clients might keep retrying, which is often much longer for batch systems.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Idempotent', 'Doing it twice has the same effect as doing it once.'],
  ['Idempotency key', 'A client-chosen ID, sent as `Idempotency-Key`, that lets the server recognise a retry.'],
  ['Replay', 'Returning the stored first response to a retry, marked `Idempotent-Replayed: true`.'],
  ['Request fingerprint', 'A hash of method, path and body, used to spot a key reused for a different request.'],
  ['`trace_id`', 'The network’s ID for one authorization. A repeat gets the same decision.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'alice adds a card to the wallet with key K7 and the first attempt gets `422 CARD_INELIGIBLE`. Her app retries with the same body and K7. What comes back?',
  options: ['The request runs again and may succeed', 'The same `422 CARD_INELIGIBLE`, replayed', '`409 IDEMPOTENCY_IN_PROGRESS`', '`422 IDEMPOTENCY_KEY_REUSED`'],
  answer: 1,
  why: '<p>Client errors are stored and replayed like successes. To try again after fixing the cause, for example after using the card, the app needs a new key.</p>',
})}
${check({
  q: 'A test sends report-lost with key K2 while a fault makes the card service answer `503`. The fault is then removed and the test retries with K2. What happens?',
  options: ['The stored `503` is replayed', 'The request runs normally, because server errors are not stored', '`409 IDEMPOTENCY_IN_PROGRESS`', '`422 IDEMPOTENCY_KEY_REUSED`'],
  answer: 1,
  why: '<p>A <code>5xx</code> means “try again”, so the key is forgotten and the retry runs for real. Replaying a server error would make a temporary problem permanent.</p>',
})}
${check({
  q: 'The network mock sends the same authorization, with the same `trace_id`, twice. What is the result on the card?',
  options: ['Two holds, available reduced twice', 'One hold; the second call gets the same decision', 'The second call is declined', 'The second call gets `409`'],
  answer: 1,
  why: '<p>Authorizations are recognised by <code>trace_id</code>. The decision is stored, and a repeat returns it without creating another hold.</p>',
})}

<h2>Recap</h2>
${recap([
  'A lost response leaves the client unsure; idempotency makes retrying safe.',
  'The client picks one `Idempotency-Key` per intended action and reuses it only for retries.',
  'Replays return the stored response; in-progress is `409`; a changed request is `422`.',
  'Client errors are replayed, server errors are forgotten, and keys last 24 hours.',
  'Machines use natural IDs the same way: `trace_id`, `clearing_id`, push keys and event IDs.',
])}
`,
};
