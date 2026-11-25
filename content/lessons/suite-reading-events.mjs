import { figure, keyIdea, testerEye, terms, check, recap, code } from '../../src/components.mjs';
import { eventWatch } from '../diagrams/suite.mjs';

export default {
  minutes: 14,
  lede: 'CardVault’s services tell each other about changes through events on Kafka. Some promises live only there: that an event is published at all, that it matches its published contract, that it carries the right key and the correlation ID of the request that caused it. This lesson shows how the suite reads a topic from the outside without disturbing anyone, and what it checks on each event.',
  youWill: 'You will learn how a watch starts reading at the end of a topic, why it must start before the test acts, how an event is checked against its JSON Schema, and how one correlation ID links an HTTP call to its event.',
  body: `
<h2>Why look at events at all</h2>
<p>The first track’s <a href="/learn/why-events/">Why services talk in events</a> explained the idea: when something changes, the service that owns it publishes an event, and other services react. Other teams build on those events, so their shape is a contract just as much as an API response is. A test that only reads APIs would never notice an event that stopped being published, or one whose shape quietly changed, until some consumer broke.</p>

<h2>A library for Kafka</h2>
<p>The suite reads Kafka with <strong>confluent-kafka</strong>, a Python library built on the widely used C client for Kafka. A program that reads a topic is a <strong>consumer</strong>; consumers normally belong to a <strong>consumer group</strong> and record how far they have read, so they can carry on after a restart. The suite deliberately does neither of those things in a way that matters to anyone else: every watch has its own new group name and never records its position, so the services’ own consumers are untouched.</p>

<h2>Start reading before you act</h2>
<p>A topic is split into <strong>partitions</strong> (CardVault’s topics have three), and each partition is an ordered list of messages. A watch puts its reading position at the current end of every partition:</p>
${code({ title: 'tests/api/src/cardvault_tests/events.py (part)', src: `
        partitions = self.consumer.list_topics(topic, timeout=10).topics[topic].partitions
        # Start every partition at its end: only events published from now on are read.
        ends = []
        for p in partitions:
            _, high = self.consumer.get_watermark_offsets(TopicPartition(topic, p), timeout=10)
            ends.append(TopicPartition(topic, p, high if high >= 0 else OFFSET_END))
        self.consumer.assign(ends)
` })}
<p>The <strong>high watermark</strong> is the position just after the last message in a partition. Assigning the consumer there means it will read only what is published afterwards. The <code>_, high = …</code> line unpacks a pair and ignores the first value; <code>_</code> is the usual Python name for “not needed”.</p>
${figure({ svg: eventWatch(), caption: 'Everything before a partition’s line is history and is never read. After it come the test’s own event and events from other tests running at the same time; <code>wait_for</code> picks out the one that matches.' })}
<p>The order in the test matters. The <code>watch</code> fixture is called <em>before</em> the action, so the watch is already positioned when the event is published. If the watch started afterwards, a fast service could publish the event first, and the watch, starting at the new end, would never see it.</p>

<h2>Waiting for your own event</h2>
<p>Other tests publish to the same topics at the same moment. So <code>wait_for</code> reads messages for up to a timeout and returns the first one that a test-supplied function accepts, usually by an ID only this test knows:</p>
${code({ title: 'tests/api/tests/events/test_published_events.py (part, payload checks left out)', src: `
def test_a_wallet_purchase_publishes_auth_decided(make_customer, card_network, watch):
    events = watch("auth.decided")
    someone = make_customer(customer(card(enrolled=True)))
    own = someone.new_cards[0]

    resp = card_network.purchase(own.card_id, 4_200, own.token_ref)

    auth = expect(resp, 200, Authorization).model_dump()
    event = events.wait_for(
        lambda e: e.payload["trace_id"] == auth["trace_id"], what="auth.decided for the purchase"
    )
    assert_well_formed(event, own.card_id)
    sent = resp.request.headers["X-Correlation-ID"]
    assert event.envelope["correlation_id"] == sent
    assert event.headers["X-Correlation-ID"] == sent
` })}
<p>The lines left out compare the payload with the purchase: its decision, amount, token and customer. The purchase’s <code>trace_id</code> is unique, so the match is unambiguous. If no such event arrives in time, the failure lists the event types the watch did see, which tells you whether the topic was silent or busy with other events.</p>

<h2>What is checked on every event</h2>
${code({ title: 'tests/api/tests/events/test_published_events.py (part)', src: `
def assert_well_formed(event, key) -> None:
    assert schema_errors(event) == [], f"{event.topic} breaks its schema"
    assert event.key == str(key), "keyed so one card's or customer's events stay in order"
    assert event.headers["event_id"] == event.envelope["event_id"]
    assert pan_like(event.raw) == [], "an event carries something that looks like a PAN"
` })}
<ul>
<li><strong>The contract.</strong> CardVault publishes a <strong>JSON Schema</strong> for each event type in <code>docs/events</code>: a machine-readable description of the fields, their types and which are required. The suite validates each event against it with the <code>jsonschema</code> library and asserts the list of errors is empty, so a failure names every broken field.</li>
<li><strong>The key.</strong> Kafka keeps order only within a partition, and the key picks the partition. Events about one card must carry that card’s ID as the key, or two of them could be read in the wrong order.</li>
<li><strong>No card numbers.</strong> The raw bytes are searched for anything that looks like a full card number, the same check <a href="/learn/suite-security/">Who may call what</a> applies to responses.</li>
</ul>
<p>The last two lines of the test show the <a href="/learn/suite-clients/">correlation ID</a> doing its job: the ID the suite’s request hook put on the HTTP call reappears in the event’s envelope and in its Kafka headers. One ID now follows the purchase from the test into every service that reacts to it.</p>
${keyIdea(`<p>Treat events as a contract: start watching before acting, pick out your own event by an ID only your test knows, and check its schema, its key and its correlation ID.</p>`)}
${testerEye(`<p>If an event test times out, the list of event types the watch saw is the first clue. An empty list points at publishing (the outbox, the relay, Kafka itself); a list without yours points at the change not producing an event at all.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Consumer', 'A program that reads messages from a Kafka topic.'],
  ['Consumer group', 'A named set of consumers that share a topic and record how far they have read.'],
  ['High watermark', 'The position just after the last message in a partition.'],
  ['Event watch', 'The suite’s reader for one topic, started at its end before the test acts.'],
  ['JSON Schema', 'A machine-readable contract for a JSON document: fields, types and which are required.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test reports a card lost, then calls `watch("card.lifecycle")` and waits for CARD_LOST. It fails now and then with “no event”. Why?',
  options: ['Kafka loses events', 'The watch starts at the end of the topic; if the event was published before the watch began, it is behind the starting point and never read', 'The timeout is too short', 'The key is wrong'],
  answer: 1,
  why: '<p>A watch only sees events published after it starts. Starting it after the action races the service. Starting it before makes the event certain to be ahead of it.</p>',
})}
${check({
  q: 'Why does each watch use a brand-new consumer group and never record its position?',
  options: ['Kafka requires it', 'So the suite never affects the services’ own consumers or their progress through the topic', 'To read faster', 'To read old events'],
  answer: 1,
  why: '<p>A consumer group’s recorded position is shared state. Joining a service’s group would take messages away from it. A private group that records nothing reads alongside everyone and leaves no trace.</p>',
})}
${check({
  q: 'An auth.decided event is valid against its schema, but its key is the trace_id instead of the card_id. What could go wrong for consumers?',
  options: ['Nothing; the schema passed', 'Events for one card could land on different partitions and be read out of order', 'The event cannot be read', 'The correlation ID is lost'],
  answer: 1,
  why: '<p>Order is kept only within a partition, and the key chooses it. Keying by card keeps all of one card’s events in order; keying by trace scatters them.</p>',
})}

<h2>Recap</h2>
${recap([
  'Events are contracts; some promises are only visible on Kafka.',
  'A watch starts at the end of every partition, and must start before the test acts.',
  '`wait_for` picks out the test’s own event by a unique ID, with a timeout.',
  'Each event is checked against its JSON Schema, its key, its correlation ID and for card numbers.',
])}
`,
};
