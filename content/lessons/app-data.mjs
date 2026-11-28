import { figure, interview, keyIdea, realWorld, table, testerEye } from '../../src/components.mjs';
import { databases } from '../diagrams/app.mjs';

export default {
  minutes: 8,
  lede: 'Every screen you saw is drawn from data a service has stored. This lesson shows where that data lives, which service owns which records, and how a service can know about data it does not own.',
  youWill: 'You will be able to explain CardVault’s data layout and why each service keeps its own database.',
  body: `
<h2>One server, five databases</h2>
${figure({ svg: databases(), caption: 'Each arrow goes to one database only. No service reads another service’s tables.' })}
<p>CardVault stores its data in <strong>PostgreSQL</strong> (Postgres for short), a widely used relational database: data is kept in tables of rows and columns, and read and written with SQL. One Postgres server runs, and inside it each service has its <strong>own database</strong>, with its own login. A service can only reach its own tables.</p>
<p>This is the “database per service” rule of microservices. It means each service can change its tables without breaking anyone else. The price is that no service can simply join its tables with another service’s. Data that crosses a boundary travels through an API call or an event.</p>

<h2>Who keeps what</h2>
${table(['Service', 'Database', 'Its main records'], [
  ['Login', '`auth`', 'Customers and their sign-in names, password hashes (never the passwords), failed sign-in counts and lockouts, refresh tokens'],
  ['Cards', '`card`', 'Cards with their status, limit and available amount; one row per purchase decision; holds on money; which wallet tokens may pay'],
  ['Wallet', '`enrollment`', 'One wallet record per card with its status and history; the customer’s wallet choices (opted out, cards removed); copies of card and contact facts'],
  ['Transactions', '`wallet_txn`', 'The customer’s wallet purchases with their amounts and status; disputes and their receipts'],
  ['Profile', '`profile`', 'Email and phone, and whether each is verified'],
])}
<p>A few facts are the same everywhere: money is stored as whole cents with a currency (<code>2500</code> and <code>USD</code>), and every time is stored in UTC. The full card number is stored only in Cards, encrypted. Every screen and API shows just the last four digits.</p>

<h2>Copies built from events</h2>
<p>To decide whether a card may join the wallet, Wallet needs to know the card’s status and product, and whether the customer’s email and phone are verified. That data belongs to Cards and Profile. Asking them on every wallet screen would tie the three services together.</p>
<p>Instead, Wallet keeps its own small <strong>copy</strong> of those facts. It fills the copy from the <code>card.lifecycle</code> and <code>contact.updated</code> events, and reads only its copy when it checks the rules. Transactions works the same way: its purchase list is built entirely from the events Cards sends.</p>
${table(['Copy in…', 'Built from', 'Used for'], [
  ['Wallet: card facts', '`card.lifecycle` events from Cards', 'Eligibility: active, not expired, credit or debit, recently used'],
  ['Wallet: contact facts', '`contact.updated` events from Profile', 'Eligibility: email and phone verified'],
  ['Transactions: the purchase list', '`auth.decided` and `txn.cleared` events from Cards', 'The Transactions screen, the CSV export and disputes'],
])}

${keyIdea('<p>One owner per record. Other services keep copies, filled from events, so the same fact can be briefly out of date in a copy. That gap is exactly where cross-service bugs hide.</p>')}

<h2>How testers look inside</h2>
<p>Each database also has a <strong>read-only</strong> login meant for tests. It can read every table but change nothing, so a test can check what the API cannot show without any risk of damaging the data. Typical checks: a password is stored as a hash, a refused request really left the card’s available amount alone, or a purchase is stored once and not twice.</p>
<p>On a local stack, Postgres listens on <code>localhost:5432</code>. The read-only logins are listed in the CardVault repository’s <code>.env.example</code>. You will use them in <a href="/learn/py-database-checks/">Database checks in API tests</a>.</p>

${testerEye(`<ul>
<li>Check the owner first: the API of the service that owns the record is the truth. A copy elsewhere can lag a moment behind.</li>
<li>Compare the owner and the copy after a change. For example, report a card lost and check that Wallet’s view of the card catches up.</li>
<li>Use the database only for what no response shows. Most checks belong at the API.</li>
</ul>`)}

${realWorld('<p>A real bank would give each service its own database server, with backups, encryption at rest and strict access control. CardVault shares one server to stay small, but keeps the property that matters: no service can read another’s tables.</p>')}

${interview({
  say: `<p>“Each service owns its data in its own Postgres database: login has customers and refresh tokens, cards has cards, authorisations and holds, enrolment has the wallet records, transactions has the customer’s purchase history and disputes, and profile has contact details.</p>
<p>No service reads another’s tables. When one needs another’s data, it keeps a local copy built from Kafka events. For example, enrolment keeps a copy of card status and contact verification to decide eligibility. Money is integer cents, times are UTC, and tests use a read-only role for database checks.”</p>`,
  qa: [
    ['Why a database per service?', '<p>Each service can change its own tables safely, and a problem in one database does not spread. It also forces clear boundaries: all sharing happens through APIs and events. The cost is that data is duplicated and copies can be briefly out of date.</p>'],
    ['A card shows as lost in Cards but still enrolled in the wallet. Where do you look?', '<p>At the path between them: did Cards send the <code>CARD_LOST</code> event, did Wallet receive and handle it, and did the wallet company confirm the suspension? I would check the event on the topic, then Wallet’s copy of the card, then the enrolment history.</p>'],
    ['When would you check the database in a test?', '<p>Only for facts no response shows: how a password is stored, that a rejected request changed nothing, that a record exists exactly once. Everything else I check through the API, the way a customer or another service sees it.</p>'],
  ],
})}
`,
};
