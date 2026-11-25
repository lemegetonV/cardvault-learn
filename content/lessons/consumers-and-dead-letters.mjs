import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, code } from '../../src/components.mjs';
import { consumerFlow } from '../diagrams/flow.mjs';

export default {
  minutes: 12,
  lede: 'The last lesson ended with a promise: every event arrives, and some arrive twice. This lesson is about the other end, the consumer. It has to apply each event once, in order, and decide what to do with an event it cannot handle at all.',
  youWill: 'You will follow a message through a CardVault consumer, see how repeats are ignored, and learn the difference between a bad message and a temporary failure.',
  body: `
<h2>What a consumer does</h2>
<p>A <strong>consumer</strong> is the part of a service that reads a topic and acts on each event. CardVault has three, one per reading service.</p>
${table(['Service', 'Consumer group', 'Reads', 'Dead-letter topic'], [
  ['enrollment', '`enrollment-service`', '`card.lifecycle`, `contact.updated`', '`enrollment.dlq`'],
  ['card', '`card-service`', '`enrollment.changed`', '`enrollment.dlq`'],
  ['wallet-txn', '`wallet-txn-service`', '`auth.decided`, `txn.cleared`', '`wallet.txn.dlq`'],
])}
<p>All three share one piece of code in <code>app/shared/kafka.py</code>, so they behave the same way. Each takes one message at a time from a partition, deals with it completely, and only then moves on.</p>
${figure({ svg: consumerFlow() })}
<p>The diagram has three exits besides “apply it”. Each one exists for a reason, and each one is something a tester can trigger.</p>

<h2>Exit 1: the event was already applied</h2>
<p>Because delivery is <a href="/learn/transactional-outbox/">at least once</a>, a consumer must expect repeats. Applying a repeat as if it were new would, for example, add a purchase to the history twice. A consumer that gives the same result however many times it sees an event is called <strong>idempotent</strong>, the same idea you met with <a href="/learn/idempotency-keys/">idempotency keys</a>, now on the reading side.</p>
<p>CardVault uses two techniques.</p>
${table(['Service', 'How it recognises a repeat'], [
  ['enrollment, wallet-txn', 'It records each `event_id` in a `processed_events` table, in the same transaction as the change. If the ID is already there, it skips the event.'],
  ['card', 'Each `enrollment.changed` event carries a `version`. The card service updates its copy of a wallet token only if the new version is higher, so a repeat, or an older event, changes nothing.'],
])}
<p>Recording the <code>event_id</code> in the same transaction matters. If the service crashed after applying the change but before recording the ID, the event would be applied again on redelivery. Doing both in one transaction closes that gap, the same reasoning as the outbox.</p>
${keyIdea(`<p>The outbox guarantees an event is never lost; the consumer guarantees it is never applied twice. Together they give the effect of exactly once, even though delivery is only at least once.</p>`)}

<h2>Exit 2: the message is malformed</h2>
<p>Every message is checked before the service acts on it. A message is <strong>malformed</strong> if it is not valid JSON, does not match its topic’s schema, names an unknown topic in <code>event_type</code>, or has an envelope <code>version</code> the service does not know.</p>
<p>Retrying a malformed message will not fix it. The consumer tries 3 more times, in case the cause was a passing glitch, and then moves the message to a <strong>dead-letter topic</strong> (DLQ): a side topic for messages that could not be processed. It copies the original message unchanged and adds four headers saying where it came from and why it failed.</p>
${code({ lang: 'python', title: 'app/shared/kafka.py: the headers on a dead-lettered message', src: `{
    "source_topic": msg.topic,
    "source_partition": str(msg.partition),
    "source_offset": str(msg.offset),
    "error": reason[:500],
}` })}
<p>Then the consumer commits the offset and carries on with the next message. One bad message does not stop the partition, and it is kept, with its reason, for someone to inspect.</p>

<h2>Exit 3: applying it failed</h2>
<p>A well-formed message can still fail to apply: the database is unreachable, or a query times out. These are <strong>transient</strong> failures, and the message itself is fine. So the consumer retries, waiting longer after each failure, and keeps retrying for as long as it takes. It never sends such a message to the DLQ.</p>
<p>While it retries, nothing behind that message in the same partition is processed. That sounds harsh, but skipping it would break per-card order: a <code>CARD_CLOSED</code> could be applied before the <code>CARD_LOST</code> it follows. As with the outbox, order wins over speed.</p>
${table(['', 'Malformed message', 'Failure while applying'], [
  ['Example', 'Schema check fails', 'Database down'],
  ['Will a retry help?', 'No', 'Probably, soon'],
  ['Retries', '3, then give up', 'Forever, with growing delays'],
  ['Then', 'Copied to the DLQ, offset committed', 'Applied, offset committed'],
  ['Partition meanwhile', 'Moves on after the retries', 'Waits'],
])}

<h2>Committing the offset</h2>
<p>The consumer group’s <a href="/learn/why-events/">offset</a> records how far a service has read. CardVault commits it only after a message is finished: applied, skipped as a repeat, or dead-lettered. If a service crashes in the middle, it restarts from the last committed offset and sees the unfinished message again, which is safe because of exit 1.</p>
${testerEye(`<p>Each exit is a test. Send the same event twice and assert the history shows it once. Publish a malformed message to <code>card.lifecycle</code> and assert it appears in <code>enrollment.dlq</code> with a <code>source_topic</code> header, and that the next valid event is still processed. Pause consumers with the <code>consumer_pause</code> fault, make changes, then lift it and assert everything catches up in order. <code>GET /test/quiet</code> shows <code>consumer_lag</code>, the number of messages not yet committed; a message stuck retrying keeps it above zero.</p>`)}
${realWorld(`<p>Production teams watch their DLQs closely, with alerts when anything lands there, and tools to fix and replay dead-lettered messages. CardVault has no replay tool; the DLQ is there to be read, which is all a tester needs.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Consumer', 'The part of a service that reads a topic and acts on each event.'],
  ['Idempotent consumer', 'One that gives the same result however many times it receives an event.'],
  ['Malformed message', 'One that fails the envelope or schema check. Retrying cannot fix it.'],
  ['Dead-letter topic (DLQ)', 'A side topic where messages that could not be processed are kept, with headers saying why.'],
  ['Transient failure', 'A temporary problem, such as a database outage, that a retry is likely to fix.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'wallet-txn receives an `auth.decided` event it already processed, with the same `event_id`. What does it do?',
  options: ['Adds the purchase again', 'Skips it, because the event_id is already in processed_events', 'Sends it to wallet.txn.dlq', 'Retries it forever'],
  answer: 1,
  why: '<p>A repeat is normal under at-least-once delivery. The <code>event_id</code> is already recorded, so the consumer skips it and commits the offset.</p>',
})}
${check({
  q: 'enrollment’s database is down for a minute. Card A gets `CARD_LOST` and then `CARD_CLOSED`. What happens to these events?',
  options: ['Both go to enrollment.dlq', 'The consumer keeps retrying `CARD_LOST` and processes both, in order, once the database is back', '`CARD_CLOSED` is applied first', '`CARD_LOST` is dropped after 3 tries'],
  answer: 1,
  why: '<p>A database outage is a transient failure, not a malformed message. The consumer retries without limit and the partition waits, so order is kept.</p>',
})}
${check({
  q: 'A message on `card.lifecycle` has `"version": 2` in its envelope. What happens?',
  options: ['It is applied normally', 'It is retried 3 times, then copied to enrollment.dlq, and the next message is processed', 'The consumer stops for good', 'It is retried forever'],
  answer: 1,
  why: '<p>An unknown envelope version makes the message malformed. Retrying cannot help, so after 3 retries it is dead-lettered and the partition moves on.</p>',
})}

<h2>Recap</h2>
${recap([
  'Each reading service has one consumer, built on shared code, handling one message at a time per partition.',
  'Repeats are skipped: by `event_id` in enrollment and wallet-txn, by `version` in card.',
  'Malformed messages get 3 retries, then go to a DLQ with source and error headers.',
  'Other failures retry forever and hold the partition, to keep per-card order.',
  'The offset is committed only when a message is finished.',
])}
`,
};
