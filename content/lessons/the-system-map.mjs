import { figure, keyIdea, testerEye, terms, check, recap, table } from '../../src/components.mjs';
import { serviceMap } from '../diagrams/map.mjs';
import { callVsEvent } from '../diagrams/basics.mjs';

export default {
  minutes: 12,
  lede: 'CardVault is not one program. It is eight small programs, two data stores and a set of arrows between them. Once you can read the map, every later lesson is a zoom into one corner of it.',
  youWill: 'You will learn who does what, and the two ways the parts talk.',
  body: `
<h2>The whole map</h2>
<p>Here is every part of CardVault on one page. Do not try to take it all in at once. The rest of this lesson reads it in three passes.</p>
${figure({ svg: serviceMap(), caption: 'Green boxes are bank services, under test. Slate dashed boxes are mocks. Solid lines are HTTP calls, gold dashed lines are events. The <a href="/map/">interactive map</a> lets you click a box to follow only its lines.' })}

<h2>Pass one: the boxes</h2>
<p>Each green box is a <strong>service</strong>: a small program with one job, its own port, and its own database. Splitting the bank this way means each part can be understood, changed and tested on its own.</p>
${table(['Service', 'Its one job', 'Port'], [
  ['auth', 'Logs customers in and issues their tokens', '8001'],
  ['card', 'Keeps cards and balances, decides purchases', '8002'],
  ['enrollment', 'Decides which cards join the wallet and talks to the operator', '8003'],
  ['wallet-txn', 'Keeps the customer’s list of wallet purchases and disputes', '8004'],
  ['profile', 'Keeps email and phone, and whether each is verified', '8005'],
  ['web', 'The website, plus a thin server that forwards calls', '3000'],
])}
<p>Two boxes are mocks. The <strong>card network</strong> mock (port 8102) sends purchases to the card service. The <strong>wallet operator</strong> mock (port 8101) receives requests from the enrollment service and answers later.</p>
<p>At the bottom sit the two shared pieces of infrastructure. <strong>Postgres</strong> is the database server, with one separate database per service. <strong>Redpanda</strong> is a message broker that speaks the Kafka protocol. It carries every gold arrow.</p>

<h2>Pass two: the solid lines</h2>
<p>A solid line is an <strong>HTTP call</strong>. One program sends a request and waits until the other sends back a response. You already know this pattern from any website or API.</p>
<p>Notice where the solid lines go. The browser talks only to <strong>web</strong>. The web app’s server then forwards each call to the service that owns the data: card questions to the card service, wallet questions to the enrollment service, and so on. This forwarding layer is called a <strong>BFF</strong>, a backend for frontend. It keeps the login safe in cookies and holds no business rules of its own.</p>
<p>The other solid lines connect the bank to its partners. The network mock calls the card service to ask for decisions, and the enrollment service and the operator mock call each other with signed requests.</p>

<h2>Pass three: the gold lines</h2>
<p>A gold dashed line is an <strong>event</strong>: a short message that says “this happened”. The sender writes it to Redpanda and carries on with its work. Whoever is interested reads it when they can. Nobody waits.</p>
${figure({ svg: callVsEvent(), caption: 'A call is a question that needs an answer now. An event is news that others can act on in their own time.' })}
<p>CardVault has five kinds of event, each on its own <strong>topic</strong>.</p>
<ul>
<li><code>card.lifecycle</code>: a card was activated, used, lost, reissued or closed. The enrollment service listens.</li>
<li><code>contact.updated</code>: an email or phone changed or was verified. The enrollment service listens.</li>
<li><code>enrollment.changed</code>: a wallet token was added, paused or removed. The card service listens.</li>
<li><code>auth.decided</code> and <code>txn.cleared</code>: a purchase was decided, or settled, reversed or refunded. The wallet transaction service listens.</li>
</ul>
<p>The <a href="/events/">event catalogue</a> shows what is inside each one.</p>

<h2>Why not just call each other?</h2>
<p>Look at the card service. When a wallet purchase arrives, it must know whether the wallet token is still active. The enrollment service owns that fact. The card service could call the enrollment service on every purchase, but then a slow or broken enrollment service would stop every wallet payment.</p>
<p>Instead, the card service keeps its own <strong>local copy</strong> of each token’s status, kept up to date by <code>enrollment.changed</code> events. Purchases are decided from that copy, with no extra call. The enrollment service stays the <strong>system of record</strong>: the one place whose answer is the truth. The copy follows it closely, a moment behind.</p>
${keyIdea(`<p>Events let services work even when their neighbours are slow or down. The price is that copies are <strong>eventually consistent</strong>: right after a change, another service may still hold the old value for a short time. For a token that was just paused, there is a brief window where a purchase could still be approved.</p>`)}
${testerEye(`<p>Eventual consistency changes how you check results. If a test reports a card lost and immediately asks the wallet for its status, it may see the old value and fail for the wrong reason. Later lessons show how CardVault lets tests wait until nothing is still in flight, instead of guessing with a fixed sleep.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Service', 'A small program with one job, its own port and its own database.'],
  ['HTTP call', 'A request that waits for a response. Drawn as a solid line.'],
  ['Event', 'A message that says something happened, posted without waiting. Drawn as a gold dashed line.'],
  ['Topic', 'A named stream of events of one kind, such as `card.lifecycle`.'],
  ['Redpanda', 'The message broker that stores and delivers events. It is compatible with Kafka.'],
  ['BFF', 'Backend for frontend: the web app’s server, which forwards the browser’s calls to the right service.'],
  ['System of record', 'The one service whose data is the truth for a given fact.'],
  ['Eventually consistent', 'A copy that matches the system of record after a short delay, not at every instant.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'The browser needs alice’s list of wallet transactions. Which path does the request take?',
  options: ['Browser → wallet-txn service', 'Browser → web → wallet-txn service', 'Browser → card service → wallet-txn service', 'Browser → Redpanda → wallet-txn service'],
  answer: 1,
  why: '<p>The browser only ever talks to the web app. Its server, the BFF, forwards the call to the service that owns the data, here the wallet transaction service. Services do not accept calls from the browser directly.</p>',
})}
${check({
  q: 'The enrollment service is down for a minute. A purchase arrives with an active wallet token. What happens?',
  options: ['The purchase is declined because the card service cannot reach enrollment', 'The card service decides from its local copy of token statuses', 'The card network waits until enrollment is back', 'The web app decides instead'],
  answer: 1,
  why: '<p>The card service never calls the enrollment service while deciding. It keeps a local copy of token statuses fed by <code>enrollment.changed</code> events, so purchases keep working while enrollment is down.</p>',
})}
${check({
  q: 'Which statement about events is true?',
  options: ['The sender waits until every listener has handled the event', 'The sender writes the event and carries on; listeners handle it in their own time', 'Events go straight from one service to another without a broker', 'Every service listens to every topic'],
  answer: 1,
  why: '<p>Events are posted to Redpanda and read later by whoever listens to that topic. Each topic has specific listeners: for example, only the enrollment service reads <code>card.lifecycle</code>.</p>',
})}

<h2>Recap</h2>
${recap([
  'Five bank services, a web app, two mocks, Postgres and Redpanda.',
  'Solid lines are HTTP calls that wait. Gold lines are events that do not.',
  'The browser talks only to the web app, whose BFF forwards to the owning service.',
  'Services keep local copies of other services’ facts, updated by events, so they keep working when a neighbour is down.',
  'Copies are eventually consistent, so tests must allow for a short delay after a change.',
])}
`,
};
