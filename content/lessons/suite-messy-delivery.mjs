import { figure, keyIdea, testerEye, realWorld, terms, check, recap, code } from '../../src/components.mjs';
import { messyDelivery } from '../diagrams/suite.mjs';

export default {
  minutes: 13,
  lede: 'On a quiet test system, events arrive once, in order, and well formed. Real Kafka is not so tidy: it may deliver an event twice, two topics have no order between them, and sometimes a message arrives that nobody can read. The consumer in the wallet transaction service must cope with all three. Those situations will not happen on their own during a test, so the suite causes them itself.',
  youWill: 'You will learn how the suite publishes events of its own to recreate redelivery, reordering and a poison message, how it keeps those events inside its own test data, and how it proves a consumer has caught up.',
  body: `
<h2>Three things the happy path never shows</h2>
<p>The first track’s <a href="/learn/consumers-and-dead-letters/">Consumers, retries and dead letters</a> lesson described the rules the consumer follows. Each one has an expected outcome the suite can check:</p>
${figure({ svg: messyDelivery(), caption: 'Each case has an outcome fixed by the spec. The tests create each case on purpose and check the outcome.' })}

<h2>Publishing as if you were a service</h2>
<p>To create these situations, the suite needs to put messages on a topic itself. A <strong>producer</strong> is the Kafka name for a program that publishes; the suite has a small helper for it:</p>
${code({ title: 'tests/api/src/cardvault_tests/events.py (part)', src: `
def produce_raw(bootstrap: str, topic: str, key: str, value: bytes) -> None:
    """Publish a message as if a service had, e.g. a malformed one. Uncompressed, because
    the services cannot read every compression codec."""
    producer = Producer({"bootstrap.servers": bootstrap, "compression.type": "none"})
    producer.produce(topic, key=key.encode(), value=value)
    assert producer.flush(10) == 0, f"message to {topic} was not delivered"
` })}
<p><code>produce</code> only queues the message; <code>flush</code> waits up to ten seconds for everything queued to be delivered and returns how many messages are still waiting. Asserting that it is zero makes a delivery failure a clear test failure instead of a silent nothing.</p>
<p>Publishing on shared topics needs care, because every consumer will act on these messages. The suite never invents events from scratch. It first creates a real purchase on a fresh customer’s card and captures its two real events. Each test then republishes copies of those, changing the <code>trace_id</code> where it needs a new transaction. The copies therefore belong to the test’s own card and customer and cannot touch anyone else’s data, which is why most of these tests can run in parallel.</p>

<h2>The same event twice</h2>
${code({ title: 'tests/api/tests/events/test_consuming_events.py (part)', src: `
def test_a_redelivered_event_changes_nothing(captured, settings):
    someone, auth_event, clear_event = captured
    before = expect(someone.transactions.list(), 200, TransactionPage).items

    # Exactly the same envelopes again, as Kafka does after a consumer restart.
    republish(clear_event, settings, as_new=False)
    republish(auth_event, settings, as_new=False)
    # A marker event published after them on the same key (same partition) shows they were
    # consumed: once the marker's transaction exists, the repeats were handled before it.
    marker = new_trace_id()
    republish(auth_event, settings, trace_id=marker)
    wait_for_transaction(someone, marker)

    after = [
        t
        for t in expect(someone.transactions.list(), 200, TransactionPage).items
        if t.trace_id != marker
    ]
    assert after == before
` })}
<p><code>as_new=False</code> keeps the original <code>event_id</code>, so the consumer sees a true redelivery and should recognise it. The difficulty is knowing when to look: “nothing changed” is true straight away, before the consumer has even read the repeats. This is the absence problem from <a href="/learn/suite-waiting/">Waiting without sleeping</a>, and the answer is the same: a marker. A new event on the same key lands on the same partition after the repeats, so once its transaction appears, the repeats have been processed. Only then is “the list is unchanged” a meaningful check.</p>

<h2>The wrong order</h2>
<p>Authorizations and clearings travel on two different topics, and Kafka keeps no order between topics. So a clearing can arrive before the authorization it clears. The test publishes a clearing for a new <code>trace_id</code> first and checks the half-built row: the cleared amount is known, but the authorization’s amount and merchant are still empty. Then it publishes the authorization and expects exactly the end state the usual order gives: <code>SETTLED</code>, with both amounts. The expected value is “the same as in-order delivery”, which the earlier transaction tests have already pinned down.</p>

<h2>A message nobody can read</h2>
${code({ title: 'tests/api/tests/events/test_consuming_events.py (part)', src: `
    dlq = watch("wallet.txn.dlq")
    poison = b'{"this is": "not an envelope"'

    produce_raw(settings.kafka_bootstrap, "auth.decided", auth_event.key, poison)

    parked = dlq.wait_for(lambda e: e.raw == poison, what="the poison message on the DLQ")
    assert parked.headers["source_topic"] == "auth.decided"
    assert parked.headers["error"]
    # The partition moved on: a later event on the same key is still applied.
    trace_id = new_trace_id()
    republish(auth_event, settings, trace_id=trace_id)
    assert wait_for_transaction(someone, trace_id).status == "AUTHORIZED"
` })}
<p>A <strong>poison message</strong> is one a consumer can never process, here broken JSON (the <code>b'…'</code> prefix makes it bytes). The rule is to retry a few times, then park it on a <strong>dead-letter queue</strong> (DLQ), a separate topic for messages that need a person. The test checks both halves of the rule. The message reached the DLQ, labelled with where it came from and why it failed. And the partition was not blocked: a good event published after it, on the same key, is still applied.</p>
<p>This test alone is <a href="/learn/suite-parallel-serial/">serial</a>. While the consumer retries the poison message, about one and a half seconds, everything behind it on that partition waits, which would slow other tests’ events.</p>
${keyIdea(`<p>To test how a consumer copes with messy delivery, cause the mess yourself: republish copies of real events tied to your own data, then use a marker on the same partition to know the consumer has caught up before you judge the result.</p>`)}
${testerEye(`<p>A consumer that crashes on one bad message and stops reading is far worse than one that loses that message, because everything behind it stops too. Always check that the next good message still gets through.</p>`)}
${realWorld(`<p>Production teams watch the DLQ closely: every message there is a fact the business has not processed. Tests that prove messages reach it, labelled with their source and error, are what make that watching possible.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Producer', 'A program that publishes messages to a Kafka topic.'],
  ['Redelivery', 'The same message delivered again, with the same event id, as Kafka may do after a restart.'],
  ['Poison message', 'A message a consumer can never process, such as broken JSON.'],
  ['Dead-letter queue (DLQ)', 'A topic where unprocessable messages are parked, with their source and error, for a person to look at.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test republishes an event with the same event_id, immediately lists the customer’s transactions and finds them unchanged. Why does that prove little?',
  options: ['The list is cached', 'The consumer may not have read the repeat yet, so “unchanged” could just mean “not processed yet”', 'Redelivery needs a new event_id', 'The list is always unchanged'],
  answer: 1,
  why: '<p>Without a point after which the repeat must have been handled, an unchanged list proves nothing. A marker event on the same partition provides that point.</p>',
})}
${check({
  q: 'Why does the suite republish copies of real events instead of writing new events by hand?',
  options: ['Hand-written events are not allowed', 'Copies of real events tied to the test’s own card keep the effects inside the test’s data and match the real event shape', 'It is faster', 'Kafka rejects new events'],
  answer: 1,
  why: '<p>Every consumer acts on what is published. Copies built from the test’s own purchase only affect that customer, and they have exactly the shape services produce, so the test is about delivery, not about a home-made event.</p>',
})}
${check({
  q: 'A poison message lands on the DLQ. What else must the test check?',
  options: ['That the DLQ is empty', 'That a later good message on the same partition is still applied', 'That Kafka restarted', 'Nothing'],
  answer: 1,
  why: '<p>Parking the message is half the rule. The other half is that the consumer moves on; a consumer stuck on the bad message would block every later event for that key.</p>',
})}

<h2>Recap</h2>
${recap([
  'Redelivery, cross-topic reordering and poison messages are caused on purpose with `produce_raw`.',
  'Republished copies of the test’s own real events keep effects inside its data.',
  'A marker on the same partition shows the consumer has caught up.',
  'A poison message must reach the DLQ, labelled, and the partition must move on.',
])}
`,
};
