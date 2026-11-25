import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, code } from '../../src/components.mjs';
import { callsVsEvents, partitions } from '../diagrams/flow.mjs';

export default {
  minutes: 11,
  lede: 'You have already seen services publish events: `CARD_LOST`, `auth.decided`, `txn.cleared`. This lesson steps back and asks why. What does an event give you that a direct call does not, what does it cost, and what exactly travels on the event bus?',
  youWill: 'You will learn why CardVault uses events, read an event envelope, and understand keys, partitions and the delay they bring.',
  body: `
<h2>Calls couple services together</h2>
<p>When a card is reported lost, the card service is not the only one that cares. Enrollment must suspend the card in the phone wallet too, and a service added next year may want to know as well. The card service could call each of them directly. <a href="/learn/the-system-map/">The system map</a> introduced the alternative: post a message and move on.</p>
${figure({ svg: callsVsEvents() })}
<p>With direct calls, the card service has to know every service that cares, wait for each of them, and decide what to do when one is down. Adding a new listener means changing the card service. With an event, the card service states a fact, “card 4417 is now LOST”, and is finished. Listeners subscribe on their own, and one that is down simply reads the event when it comes back.</p>
${keyIdea(`<p>A call says “do this for me”. An event says “this happened”. The sender of an event does not know or care who reacts, which is what lets services change and fail independently.</p>`)}

<h2>What it costs</h2>
<p>Nothing is free. Events bring three costs that every tester should keep in mind:</p>
<ul>
<li><strong>Delay.</strong> The listener reacts a moment later, not during the request. For a short time, services disagree. This is called <strong>eventual consistency</strong>: they will agree, but not instantly.</li>
<li><strong>Repeats.</strong> An event can be delivered more than once, so every listener must cope with seeing it twice.</li>
<li><strong>Harder to follow.</strong> There is no single call stack showing what happened. You follow the <a href="/learn/journey-of-a-request/">correlation ID</a> across services instead.</li>
</ul>
<p>CardVault uses calls where an immediate answer is needed (the network asking for an approval, the web app listing cards) and events where other services only need to know, soon, that something changed.</p>

<h2>What an event looks like</h2>
<p>Every CardVault event has the same outer shape, the <strong>envelope</strong>, with the topic-specific details inside <code>payload</code>.</p>
${code({ lang: 'json', title: 'An event on card.lifecycle', src: `{
  "event_id": "5f0c…",
  "event_type": "card.lifecycle",
  "version": 1,
  "occurred_at": "2026-11-25T09:20:11.402000Z",
  "correlation_id": "run-42-lost",
  "payload": {
    "card_id": "ca4d0000-a11c-4000-8000-000000000001",
    "customer_id": "a11ce000-0000-4000-8000-000000000001",
    "event": "CARD_LOST",
    "status": "LOST",
    "product": "CREDIT",
    "last4": "4417",
    "expiry": "2029-06",
    "last_used_at": "…"
  }
}` })}
${table(['Envelope field', 'Job'], [
  ['`event_id`', 'A unique ID, so a listener can recognise a repeat'],
  ['`event_type`', 'The topic name'],
  ['`version`', 'The envelope format version. An unknown version counts as malformed'],
  ['`occurred_at`', 'When it happened, on the shared clock'],
  ['`correlation_id`', 'The ID of the request that caused it, carried on to the listener’s logs'],
])}
<p>The payload carries the card’s whole current state, not only what changed. A listener can update its copy from any single event without asking for more. The <a href="/events/">event catalogue</a> lists every topic, its payload fields and its JSON Schema.</p>

<h2>Topics, keys and partitions</h2>
<p>Redpanda, CardVault’s event bus, stores events in <strong>topics</strong>, one per kind of event. Each topic is split into 3 <strong>partitions</strong> so several consumers could share the work. Every event has a <strong>key</strong>, and the key decides the partition.</p>
${figure({ svg: partitions() })}
<p>All CardVault topics are keyed by <code>card_id</code>, except <code>contact.updated</code>, which is keyed by <code>customer_id</code>. Because all events for one card land in the same partition, they are read in the order they were published. Events for <em>different</em> cards have no guaranteed order between them, and nothing in CardVault relies on one.</p>
${table(['Topic', 'Published by', 'Read by'], [
  ['`card.lifecycle`', 'card', 'enrollment'],
  ['`contact.updated`', 'profile', 'enrollment'],
  ['`enrollment.changed`', 'enrollment', 'card'],
  ['`auth.decided`', 'card', 'wallet-txn'],
  ['`txn.cleared`', 'card', 'wallet-txn'],
])}
<p>Each reading service has its own <strong>consumer group</strong>, which remembers how far that service has read in each partition. That position is called the <strong>offset</strong>. Two services reading the same topic each get every event, and each keeps its own place.</p>
${testerEye(`<p>Eventual consistency changes how you assert. After reporting a card lost, the card service’s answer is immediate, but the wallet’s reaction is not. Poll the wallet with a short, bounded wait, for example up to 10 seconds, checking every few hundred milliseconds. A fixed sleep is either too short (flaky) or too long (slow); an immediate check is simply wrong. You can watch events arrive yourself in Redpanda Console at <code>localhost:8080</code>.</p>`)}
${realWorld(`<p>Large banks run their event bus as shared infrastructure for hundreds of services, with schema registries that refuse events that break their contract. CardVault keeps the same ideas, a versioned envelope and a JSON Schema per topic, checked in CI, at a size you can read in an afternoon.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Event', 'A published fact about something that happened, such as a card being reported lost.'],
  ['Eventual consistency', 'Services agree after a short delay, not instantly.'],
  ['Envelope', 'The shared outer shape of every event: `event_id`, `event_type`, `version`, `occurred_at`, `correlation_id`, `payload`.'],
  ['Topic', 'A named stream of events of one kind, such as `card.lifecycle`.'],
  ['Partition and key', 'A topic is split into partitions; the key picks the partition, so one key’s events stay in order.'],
  ['Consumer group and offset', 'A reading service’s identity and its position in each partition.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'card 4417 is reported lost and then reissued a second later. Can the enrollment service read `CARD_REISSUED` before `CARD_LOST`?',
  options: ['Yes, events have no order', 'No, both are keyed by the same card_id, so they share a partition and keep their order', 'Only if Redpanda restarts', 'Yes, if the clock was moved'],
  answer: 1,
  why: '<p>Same key, same partition, publish order preserved. That is exactly why CardVault keys card events by <code>card_id</code>.</p>',
})}
${check({
  q: 'A test reports a card lost, then immediately checks the wallet and sees the card still ENROLLED. What should the test conclude?',
  options: ['The wallet is broken', 'Nothing yet: the wallet reacts to an event, so it should poll for a short, bounded time', 'The card was not reported lost', 'Events are disabled'],
  answer: 1,
  why: '<p>The wallet learns from <code>card.lifecycle</code> a moment later. Only if it still has not changed after a reasonable bounded wait is that a finding.</p>',
})}

<h2>Recap</h2>
${recap([
  'Calls ask for something now; events announce that something happened.',
  'Events decouple services, at the cost of delay, possible repeats and harder tracing.',
  'Every event has the same envelope; the payload carries the full current state.',
  'Topics have 3 partitions; the key (usually `card_id`) keeps one card’s events in order.',
  'Each consuming service has its own consumer group and offset. Tests poll with a bounded wait.',
])}
`,
};
