import { code, figure, interview, keyIdea, shot, table, testerEye } from '../../src/components.mjs';
import { topicMap } from '../diagrams/app.mjs';

export default {
  minutes: 9,
  lede: 'In the purchase and wallet flows you saw gold arrows: events on the message bus. This lesson opens up that bus. It covers the five kinds of news CardVault’s services share, what one event looks like, and why events can arrive late, twice or out of step.',
  youWill: 'You will be able to name CardVault’s topics, say who sends and who listens to each, and explain what that means for tests.',
  body: `
<h2>Why services announce things</h2>
<p>When a card is reported lost, Wallet must pause the card in the checkout wallet. Cards could call Wallet directly, but then Cards would need to know every service that cares, and it would fail whenever one of them was down.</p>
<p>Instead, Cards <strong>announces</strong> the change once, on the message bus, and carries on. Any service that cares listens and reacts in its own time. CardVault’s message bus is <strong>Kafka</strong>. Locally and on stage it runs as <strong>Redpanda</strong>, a program that speaks the same language as Kafka, so every Kafka tool works with it.</p>

<h2>The words you need</h2>
${table(['Word', 'What it means in CardVault'], [
  ['Event', 'One short message about something that already happened, such as “card 4417 was reported lost”.'],
  ['Topic', 'A named stream of one kind of event, such as `card.lifecycle`. Services send to a topic and listen to a topic, never to each other.'],
  ['Producer and consumer', 'The service that sends to a topic, and a service that listens to it.'],
  ['Key', 'A label on each event that decides its place in the topic. CardVault uses the card’s ID, so all events about one card stay in order.'],
  ['Partition', 'A topic is split into parts (three in CardVault) so it can be read in parallel. Events with the same key always go to the same part.'],
])}

<h2>The five topics</h2>
${figure({ svg: topicMap(), caption: 'Green boxes are services, gold boxes are topics. Cards is the busiest sender; Wallet listens to two topics.' })}
<p>Read each row as a sentence. <em>Cards tells Wallet about card changes</em>, so a lost card is paused in the wallet. <em>Cards tells Transactions about every purchase decision and every settlement</em>, which is how alice’s transaction list is built. <em>Profile tells Wallet when an email or phone changes</em>, because an unverified contact makes cards leave the wallet. <em>Wallet tells Cards when a wallet status changes</em>, so Cards knows which wallet cards may pay.</p>
<p>Two more topics exist as safety nets: <code>enrollment.dlq</code> and <code>wallet.txn.dlq</code>. A <strong>dead-letter queue</strong> (DLQ) is where a consumer puts an event it cannot read, instead of getting stuck on it forever.</p>

<h2>What one event looks like</h2>
${shot({ src: 'kafka-message.png', alt: 'Redpanda Console showing one card.lifecycle message: key is the card ID, partition 0, offset 0, and the JSON value with payload, version, event_id, event_type, occurred_at and correlation_id.', caption: 'One event in Redpanda Console on a local stack: a card became active when the demo data was loaded.' })}
<p>Every CardVault event has the same outer shape, called the <strong>envelope</strong>, with the details inside <code>payload</code>:</p>
${code({ lang: 'json', title: 'An event on card.lifecycle (shortened)', src: `
{
  "event_id": "3adab5c0-74cd-4f0e-9a9c-aaf7cf10e1ef",
  "event_type": "card.lifecycle",
  "version": 1,
  "occurred_at": "2026-11-28T09:17:52.286929Z",
  "correlation_id": "a425f1b3-1fa6-4dab-a234-cf113dc913ba",
  "payload": {
    "event": "CARD_ACTIVATED",
    "card_id": "ca4d0000-a11c-4000-8000-000000000001",
    "customer_id": "a11ce000-0000-4000-8000-000000000001",
    "product": "CREDIT",
    "status": "ACTIVE",
    "last4": "4417"
  }
}` })}
<ul>
<li><code>event_id</code> is unique for every event. Consumers remember the IDs they have handled, so a repeat is ignored.</li>
<li><code>event_type</code> is the topic name, and <code>version</code> is the version of the payload’s shape.</li>
<li><code>correlation_id</code> is shared by everything one customer action caused, across every service, so you can follow a single action through the logs.</li>
<li>The payload of <code>card.lifecycle</code> says what happened: <code>CARD_ACTIVATED</code>, <code>CARD_LOST</code>, <code>CARD_REISSUED</code>, <code>CARD_CLOSED</code> or <code>CARD_USED</code>. Notice there is no card number: only the last four digits ever leave Cards.</li>
</ul>
<p>The exact shape of every payload is published as a JSON Schema in the CardVault repository (<code>docs/events/</code>), which is what a contract test checks events against.</p>

${keyIdea('<p>Events are facts about the past, keyed by card. A service announces once, and every interested service reacts later, in order for each card.</p>')}

<h2>Late, twice, or in order</h2>
<p>Three behaviours follow from this design, and each one shapes how you test:</p>
<ul>
<li><strong>Late.</strong> A consumer reads an event a moment after it was sent, usually well under a second. Until then the screens show the old state.</li>
<li><strong>Twice.</strong> Kafka promises every event arrives <em>at least once</em>. After a crash, an event can arrive again, so every consumer must ignore one it has already handled. A purchase must never appear twice in the list.</li>
<li><strong>In order, per card.</strong> Events with the same key stay in order, so “card lost” is never handled after “card reissued” for the same card. There is no order promise between two different cards.</li>
</ul>

<h2>Seeing the events yourself</h2>
<p>On a local stack, Redpanda Console runs at <code>http://localhost:8080</code>. Open <strong>Topics</strong>, pick one, and every event is listed with its key, partition and value. Report a card lost in the app and a new <code>CARD_LOST</code> event appears on <code>card.lifecycle</code>, then an <code>enrollment.changed</code> with <code>SUSPENDED</code> a couple of seconds later. On the stage server the console is not public.</p>

${testerEye(`<ul>
<li>Never check a result that depends on an event straight away. Wait for it, with a time limit.</li>
<li>Check the event itself: right topic, right key, right payload, and a shape that matches the schema.</li>
<li>Repeat an event, or stop a consumer and start it again, and check nothing is applied twice.</li>
</ul>
<p>The API track turns each of these into tests in <a href="/learn/py-kafka-events/">Testing Kafka and event flows</a>.</p>`)}

${interview({
  say: `<p>“Services share state changes through Kafka. There are five topics. Card lifecycle changes go from the card service to the enrolment service, which suspends or removes wallet cards. Purchase decisions and settlements go from cards to the transactions service, which builds the customer’s history. Contact changes go from profile to enrolment, and wallet status changes go back to cards.</p>
<p>Events use one envelope with an event ID, type, version, timestamp and correlation ID, and they are keyed by card ID so order holds per card. Delivery is at-least-once, so consumers dedupe by event ID, and tests wait for results instead of checking once.”</p>`,
  qa: [
    ['Why use events instead of calling the other service?', '<p>The sender does not need to know who cares, and it keeps working when a listener is down: the event waits on the topic until the listener comes back. The cost is that results appear a moment later, and the system has to cope with repeats.</p>'],
    ['What does at-least-once delivery mean for a tester?', '<p>The same event can arrive more than once, so the consumer must be idempotent: handling it twice has the same effect as once. I would test it by replaying an event and checking that the record did not change and nothing was duplicated.</p>'],
    ['How do you keep events about one card in order?', '<p>Use the card ID as the key. Kafka sends every event with the same key to the same partition, and a partition is read in order. Events about different cards can still be processed in any order.</p>'],
  ],
})}
`,
};
