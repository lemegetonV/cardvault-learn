import { figure, keyIdea, testerEye, terms, check, recap, code, table } from '../../src/components.mjs';
import { callbackTwoWays } from '../diagrams/suite.mjs';

export default {
  minutes: 14,
  lede: 'Adding a card to the wallet is a conversation that ends later: the bank answers “pending” at once, and the operator’s callback settles it a couple of seconds afterwards. A flow like that needs two kinds of test. One follows the whole conversation and proves it ends well. The other steps into the middle and plays the operator’s part, to test every answer the bank might receive.',
  youWill: 'You will learn how to follow an asynchronous flow to its real end, how the suite signs a callback as the operator would, and how layered checks are tested one layer at a time.',
  body: `
<h2>Following the flow to its end</h2>
<p>The first track’s <a href="/learn/enrolment/">Enrolment and the wallet operator</a> stepped through the conversation. From a test’s point of view it has three observable points: the immediate <code>202</code> with status <code>PENDING</code>, the later status <code>ENROLLED</code>, and the moment the new wallet token actually works for a purchase.</p>
${code({ title: 'tests/api/tests/enrolment/test_add_and_remove.py (part)', src: `
def test_adding_an_eligible_card_ends_enrolled_with_a_working_token(
    make_customer, enrolments, card_network
):
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]

    added = expect(someone.wallet.add(card_id), 202, WalletCard)
    assert added.enrollment.status == "PENDING"

    enrolled = wait_for_enrolment(someone, card_id, "ENROLLED")
    assert enrolled.enrollment.last4 == enrolled.last4
    token_ref = enrolments.record(card_id)["token_ref"]
    assert token_ref
    # card-service learns about the new token from an event, so allow it a moment.
    decision = wait_until(
        lambda: expect(card_network.purchase(card_id, 100, token_ref), 200, Authorization),
        lambda d: d.decision == "APPROVED",
        timeout=10,
        what="a wallet purchase with the new token to be approved",
    )
    assert decision.decline_code is None
` })}
<p>The test does not stop at <code>ENROLLED</code>. The business result of joining the wallet is that the card can pay with its token, and that needs a second asynchronous step: an event tells the card service about the token. So the test waits a second time, for a purchase with that token to be approved. Each wait uses <a href="/learn/suite-waiting/">wait_until</a>, and each asks a question only a working system answers correctly.</p>
<p><code>enrolments</code> is a fixture that reads the bank’s own enrolment record through a test endpoint, because the customer API does not show the token. That is a deliberate step behind the public API, taken to get one fact the test needs.</p>

<h2>Why the whole flow is not enough</h2>
<p>The real operator mock always sends a sensible callback. The bank, though, must cope with callbacks that are forged, delayed, repeated or out of date, and the whole-flow test never produces those. So the suite also talks to the bank’s callback endpoint directly, as if it were the operator:</p>
${figure({ svg: callbackTwoWays(), caption: 'The whole flow proves the parts work together. Sending callbacks directly lets the test choose every field, including the wrong ones.' })}

<h2>Signing like the operator</h2>
<p>The bank accepts a callback only if it is signed with a secret that the bank and the operator share. The signature is an <strong>HMAC</strong>: a short code computed from the secret and the exact bytes of the message. Anyone without the secret cannot produce it, and changing even one byte of the body changes it completely. The suite signs exactly as the operator does:</p>
${code({ title: 'tests/api/src/cardvault_tests/signing.py (part)', src: `
def sign(secret: str, timestamp: int, body: bytes) -> str:
    message = f"{timestamp}.".encode() + body
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def signed_request(secret: str, payload: dict[str, Any], timestamp: int) -> tuple[bytes, dict]:
    """The body bytes and headers for a signed callback."""
    body = json.dumps(payload, separators=(",", ":")).encode()
    headers = {
        "Content-Type": "application/json",
        "X-Timestamp": str(timestamp),
        "X-Signature": sign(secret, timestamp, body),
    }
    return body, headers
` })}
<p><code>hmac</code> and <code>hashlib</code> are part of Python’s standard library. <code>.encode()</code> turns text into bytes, because a signature is computed over bytes. The body is turned into JSON bytes once, signed, and sent as those same bytes; if httpx were allowed to re-serialise the dictionary, spacing could differ and the signature would no longer match. The timestamp is signed too, so an old callback cannot be replayed later with a fresh time. The first track’s <a href="/learn/callbacks/">Callbacks in depth</a> explains the bank’s side.</p>

<h2>Testing the layers in order</h2>
<p>The bank checks a callback in layers, and the first layer to object decides the answer. The suite’s callback file tests each layer by breaking exactly one thing:</p>
${table(['Layer', 'Broken on purpose', 'Expected'], [
  ['Signature', 'No signature · another secret · body changed after signing', '`401 SIGNATURE_MISSING` · `401 SIGNATURE_INVALID`'],
  ['Timestamp', '305 s early or late (295 s must pass)', '`401 SIGNATURE_EXPIRED`'],
  ['Body shape', 'Unknown status, negative version, bad event id', '`422 VALIDATION_ERROR`'],
  ['Known enrolment', 'An enrolment id the bank never issued', '`404 ENROLLMENT_NOT_FOUND`'],
  ['Seen before', 'The same event id twice', '`200`, result `DUPLICATE`'],
  ['Apply', 'Older version · status nobody asked for · enrolment already removed', '`STALE` · `SUPERSEDED` · `IGNORED_REMOVED`'],
])}
<p>The timestamp rows are a boundary test again: the window is five minutes, so 295 seconds either way must be accepted and 305 refused. They need no clock move. The test reads the enrollment service’s current time through its clock control and signs with that time plus or minus the skew, so these tests can run in parallel with everything else.</p>
${code({ title: 'tests/api/tests/callbacks/test_operator_callbacks.py (part)', src: `
def test_an_older_operator_version_is_ignored_as_stale(enrolled, callbacks, bank_now):
    someone, record = enrolled
    body = callback(record, "REMOVED", record["operator_version"] - 1)

    ack = expect(callbacks.send(body, bank_now()), 200, CallbackAck)

    assert (ack.result, ack.status) == ("STALE", "ENROLLED")
    assert wallet_card(someone, record["card_id"]).enrollment.status == "ENROLLED"
` })}
<p>A stale callback is accepted with <code>200</code>, because the operator did nothing wrong by sending it; the bank simply ignores it. So a <code>200</code> alone proves nothing here. The test checks the acknowledgement’s <code>result</code>, and then reads the wallet to confirm the card is still enrolled.</p>
${keyIdea(`<p>Test an asynchronous flow twice: once end to end, waiting for the real business result, and once by playing the other party directly, so every unusual answer can be sent on purpose.</p>`)}
${testerEye(`<p>When a flow has layered checks, break one thing per test and expect the error of that layer. A test that breaks two things at once only proves that something objected.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Asynchronous flow', 'Work that is accepted now and finished later, such as an enrolment completed by a callback.'],
  ['HMAC', 'A code computed from a shared secret and a message; it proves who sent the message and that it was not changed.'],
  ['Stale callback', 'A callback carrying an older version than the bank already holds; it is acknowledged and ignored.'],
  ['Bytes', 'The raw form of data that is sent and signed; `.encode()` turns text into bytes.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test adds a card and waits for ENROLLED, then stops. What part of the business result is still unproven?',
  options: ['Nothing', 'That the token actually works for a purchase, which depends on a later event reaching the card service', 'That the card is a credit card', 'That the customer is logged in'],
  answer: 1,
  why: '<p>ENROLLED is the bank’s record. The customer cares that the wallet can pay, and that needs the card service to learn about the token, a separate asynchronous step.</p>',
})}
${check({
  q: 'A test builds a callback dictionary, signs `json.dumps(payload)`, then sends it with httpx’s `json=payload`. The bank replies 401 SIGNATURE_INVALID. Why?',
  options: ['The secret is wrong', 'httpx serialised the dictionary again, possibly with different spacing, so the bytes sent are not the bytes signed', 'The timestamp is too old', 'Callbacks cannot be sent by tests'],
  answer: 1,
  why: '<p>The signature covers exact bytes. Sending the same dictionary serialised differently changes the bytes, so the bank’s recomputed signature differs. The suite signs bytes and sends those bytes.</p>',
})}
${check({
  q: 'An older callback returns `200` with result `STALE`. What should the test assert besides the status code?',
  options: ['Nothing more', 'The result is STALE and the enrolment still has its newer status', 'That a 409 was returned', 'That the callback was signed'],
  answer: 1,
  why: '<p>The bank acknowledges a stale callback so the operator stops sending it. The claim being tested is that it changed nothing, so the test checks the result field and reads the status back.</p>',
})}

<h2>Recap</h2>
${recap([
  'Follow an asynchronous flow to its business result, waiting at each later step.',
  'Play the other party directly to send unusual, wrong or old messages on purpose.',
  'Sign exact bytes and send those bytes; the timestamp is part of what is signed.',
  'Break one layer per test, and read the state back when the answer is a 200.',
])}
`,
};
