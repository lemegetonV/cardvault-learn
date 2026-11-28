import { figure, shot, interview, keyIdea, table, terminal, testerEye, code, watchIt } from '../../src/components.mjs';
import { topics } from '../diagrams/app.mjs';

export default {
  minutes: 11,
  lede: 'The system lesson said each service keeps its own data and tells the others about changes through events. This lesson opens both up: which databases and tables hold what, which Kafka topics carry which news, and what one real event looks like.',
  youWill: 'You will be able to name where each kind of data lives, draw the five topics with who sends and who listens, and explain why some results appear a moment later.',
  body: `
<h2>Why a tester looks behind the API</h2>
<p>An API answer tells you what a service says. Sometimes a test also needs to know what it <em>did</em>: whether the change was really saved, or whether the other services were told about it. Those two questions are answered in two places, the <strong>database</strong> and the <strong>message bus</strong>. The API track has a lesson on checking each one, and both use the names on this page.</p>

<h2>One database per service</h2>
<p>CardVault runs one Postgres server, a database program that stores data in tables of rows and columns. Inside it, each service has a database of its own, and no service reads another service’s tables. That is what “a service owns its data” means in practice.</p>
${table(['Service', 'Database', 'Main tables', 'What they hold'], [
  ['Login', '`auth`', '`users`, `login_attempts`, `refresh_tokens`', 'Each customer’s username and password hash, failed sign-ins (for the lock-out), and the long-lived tokens that renew a session.'],
  ['Cards', '`card`', '`cards`, `holds`, `authorizations`', 'Each card with its limit and available amount, money held for approved purchases, and every purchase decision.'],
  ['Profile', '`profile`', '`profiles`', 'Email and phone, and whether each one is verified.'],
  ['Wallet', '`enrollment`', '`enrollments`, `enrollment_history`, `card_projection`', 'Each card’s wallet status, every change to it with the reason, and Wallet’s own copy of card facts.'],
  ['Transactions', '`wallet_txn`', '`wallet_transactions`, `disputes`', 'The customer’s list of wallet purchases, and disputes.'],
])}
<p>Here is alice’s row in each card, read from a local copy of CardVault with the read-only user that tests use. A <strong>read-only user</strong> can look at the data but can never change it, so a test cannot damage the app it is checking.</p>
${terminal([
  ["docker compose exec postgres psql -U card_ro -d card -c \"SELECT last4, product, status, limit_amount, available_amount FROM cards WHERE customer_id = 'a11ce000-0000-4000-8000-000000000001' ORDER BY last4;\"",
` last4 | product | status | limit_amount | available_amount
-------+---------+--------+--------------+------------------
 2045  | DEBIT   | ACTIVE |       250000 |           157928
 4417  | CREDIT  | ACTIVE |       500000 |           137974
 5521  | PREPAID | ACTIVE |        50000 |            50000
 7380  | CREDIT  | ACTIVE |       300000 |           300000
(4 rows)`],
], 'Terminal · the card database')}
<p>The amounts are whole numbers of <strong>cents</strong>: <code>500000</code> is $5,000.00. Banks store money this way because decimal fractions in computers can round wrongly, and a cent lost in rounding is still a cent lost.</p>

${keyIdea('<p>The API is the front door, and the database is the room behind it. Most tests only need the front door. Look in the room when the API cannot show the thing you are checking, such as a password being stored as a hash or a card number being stored encrypted.</p>')}

<h2>Events on Kafka</h2>
<p>Kafka is the message bus from the system lesson. News is sorted into <strong>topics</strong>, one per kind of news. A service that <strong>publishes</strong> to a topic adds a message to the end of it. A service that <strong>listens</strong> reads the messages in order and remembers how far it got, so a listener that was stopped carries on where it left off. CardVault uses five topics.</p>
${figure({ svg: topics(), caption: 'Green boxes are CardVault services, gold boxes are topics. Cards publishes three topics and Wallet listens to two.' })}
<ul>
<li><strong>Profile → Wallet.</strong> When an email or phone changes, it becomes unverified, and Wallet takes the customer’s cards out of the wallet.</li>
<li><strong>Cards → Wallet.</strong> When a card is lost, reissued or closed, Wallet pauses it, brings it back or removes it.</li>
<li><strong>Cards → Transactions.</strong> Every purchase decision and every settlement becomes a row in the customer’s purchase list.</li>
<li><strong>Wallet → Cards.</strong> When a card joins or leaves the wallet, Cards knows whether wallet purchases with it may be approved.</li>
</ul>
<p>Wallet’s <code>card_projection</code> table is built from the <code>card.lifecycle</code> topic. It is Wallet’s own copy of the card facts it needs, so it can check the wallet rules without calling Cards every time.</p>
${shot({ src: 'console-topics.png', alt: 'The Redpanda console listing seven topics: auth.decided, card.lifecycle, contact.updated, enrollment.changed, enrollment.dlq, txn.cleared and wallet.txn.dlq.', caption: 'The Kafka console on a local copy. The two topics ending in <code>.dlq</code> hold any message a listener could not handle, so it is kept for someone to look at instead of being lost.' })}

<h2>One event, field by field</h2>
<p>This is the real event Cards published when alice’s credit card was reported lost on a local copy:</p>
${code({ title: 'card.lifecycle · one message', lang: 'json', note: 'json', src: `
key: "ca4d0000-a11c-4000-8000-000000000001"
{
  "event_type": "card.lifecycle",
  "event_id": "eb1c493e-80a9-40f4-b914-5e782fa7af44",
  "occurred_at": "2026-11-28T09:17:43.537727Z",
  "correlation_id": "847c5203-5580-4feb-8be4-70271026858b",
  "version": 1,
  "payload": {
    "event": "CARD_LOST",
    "card_id": "ca4d0000-a11c-4000-8000-000000000001",
    "customer_id": "a11ce000-0000-4000-8000-000000000001",
    "last4": "4417",
    "product": "CREDIT",
    "status": "LOST",
    "expiry": "2029-06",
    "last_used_at": "2026-11-26T09:17:36.071038Z"
  }
}` })}
${table(['Field', 'What it is for'], [
  ['key', 'The card’s id. Kafka keeps messages with the same key in order, so “lost” can never overtake “reissued” for the same card.'],
  ['event_id', 'A unique id. If a message is delivered twice, the listener sees an id it has already handled and skips it.'],
  ['occurred_at', 'When it happened, in UTC.'],
  ['correlation_id', 'The id of the request that caused it. Search the logs for it to follow one click through every service.'],
  ['payload', 'The news itself: which card, what happened, and its new status.'],
])}

<h2>What this means for a test</h2>
<p>When alice reports a card lost, the <code>cards</code> row says <code>LOST</code> before the API even answers. The wallet only changes after Wallet has read the event, which is usually well under a second later. Data that is correct everywhere after a short delay is called <strong>eventually consistent</strong>.</p>
${testerEye(`<ul>
<li>Check the owning service straight away: its API answer and its own table.</li>
<li>Check the other services by <strong>waiting</strong> for the result, with a time limit, never with one check or a fixed sleep.</li>
<li>To check an event, start watching the topic <em>before</em> the action, then wait for the message that matches your card.</li>
</ul>`)}
${watchIt({ intro: 'These two API tests report a card lost for a new test customer. The first reads the <code>cards</code> table afterwards; the second watches <code>card.lifecycle</code> for the event. The panel shows every request, database read, event and check.', runs: [
  { api: 'tests/test_database.py::test_reporting_a_card_lost_is_saved_in_the_database', label: 'Run the database check' },
  { api: 'tests/test_events.py::test_reporting_a_card_lost_sends_a_card_lost_event', label: 'Run the event check' },
] })}
<p>The API track shows how those tests are written, in <a href="/learn/py-database-checks/">Database checks in API tests</a> and <a href="/learn/py-kafka-events/">Testing Kafka and event flows</a>.</p>

${interview({
  say: `<p>“Each service has its own Postgres database: login has users and login attempts, cards has cards, holds and purchase decisions, wallet has enrolments and their history, transactions has the purchase list and disputes. No service reads another’s tables.</p>
<p>They share news through five Kafka topics. Cards publishes card lifecycle changes, purchase decisions and settlements; profile publishes contact changes; wallet publishes enrolment changes. Each event has a unique id, so a listener can ignore a repeat, and the card id as its key, so events for one card stay in order. Because the other services update a moment later, our tests wait for those results instead of checking once.”</p>`,
  qa: [
    ['When would you check the database in an API test?', '<p>When the API cannot show what I need to prove. For example, that a password is stored as a hash, that a card number is encrypted, or that a refused request wrote nothing. I use a read-only user, and I still check the API answer first, because that is what the customer sees.</p>'],
    ['What is eventual consistency, and how does it affect your tests?', '<p>Data in different services becomes correct after a short delay instead of at once, because they update each other through events. A test that checks another service straight after the action can fail even when nothing is wrong, so I wait for the expected state with a time limit.</p>'],
    ['What can go wrong with events, and how would you test it?', '<p>An event can arrive twice, late, or not at all if a listener is down. I would check that a repeated event changes nothing twice, that a stopped listener catches up when it restarts, and that a message it cannot read is kept aside instead of lost.</p>'],
  ],
})}
`,
};
