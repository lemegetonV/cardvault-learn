import { code, interview, keyIdea, testerEye, table, sequence, terminal } from '../../src/components.mjs';

export default {
  minutes: 13,
  lede: 'CardVault’s services tell each other about changes through events on Kafka. A flow test checks the end result, such as a purchase appearing in the history. When that result never arrives, you want to know which part failed: was the event never sent, sent with the wrong details, or sent and ignored? This lesson shows how a test checks the broker and the events directly.',
  youWill: 'You will be able to explain topics and events, check that the broker is ready, and read a test that waits for one specific event.',
  body: `
<h2>The words you need</h2>
<p>In <a href="/learn/system-at-a-glance/">The system at a glance</a> you met the message bus: a service announces a change, and other services react a moment later. CardVault’s message bus is <strong>Kafka</strong>. A few words come up in every conversation about it:</p>
${table(['Word', 'Meaning', 'In CardVault'], [
  ['Broker', 'The Kafka server. It stores events and hands them to readers', 'One broker'],
  ['Topic', 'A named stream of events of one kind', '`card.lifecycle`, `auth.decided` and three more'],
  ['Producer', 'A program that publishes events to a topic', 'Cards publishes on `card.lifecycle`'],
  ['Consumer', 'A program that reads events from a topic', 'Wallet reads `card.lifecycle`, and so do the tests'],
  ['Partition', 'A topic is split into parts so readers can share the work. Order is kept inside one partition', 'Three per topic'],
])}
<p>Reading an event does not remove it. Any number of consumers can read the same topic, each at its own pace, so a test can read events alongside the real services without disturbing them.</p>

<h2>Three questions, three kinds of test</h2>
${table(['Question', 'Test', 'In the suite'], [
  ['Is the broker up, with the topics the app needs?', 'List the topics', '`test_events.py`'],
  ['When I do X, is the right event published, with the right details?', 'Watch the topic, act, wait for the event', '`test_events.py`'],
  ['Does the consumer react correctly?', 'Act, then poll the other service’s API', 'Flow tests, such as `test_a_lost_card_is_paused_in_the_wallet`'],
])}
<p>Together they narrow a failure down. If the event tests pass but a flow test fails, the event went out correctly and the problem is in the service that reads it.</p>

${sequence({
  id: 'event-test',
  label: 'A test watching for the card-lost event',
  actors: [
    { id: 't', label: 'test', kind: 'plain' },
    { id: 'c', label: 'Cards', kind: 'bank' },
    { id: 'k', label: 'card.lifecycle', kind: 'event' },
    { id: 'w', label: 'Wallet', kind: 'bank' },
  ],
  steps: [
    { from: 't', to: 'k', label: 'start watching', note: 'The test opens a watcher on the topic first. From now on it sees every new event.' },
    { from: 't', to: 'c', label: 'report lost', note: 'Then it reports its own new card lost through the API.' },
    { from: 'c', to: 'k', label: 'CARD_LOST', kind: 'event', note: 'Cards publishes a card-lost event on the topic.' },
    { from: 'k', to: 'w', label: 'event', kind: 'event', note: 'Wallet, a real consumer, reads it and pauses the card. The flow tests check this part.' },
    { from: 'k', to: 't', label: 'event', kind: 'event', note: 'The watcher reads the same event. Wallet still gets its copy, because reading takes nothing away.' },
    { from: 't', to: 't', label: 'match card_id, check', kind: 'self', note: 'The test keeps only the event about its card, then checks the details.' },
  ],
  caption: 'Gold arrows are events. The test reads the topic alongside Wallet.',
})}

<h2>Checking the broker</h2>
${code({ title: 'tests/api/events.py', src: `
from kafka import KafkaConsumer, TopicPartition

import config


def connect():
    """Open a connection to the Kafka broker for reading."""
    # Tests only look at events. They never save how far they have read, so auto-commit is off.
    return KafkaConsumer(bootstrap_servers=config.KAFKA_BOOTSTRAP, enable_auto_commit=False)


def list_topics():
    """Return the names of all the topics the Kafka broker has."""
    consumer = connect()
    topics = consumer.topics()
    consumer.close()
    return topics
` })}
<p><strong>kafka-python</strong> is a library for talking to Kafka from Python, and <code>KafkaConsumer</code> is its reader. Consumers normally record how far they have read, to carry on after a restart; a test starts fresh every time, so <code>connect()</code> turns that off. <code>topics()</code> returns the set of topic names.</p>
${code({ title: 'tests/api/tests/test_events.py', src: `
def test_the_broker_has_every_topic_the_app_uses():
    topics = list_topics()

    for topic in APP_TOPICS:
        assert topic in topics
` })}
<p><code>APP_TOPICS</code> is a list at the top of the file with the five topic names. If a deployment forgot one, every flow that needs it would later fail with a vague timeout. This test fails first and names the missing topic.</p>

<h2>Watching for one event</h2>
${code({ title: 'tests/api/events.py', src: `
class EventWatcher:
...
    def __init__(self, topic):
        self.consumer = connect()
        # A topic is split into partitions. Read all of them, starting at their current end.
        partitions = []
        for number in self.consumer.partitions_for_topic(topic):
            partitions.append(TopicPartition(topic, number))
        self.consumer.assign(partitions)
        self.consumer.seek_to_end()
        # Ask for each position now, so "the end" is fixed before the test's action happens.
        for partition in partitions:
            self.consumer.position(partition)

    def wait_for(self, field, value, timeout=10):
...
        deadline = time.time() + timeout
        try:
            while time.time() < deadline:
                # poll() returns the messages that arrived, grouped by partition.
                batches = self.consumer.poll(timeout_ms=500)
                for messages in batches.values():
                    for message in messages:
                        event = json.loads(message.value)
                        if event["payload"].get(field) == value:
                            return event
        finally:
            self.consumer.close()
        raise AssertionError(f"No event with {field} = {value} arrived within {timeout} seconds")
` })}
<ul>
<li><code>partitions_for_topic</code> gives the partition numbers (0, 1 and 2). <code>assign</code> makes the watcher read all of them itself, so no event can slip past on a partition it skipped.</li>
<li><code>seek_to_end()</code> starts reading at the current end, so events from earlier runs are ignored. The library only works out where “the end” is when asked, so <code>position()</code> asks straight away, before the test acts.</li>
<li><code>wait_for</code> polls with a deadline, like <code>wait_for_transactions</code> in <a href="/learn/py-flow-test/">A flow test</a>. <code>poll(timeout_ms=500)</code> waits up to half a second for new messages.</li>
<li><code>json.loads</code> turns a message’s bytes into a dictionary; <code>.get(field)</code> reads a key without failing when it is missing.</li>
<li><code>try ... finally</code> closes the connection whether an event was found, the time ran out, or something broke.</li>
</ul>

<h2>Why the order matters</h2>
<p>What happens if the watcher is created after the action? To find out, the card-lost test was copied with two lines swapped:</p>
${code({ title: 'Example · watching too late', src: `
    CardsApi(customer["token"]).report_lost(card_id)
    watcher = EventWatcher("card.lifecycle")  # too late: the event has already gone

    event = watcher.wait_for("card_id", card_id)
` })}
${terminal([['pytest tests/test_late.py --tb=short', `tests/test_late.py::test_reporting_a_card_lost_sends_a_card_lost_event FAILED [100%]
...
E   AssertionError: No event with card_id = 51ea8eef-3ce2-4cdb-830e-318496b59894 arrived within 10 seconds
============================== 1 failed in 10.45s ==============================`]], 'Terminal')}
<p>The event was published before the watcher existed, and the watcher starts at the end, so it never sees it. Ten seconds later the test fails, even though Cards did everything right. A longer timeout would not help. The fix is the order: watch, then act.</p>
<p>Matching by ID matters for a similar reason. Other tests, running in parallel or by other people on the same server, publish card events at the same time. Matching on the <code>card_id</code> of a card this test created means only its own event can pass.</p>

<h2>The event tests</h2>
${code({ title: 'tests/api/tests/test_events.py', src: `
def test_reporting_a_card_lost_sends_a_card_lost_event(customer):
    card_id = customer["new_card"]["card_id"]
    watcher = EventWatcher("card.lifecycle")  # start watching before the action

    CardsApi(customer["token"]).report_lost(card_id)

    event = watcher.wait_for("card_id", card_id)
    assert event["event_type"] == "card.lifecycle"
    assert event["payload"]["event"] == "CARD_LOST"
    assert event["payload"]["status"] == "LOST"
    # Every event carries an ID and a time, so it can be traced and ordered.
    assert event["event_id"]
    assert event["occurred_at"]


def test_a_purchase_sends_an_event_with_the_decision(customer):
    card = customer["wallet_card"]
    watcher = EventWatcher("auth.decided")

    response = CardNetworkApi().make_purchase(card["token_ref"], amount=2500)

    event = watcher.wait_for("trace_id", response.json()["trace_id"])
    assert event["payload"]["decision"] == "APPROVED"
    assert event["payload"]["amount"] == 2500
    assert event["payload"]["card_id"] == card["card_id"]
` })}
<p>Every CardVault event has the same outer shape, the <strong>envelope</strong>: <code>event_id</code>, <code>event_type</code>, <code>occurred_at</code> and a <code>payload</code> with the details. The expected values come from what the test did: its own card, the amount it chose, and approval because a fresh card has plenty of room. These tests prove the event left Cards correctly, not that Wallet or Transactions handled it; the flow tests cover that.</p>

<h2>What else teams test</h2>
${table(['Concern', 'What a test checks'], [
  ['Event shape', 'Each event matches an agreed schema, the way responses are checked against JSON Schemas'],
  ['Duplicates', 'Kafka can deliver an event twice. A consumer given the same event twice should act once'],
  ['Bad messages', 'A message a consumer cannot read goes to a **dead-letter topic** to be looked at, instead of blocking everything behind it'],
  ['Order', 'Events about one thing, such as one card, carry the same key, so they share a partition and arrive in order'],
])}

${keyIdea('<p>Start watching before the action, match the event by an ID the test owns, and wait with a deadline. Check the broker first, the event second, and the consumer’s reaction with a flow test.</p>')}

${testerEye('<p>Event tests make a failing flow easy to place. Event test red: the producer or the broker. Event test green but flow test red: the consumer.</p>')}

${interview({
  say: `<p>“CardVault’s services publish events on Kafka, so besides flow tests I test the events directly. One test checks the broker has every topic the app uses. Event tests open a consumer on the topic before the action, perform it through the API, then poll for the event that carries the test’s own card or trace ID, with a ten-second deadline, and check its type and payload. That tells me whether a failing flow broke at the producer or at the consumer.”</p>`,
  qa: [
    ['How would you test that a Kafka flow works?', '<p>In layers: check the broker and topics exist, check the producing action publishes the right event with the right payload, and check the consuming service’s result through its API with polling.</p>'],
    ['Why start the consumer before the action?', '<p>The consumer starts at the end of the topic. If the event is published first, the consumer never sees it and the test times out, even though the system worked.</p>'],
    ['What is a dead-letter queue?', '<p>A separate topic where a consumer puts messages it cannot process, so one bad message does not block the rest. Tests can send a malformed message and check it lands there while good messages still flow.</p>'],
  ],
})}
`,
};
