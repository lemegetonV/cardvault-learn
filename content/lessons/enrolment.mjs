import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, sequence } from '../../src/components.mjs';
import { enrolmentStates } from '../diagrams/wallet.mjs';

const enrol = sequence({
  id: 'seq-enrol',
  label: 'A customer adds a card. The enrollment service answers 202 PENDING and queues a call to the operator. The operator accepts, gets a token from the network mock, and calls back with ENROLLED and the token. The enrollment service records it and publishes enrollment.changed, and the card service stores the token.',
  actors: [
    { id: 'web', label: 'Customer', kind: 'plain' },
    { id: 'enr', label: 'enrollment', kind: 'bank' },
    { id: 'op', label: 'operator mock', kind: 'mock' },
    { id: 'net', label: 'network mock', kind: 'mock' },
    { id: 'card', label: 'card service', kind: 'bank' },
  ],
  steps: [
    { from: 'web', to: 'enr', label: 'POST /v1/wallet/cards/{id}', note: 'alice adds a card, sending the version of the wallet terms she accepted. The service checks eligibility first.' },
    { from: 'enr', to: 'web', kind: 'reply', label: '202, status PENDING', note: 'In one transaction: the enrolment row is created as PENDING, an operator call is queued in the outbox, and `enrollment.changed` is queued too. The customer gets her answer at once.' },
    { from: 'enr', to: 'op', label: 'POST /v1/enrollments (signed)', note: 'The operator relay sends the call, signed with HMAC and carrying `Idempotency-Key: {enrollment_id}:{version}`.' },
    { from: 'op', to: 'enr', kind: 'reply', label: '202 + operator_ref', note: 'The operator accepts and gives its own reference for this enrolment, which the bank stores. Nothing is decided yet.' },
    { from: 'op', to: 'net', label: 'POST /v1/tokens', note: 'About 2 seconds later, the operator asks the network for a wallet token for this card.' },
    { from: 'net', to: 'op', kind: 'reply', label: 'tok_…', note: 'The network creates the token and remembers which card it belongs to.' },
    { from: 'op', to: 'enr', label: 'callback: ENROLLED + token_ref', note: 'The operator calls the bank back with a signed callback carrying the new status and the token.' },
    { from: 'enr', to: 'card', kind: 'event', label: 'enrollment.changed', note: 'The enrolment becomes ENROLLED with its token. The event tells the card service, which stores the token so purchases with it can be approved.' },
  ],
  caption: 'Adding a card takes two round trips: the request, and later the callback.',
});

export default {
  minutes: 12,
  lede: 'Adding a card to a phone wallet is not something the bank can do alone. The wallet belongs to another company, the wallet operator, and the bank has to ask. The answer comes back later, in a separate call. This lesson follows that conversation and the statuses an enrolment moves through.',
  youWill: 'You will follow a card into the wallet step by step, learn the five enrolment statuses, and see why a removal by the customer takes effect at once.',
  body: `
<h2>Who does what</h2>
<p>Three parties are involved. The <strong>enrollment service</strong> is the bank’s side: it decides what should happen and keeps the <strong>system of record</strong> (SOR), the bank’s authoritative list of enrolments. The <strong>wallet operator</strong> runs the wallet on the phone; in CardVault it is a mock that tests can control. The <a href="/learn/network-mock/">network mock</a> issues the wallet token.</p>
<p>The operator does not answer “done” straight away. It answers “accepted” and calls the bank back later with the outcome. That is common for slow external work, and it means the bank’s record must have a status for “asked, not yet confirmed”.</p>
${enrol}

<h2>Five statuses</h2>
${figure({ svg: enrolmentStates() })}
${table(['Status', 'Meaning', 'Can the token be used?'], [
  ['`PENDING`', 'Asked the operator, waiting for the callback', 'No, there is no token yet'],
  ['`ENROLLED`', 'In the wallet', 'Yes'],
  ['`SUSPENDED`', 'Paused, for example because the card is lost', 'No: `TOKEN_INACTIVE`'],
  ['`REMOVED`', 'Taken out of the wallet', 'No: `TOKEN_INACTIVE`'],
  ['`FAILED`', 'The operator declined, or could not be reached', 'No'],
])}
<p>Each card has at most one enrolment row. Adding a card again after REMOVED or FAILED reuses that row, starts again at PENDING, and gets a <em>new</em> token; the old token stays dead.</p>
<p>Every status change is written to an audit trail and published as <code>enrollment.changed</code>, with a <code>version</code> that increases on every call to the operator. The card service uses that version to keep its token copy in order, as you saw in <a href="/learn/consumers-and-dead-letters/">Consumers, retries and dead letters</a>.</p>

<h2>What the customer can do</h2>
${table(['Endpoint', 'Effect'], [
  ['`GET /v1/wallet`', 'Every card with its eligibility and enrolment'],
  ['`POST /v1/wallet/cards/{card_id}`', '202 and PENDING; 200 if already in the wallet; `422 CARD_INELIGIBLE`; `409 WALLET_OPTED_OUT`'],
  ['`DELETE /v1/wallet/cards/{card_id}`', 'REMOVED at once; the sweep will not re-add it'],
  ['`POST /v1/wallet/opt-out`', 'Every card REMOVED at once'],
  ['`POST /v1/wallet/opt-in`', 'Accepts the terms and adds every eligible card'],
])}
<p>Adding and opting in send a <code>terms_version</code>: the version of the operator’s terms the customer agreed to. In the web app those terms appear in a frame served by the operator, as <a href="/learn/browser-security/">Browser security</a> explains. All four POST and DELETE calls accept an <a href="/learn/idempotency-keys/">idempotency key</a>, and repeating a removal or opt-out returns 200 with no new change.</p>
${keyIdea(`<p>When the <em>customer</em> removes a card or opts out, the enrolment becomes REMOVED immediately, before the operator has confirmed anything. The card service hears about it at once, so the token stops working at once. Safety comes first; the operator catches up.</p>`)}
<p>When the <em>bank</em> decides a card must leave, for example because it was closed, it asks the operator and waits for the callback before marking it REMOVED. <a href="/learn/when-a-card-changes/">When a card changes</a> covers those cases.</p>

<h2>When the operator cannot be reached</h2>
<p>The call to the operator goes through the outbox, with a separate relay so a slow operator never delays events. A 5xx answer, a timeout or a lost connection is retried with growing delays, up to 5 attempts. A 4xx answer is not retried, because sending the same request again cannot fix it. A 409 is the exception: it means the operator already has this idempotency key, so the bank counts it as success.</p>
<p>If an enrol call gives up, the enrolment becomes FAILED with <code>status_reason</code> <code>OPERATOR_UNAVAILABLE</code>. The customer can try again, and the sweep will too, at most once a day.</p>
${testerEye(`<p>Enrolment is asynchronous, so a test adds a card, asserts the immediate <code>202</code> and <code>PENDING</code>, then polls <code>GET /v1/wallet/cards/{card_id}</code> until it is ENROLLED, with a bounded wait. The operator mock’s controls make the unhappy paths reachable: <code>error</code> and <code>timeout</code> make the operator fail, <code>decline_enrollment</code> makes it answer FAILED, and <code>callback_delay</code> keeps an enrolment PENDING for as long as you need. To skip the wait when it is not the point of the test, <code>POST /test/customers</code> on the enrollment service can create a customer whose cards are already ENROLLED.</p>`)}
${realWorld(`<p>Real wallet providers ask the bank to approve each card as it is added, often with an extra check such as a code sent to the customer, and they add the card to a specific device. CardVault reverses the direction to keep one simple flow: the bank asks, the operator confirms.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Wallet operator', 'The company that runs the phone wallet. A controllable mock in CardVault.'],
  ['System of record (SOR)', 'The authoritative copy of some data. For enrolments, the bank’s `enrollments` table.'],
  ['Enrolment', 'One card’s membership of the wallet, with a status and a token.'],
  ['Callback', 'A call from the operator back to the bank, reporting the outcome of an earlier request.'],
  ['`operator_ref`', 'The operator’s own reference for an enrolment, returned when it accepts.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'alice adds an eligible card. The answer is `202` with status PENDING. Can she pay with the wallet right now?',
  options: ['Yes, 202 means it worked', 'No, there is no token until the operator’s callback makes it ENROLLED', 'Yes, but only small amounts', 'No, she must add it again'],
  answer: 1,
  why: '<p>202 means “accepted, in progress”. The token arrives with the ENROLLED callback about two seconds later.</p>',
})}
${check({
  q: 'alice removes an ENROLLED card, and the operator mock is down. Does a wallet purchase with that token still work while the operator is unreachable?',
  options: ['Yes, until the operator confirms', 'No, a customer removal is REMOVED at once and the card service stops the token straight away', 'It depends on the amount', 'Yes, removal needs a callback'],
  answer: 1,
  why: '<p>Customer removals take effect immediately at the bank. The call to the operator is retried in the background.</p>',
})}
${check({
  q: 'The operator answers an enrol call with `400`. What does the bank do?',
  options: ['Retries 5 times', 'Gives up at once: the enrolment becomes FAILED, and `failure_reason` records the rejection', 'Retries forever', 'Counts it as success'],
  answer: 1,
  why: '<p>A 4xx (other than 409) means the request itself was rejected, so a retry cannot help. The push fails at once.</p>',
})}

<h2>Recap</h2>
${recap([
  'The bank asks; the operator accepts with 202 and answers later with a signed callback.',
  'Statuses: PENDING, ENROLLED, SUSPENDED, REMOVED, FAILED. Only ENROLLED tokens work.',
  'Customer removal and opt-out are REMOVED at once; bank-driven removal waits for the callback.',
  'Calls to the operator go through the outbox: 5 attempts for 5xx and timeouts, none for 4xx, 409 counts as success.',
  'Every change publishes `enrollment.changed`, which keeps the card service’s token copy current.',
])}
`,
};
