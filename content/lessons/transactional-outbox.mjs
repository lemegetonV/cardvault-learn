import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, code, sequence } from '../../src/components.mjs';
import { dualWrite, outboxFlow } from '../diagrams/flow.mjs';

const relay = sequence({
  id: 'seq-outbox',
  label: 'A customer reports a card lost. The card service saves the change and the event in one transaction and answers at once. The relay then tries to publish, Redpanda is down, the relay waits and tries again, and the event is published and marked sent.',
  actors: [
    { id: 'web', label: 'Web app', kind: 'plain' },
    { id: 'card', label: 'card service', kind: 'bank' },
    { id: 'db', label: 'card database', kind: 'bank' },
    { id: 'relay', label: 'relay', kind: 'plain' },
    { id: 'bus', label: 'Redpanda', kind: 'event' },
  ],
  steps: [
    { from: 'web', to: 'card', label: 'POST …/report-lost', note: 'The customer reports card 4417 lost.' },
    { from: 'card', to: 'db', label: 'status = LOST + outbox row', note: 'In one transaction the service updates the card and inserts an outbox row holding the `CARD_LOST` event. The commit saves both or neither.' },
    { from: 'card', to: 'web', kind: 'reply', label: '200, card is LOST', note: 'The customer gets the answer straight away. Nothing has been published yet, and the request does not wait for it.' },
    { from: 'relay', to: 'db', label: 'oldest unsent row per card', note: 'A moment later, a background task in the same service, the relay, picks up the row.' },
    { from: 'relay', to: 'bus', label: 'publish CARD_LOST', note: 'Redpanda is down, so publishing fails.' },
    { from: 'relay', to: 'relay', kind: 'self', label: 'wait, then retry', note: 'The relay records the failure and schedules another try after a short delay. The delay grows with each failure, up to a cap.' },
    { from: 'relay', to: 'bus', label: 'publish CARD_LOST', note: 'Redpanda is back. This time the event is published.' },
    { from: 'relay', to: 'db', label: 'mark the row sent', note: 'The row gets a `published_at` time and will not be sent again, unless the relay crashed before this step.' },
  ],
  caption: 'The request is finished long before the event is published. The outbox row bridges the gap.',
});

export default {
  minutes: 11,
  lede: 'A service that changes its data and announces the change has to do two writes: one to its database, one to the event bus. If one succeeds and the other does not, services start to disagree for good. The transactional outbox is the pattern CardVault uses to make sure that never happens.',
  youWill: 'You will see why “save, then publish” is unsafe, how the outbox fixes it, and what a tester can observe while events are on their way.',
  body: `
<h2>Two writes, one problem</h2>
<p>When a card is reported lost, the card service must save <code>status = LOST</code> and publish <code>CARD_LOST</code>. The database and Redpanda are separate systems, and no transaction covers both. Whichever you do first, a failure in between leaves a lie.</p>
${figure({ svg: dualWrite() })}
<p>This is called the <strong>dual-write problem</strong>. It does not show up in a quick demo, because crashes and outages at exactly the wrong moment are rare. Over millions of requests, though, they happen, and each one leaves a card that is lost in one service and active in another.</p>

<h2>The outbox: write the event to the database</h2>
<p>The fix is to stop writing to two systems. The service writes the event into its <em>own</em> database, in a table called <code>outbox</code>, in the same transaction as the business change. A database transaction is all-or-nothing, so either both rows exist or neither does.</p>
${figure({ svg: outboxFlow() })}
<p>A background task called the <strong>relay</strong> then reads the outbox and publishes what it finds. If Redpanda is down, the row simply waits in the table until it can be sent. Nothing is lost, and nothing is announced that did not happen.</p>
${relay}
${keyIdea(`<p>The outbox turns “save and publish” into “save, and publish later”. The event exists if and only if the business change was committed. Publishing can be late, but it cannot be missing or false.</p>`)}

<h2>How the relay behaves</h2>
<p>Three rules decide what the relay sends and when.</p>
${table(['Rule', 'What it means', 'Why'], [
  ['Oldest first, per key', 'Only the oldest unsent row for each key (each card) may be sent', 'Events for one card reach Redpanda in the order they were committed, even when one keeps failing'],
  ['Retry with growing delays', 'A failed send waits longer each time, up to a cap, measured in real time', 'A struggling Redpanda is not flooded with retries'],
  ['Event rows never give up', 'An event row is retried until it is sent', 'A missing event would leave services disagreeing for good'],
])}
<p>The “oldest first” rule has a cost. If one card’s event cannot be sent, that card’s later events queue behind it. Other cards are not affected. This is called <strong>head-of-line blocking</strong>, and here it is a deliberate choice: order matters more than speed.</p>
<p>The relay locks the rows it is working on with <code>FOR UPDATE SKIP LOCKED</code>, a Postgres feature that lets a second relay skip rows the first one holds, so two relays would never send the same row at the same time.</p>
${code({ lang: 'python', title: 'app/shared/settings.py: the delay before retry number n', src: `def delay(self, attempt: int) -> float:
    """Delay before retry number \`\`attempt\`\` (1-based)."""
    return min(self.cap_seconds, self.base_seconds * (self.factor ** max(0, attempt - 1)))` })}
<p>The delay doubles each time, up to a cap. With the fast settings used in test mode, the first retry waits 0.2 seconds and no retry waits more than 2 seconds. In normal mode the delays start at 1 second and are capped at 60.</p>

<h2>At least once, not exactly once</h2>
<p>There is one gap left. The relay publishes, then marks the row sent. If it crashes between those two steps, the row still looks unsent, and the event is published again after the restart. So delivery is <strong>at least once</strong>: never lost, occasionally repeated.</p>
<p>Making it exactly once would need the database and Redpanda to agree in one transaction, which is the very thing that cannot be done. CardVault accepts the repeats and makes every consumer able to ignore them, which <a href="/learn/consumers-and-dead-letters/">Consumers, retries and dead letters</a> shows.</p>

<h2>Where CardVault uses it</h2>
${table(['Service', 'What goes through its outbox'], [
  ['card', '`card.lifecycle`, `auth.decided`, `txn.cleared` events'],
  ['profile', '`contact.updated` events'],
  ['enrollment', '`enrollment.changed` events, and separately its calls to the wallet operator'],
])}
<p>Enrollment uses the same table for its outgoing HTTP calls to the wallet operator, with a relay of its own so slow calls never hold up events. Those rows follow different rules: after 5 failed attempts, or at once if the operator rejects the request with a 4xx, the row is marked failed and the enrolment records why. <a href="/learn/enrolment/">Adding a card to the wallet</a> follows that path.</p>
${testerEye(`<p>Two things follow for tests. First, a <code>200</code> from report-lost proves the change was saved, not that the event has gone out; check the downstream effect with a bounded wait. Second, you can ask whether the system is idle: <code>GET /test/quiet</code> on a service returns its outbox depth (rows not yet sent) and consumer lag, with <code>quiet: true</code> when both are zero. The <code>relay_pause</code> and <code>kafka_publish_failure</code> faults hold events in the outbox on purpose, so you can prove they are delivered, in order, once the fault is lifted.</p>`)}
${realWorld(`<p>Some teams skip the relay and let a tool read the database’s change log directly, a technique called change data capture. The guarantee is the same: the event comes from what was committed. CardVault uses a simple polling relay because it is easy to read and easy to pause in a test.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Dual-write problem', 'Writing to two systems with no shared transaction, so a failure between them leaves them disagreeing.'],
  ['Transactional outbox', 'Saving the event in the service’s own database, in the same transaction as the change, for a relay to publish later.'],
  ['Relay', 'The background task that publishes outbox rows and marks them sent.'],
  ['Head-of-line blocking', 'One stuck item holds up the items queued behind it. Here, only for the same key.'],
  ['At-least-once delivery', 'Every event arrives, and some may arrive more than once.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'The card service saves a card as LOST and then crashes before the relay runs. After the restart, what happens to the `CARD_LOST` event?',
  options: ['It is lost; the change must be repeated', 'The relay finds the unsent outbox row and publishes it', 'The database rolls back the LOST status', 'Redpanda replays it'],
  answer: 1,
  why: '<p>The outbox row was committed with the status change, so it survives the crash. The relay picks it up when the service starts again.</p>',
})}
${check({
  q: 'With `kafka_publish_failure` switched on, card A gets two lifecycle events and card B gets one. The fault is then lifted. In what order can they be published?',
  options: ['Any order at all', 'A’s two events in commit order; B’s event may come before, between or after them', 'B always first', 'All three in strict commit order across cards'],
  answer: 1,
  why: '<p>“Oldest first” applies per key. A’s events keep their order; there is no promise about order between different cards.</p>',
})}
${check({
  q: 'A consumer receives the same `CARD_LOST` event twice, with the same `event_id`. Is that a defect in the outbox?',
  options: ['Yes, the relay should never send twice', 'No, at-least-once delivery allows repeats; the consumer must ignore the second one', 'Yes, Redpanda is misconfigured', 'Only if the two arrive more than a second apart'],
  answer: 1,
  why: '<p>A crash between publishing and marking the row sent causes exactly this. The design accepts it; the defect would be a consumer that applies the event twice.</p>',
})}

<h2>Recap</h2>
${recap([
  'Writing to the database and to Redpanda separately can leave them disagreeing.',
  'The outbox stores the event in the same transaction as the change.',
  'A relay publishes the oldest unsent row per key, retrying event rows forever with capped, growing delays.',
  'Delivery is at least once; consumers must cope with repeats.',
  '`GET /test/quiet` shows outbox depth and consumer lag, so tests can wait for “nothing in flight”.',
])}
`,
};
