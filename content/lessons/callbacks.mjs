import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, code } from '../../src/components.mjs';
import { callbackChecks, outOfOrder } from '../diagrams/wallet.mjs';

export default {
  minutes: 11,
  lede: 'A callback is the operator telling the bank what happened. It sounds simple, but callbacks arrive over a network: some arrive twice, some arrive late and out of order, and some may not be from the operator at all. This lesson shows the checks every callback passes before it is allowed to change anything.',
  youWill: 'You will learn the order of the callback checks, what each answer means, and how CardVault tells an old callback from a new one.',
  body: `
<h2>What a callback carries</h2>
<p>The operator sends callbacks to <code>POST /v1/callbacks/operator</code> on the enrollment service. Each one describes the operator’s record as it is now.</p>
${code({ lang: 'json', title: 'An ENROLLED callback', src: `{
  "event_id": "3b1d…",
  "operator_ref": "op_e4400000a11c40008000000000000001",
  "enrollment_id": "e4400000-a11c-4000-8000-000000000001",
  "status": "ENROLLED",
  "token_ref": "tok_a11ce0c4ed170000000001",
  "operator_version": 1,
  "occurred_at": "2026-11-25T09:30:02.114000Z"
}` })}
${table(['Field', 'Used for'], [
  ['`event_id`', 'Unique per callback, to recognise a repeat'],
  ['`status`', 'ENROLLED, SUSPENDED, REMOVED or FAILED'],
  ['`operator_version`', 'A counter the operator raises with every change to this record, to recognise an old callback'],
  ['`token_ref`', 'The wallet token, on ENROLLED'],
  ['`reason`', 'Why, on FAILED'],
])}

<h2>The checks, in order</h2>
${figure({ svg: callbackChecks() })}
<p>The first check is the signature. The operator signs each callback with HMAC, exactly as described in <a href="/learn/machines-calling-machines/">Machines that call machines</a>, so a forged or altered callback is refused with <code>401</code> before its body is even read.</p>
<p>After that, every outcome is a <code>200</code>, with a <code>result</code> field saying what happened. That is deliberate. The operator resends a callback that gets a 5xx or no answer. A <code>200</code> tells it “received, you can stop”, even when the bank decided to ignore the callback.</p>
${table(['result', 'Meaning'], [
  ['`APPLIED`', 'The callback changed the enrolment'],
  ['`DUPLICATE`', 'This `event_id` was seen before; nothing changed'],
  ['`IGNORED_REMOVED`', 'The enrolment is already REMOVED; nothing brings it back by callback'],
  ['`STALE`', 'Its `operator_version` is older than the one stored'],
  ['`SUPERSEDED`', 'The bank has since asked for something else; this answer is out of date'],
  ['`FAILURE_RECORDED`', 'A FAILED callback for a suspend, resume, update or remove: the reason is kept, the status is not changed'],
])}
<p>The <code>event_id</code> is recorded in the same transaction as the change, so a duplicate can never be half-applied. It is the same reasoning as <a href="/learn/consumers-and-dead-letters/">deduplicating events</a>, now for HTTP calls.</p>

<h2>Old news: stale and superseded</h2>
<p>Two callbacks for the same enrolment can overtake each other on the network. The <code>operator_version</code> tells the bank which is newer.</p>
${figure({ svg: outOfOrder() })}
<p>A callback can also be newer than the stored version and still out of date. Suppose the card is reported lost, so the bank asks to suspend, and a moment later the card is reissued, so the bank asks to resume. When the SUSPENDED callback arrives, the bank is already waiting for the resume. Applying SUSPENDED would show a state the bank no longer wants. So the bank compares each callback with its <strong>last request still waiting for an answer</strong> and acknowledges anything that does not fit as <code>SUPERSEDED</code>.</p>
${keyIdea(`<p>A callback reports what the operator did, not what the bank must now believe. The bank applies it only if it is new (<code>operator_version</code>), not a repeat (<code>event_id</code>), and still answers the question the bank last asked.</p>`)}

<h2>A FAILED callback</h2>
<p>FAILED means different things depending on what was asked. For an enrol, the enrolment becomes FAILED with the operator’s reason. For anything else, the current status is kept: a card that could not be suspended is still enrolled, and pretending otherwise would hide the problem. The reason is stored in <code>failure_reason</code>, and the next event or sweep asks again.</p>

<h2>Making callbacks misbehave</h2>
<p>The operator mock’s <code>/test/behaviour</code> controls produce every case above on demand:</p>
${table(['Control', 'What the mock does', 'Expect'], [
  ['`duplicate_callback`', 'Sends the same callback twice', '`APPLIED`, then `DUPLICATE`; one history entry'],
  ['`out_of_order_callback`', 'Re-sends the previous callback with a new `event_id` after the latest', '`STALE`; the newer status stays'],
  ['`bad_signature`', 'Signs with the wrong secret', '`401`; status unchanged'],
  ['`callback_delay`', 'Waits longer before calling back', 'PENDING for longer'],
  ['`drop_callback`', 'Never sends it', 'The enrolment stays PENDING'],
])}
<p><code>GET /test/state</code> on the operator mock lists the last 50 callbacks it sent and what the bank answered, which is often the quickest way to see what happened.</p>
${testerEye(`<p>For each control, assert three things: the HTTP answer, the enrolment’s status, and its history at <code>GET /test/enrollments/{enrollment_id}/history</code> on the enrollment service. A duplicate that changes nothing visible but writes a second history row or publishes a second <code>enrollment.changed</code> is still a defect, and only the history or the events will show it.</p>`)}
${realWorld(`<p>Real integrations add a timeout for callbacks that never come: after a while the bank asks the operator for the record’s current state. CardVault has no such job. A dropped callback leaves the enrolment PENDING until someone acts, and reconciliation skips it as in flight. Knowing a system’s limits is part of testing it.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['`operator_version`', 'A counter the operator raises with each change to a record, so the bank can tell newer callbacks from older ones.'],
  ['Stale callback', 'One whose `operator_version` is lower than the one the bank stored.'],
  ['Superseded callback', 'One that no longer matches the bank’s latest request to the operator.'],
  ['Acknowledge', 'Answer 200 so the sender stops resending, whether or not anything changed.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A callback arrives with a valid signature, a new `event_id`, and `operator_version` 2. The stored `operator_version` is 5. What is the answer?',
  options: ['`409 CONFLICT`', '`200` with result `STALE`, and nothing changes', '`200 APPLIED`', '`401`'],
  answer: 1,
  why: '<p>2 is older than 5, so the callback is stale. It is acknowledged with 200 so the operator stops resending, and ignored.</p>',
})}
${check({
  q: 'Why does the bank answer `200` to a duplicate callback instead of `409`?',
  options: ['Because 409 is reserved for idempotency keys', 'Because the operator resends on anything but success; 200 tells it to stop, and the dedupe already made the repeat harmless', 'Because duplicates are applied', 'It answers 409'],
  answer: 1,
  why: '<p>The callback was received and handled correctly. An error status would only make the operator keep trying.</p>',
})}
${check({
  q: 'The bank asked the operator to suspend a card, and the operator sends a FAILED callback. What is the enrolment’s status afterwards?',
  options: ['FAILED', 'Unchanged (still ENROLLED), with the reason stored in failure_reason', 'SUSPENDED', 'REMOVED'],
  answer: 1,
  why: '<p>Only a failed enrol makes the enrolment FAILED. A failed suspend keeps the true current status and records why, so the next event or sweep can ask again.</p>',
})}

<h2>Recap</h2>
${recap([
  'Callbacks are signed; a bad or old signature gets 401 before anything else.',
  'Every other outcome is a 200 with a `result`, so the operator stops resending.',
  'Repeats are caught by `event_id`, old callbacks by `operator_version`.',
  'A callback that no longer fits the bank’s latest request is SUPERSEDED.',
  'A failed suspend, resume, update or remove keeps the status and records the reason.',
])}
`,
};
