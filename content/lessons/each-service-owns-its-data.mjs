import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, code } from '../../src/components.mjs';
import { databases, projection } from '../diagrams/inside.mjs';

export default {
  minutes: 10,
  lede: 'Every CardVault service keeps its own data in its own database, and no service reads another’s. That one rule explains a lot of the design, and it also tells you where a test should look to check that something really happened.',
  youWill: 'You will learn which service owns which data, how services share it without sharing a database, and how tests can look inside safely.',
  body: `
<h2>One server, five databases</h2>
<p>CardVault runs a single Postgres server, but inside it each service has a separate database with its own login. The card service can only log in to the <code>card</code> database, the profile service only to <code>profile</code>, and so on.</p>
${figure({ svg: databases(), caption: 'Each service logs in as its own owner role (for example card_svc). Tests use a matching read-only role (card_ro), which can look but never change anything.' })}
<p>Here is what each one keeps. You do not need to remember the table names, only which service is the source of truth for what.</p>
${table(['Service', 'Is the source of truth for', 'Main tables'], [
  ['auth', 'Logins, failed attempts, refresh tokens and signing keys', '`users`, `login_attempts`, `refresh_tokens`, `signing_keys`'],
  ['card', 'Cards, spending limits, holds and authorization decisions', '`cards`, `holds`, `authorizations`, `wallet_tokens`'],
  ['profile', 'Email address, phone number and whether each is verified', '`profiles`, `otp_state`'],
  ['enrollment', 'Which cards are in the wallet, and their history', '`enrollments`, `enrollment_history`, `card_projection`, `contact_projection`'],
  ['wallet-txn', 'The wallet’s transaction history and disputes', '`wallet_transactions`, `disputes`'],
])}

<h2>Why not one shared database?</h2>
<p>One big database would be simpler at first. Any service could join any table. The trouble starts later:</p>
<ul>
<li>If the enrollment service read the card service’s tables directly, the card team could not rename a column without breaking enrollment.</li>
<li>Two services writing the same rows would need to agree on locking and on which rules apply.</li>
<li>A slow query from one service would slow every other one.</li>
</ul>
<p>Giving each service its own database turns those hidden dependencies into visible ones. If enrollment needs to know about cards, it has to get that information through an API or an event, which the card service publishes on purpose and keeps stable.</p>
${keyIdea(`<p>A service’s API and events are its promises to the outside world. Its tables are private. That is why tests check behaviour through the API first, and only look at tables to confirm something the API cannot show.</p>`)}

<h2>So how does one service know another’s data?</h2>
<p>There are two ways, and CardVault uses both.</p>
<p><strong>Ask when needed.</strong> One service calls another’s API and waits for the answer. For example, when the card network asks for approval, it calls the card service, which holds the limits and decides on the spot.</p>
<p><strong>Keep a copy.</strong> A service listens to another’s events and keeps a small copy of the facts it needs. The enrollment service does this for cards, so it can check whether a card may join the wallet without calling the card service every time.</p>
${figure({ svg: projection(), caption: 'A copy built from events is called a projection. The enrollment service owns its copy, but the card service stays the source of truth.' })}
<p>The copy is useful, but it is never quite instant. Between the card service changing a card and the enrollment service reading the event, the two can briefly disagree. <a href="/learn/why-events/">Why services talk in events</a> looks at that delay and how CardVault keeps it short.</p>
${testerEye(`<p>A projection is a place where bugs hide. After a test reports a card lost through the card service, it is fair to check that the enrollment service soon treats that card as lost too. Because the copy updates a moment later, the test must wait for it with a short, bounded retry, not a fixed sleep and not an immediate check.</p>`)}

<h2>Conventions every database follows</h2>
<p>All five databases store data the same way, which makes them predictable to read and to test.</p>
<ul>
<li><strong>Money is a whole number of cents.</strong> $250.00 is stored and sent as <code>25000</code>, with a separate <code>currency</code> of <code>"USD"</code>. Decimal fractions are never used for money, because computers cannot store values like 0.1 exactly, and small errors add up.</li>
<li><strong>Time is UTC.</strong> Timestamps are stored and returned in UTC, in ISO 8601 format, such as <code>2026-11-25T09:14:03Z</code>. Only the web app converts them to the viewer’s local time.</li>
<li><strong>IDs are UUIDs.</strong> Seed data uses fixed UUIDs, so the same customer or card has the same ID after every reset.</li>
<li><strong>Tables change by migrations only.</strong> Each service’s <code>migrations</code> folder holds numbered changes, applied in order at start-up.</li>
</ul>
${code({ lang: 'json', title: 'A card from GET /v1/cards (some fields left out)', src: `{
  "card_id": "ca4d0000-a11c-4000-8000-000000000001",
  "last4": "4417",
  "status": "ACTIVE",
  "limit": 500000,
  "available": 475000
}` })}
<p>Read that as a $5,000.00 limit with $4,750.00 still available. The IDs and amounts here are illustrations of the format; <a href="/apis/">the API reference</a> lists every field.</p>

<h2>Looking inside, safely</h2>
<p>Sometimes a test needs to see what the API does not show, such as whether a hold row was released or an event was recorded as processed. For that, every database has a read-only login, named after the database with <code>_ro</code> on the end. The connection strings are listed in <code>.env.example</code>.</p>
${code({ lang: 'sql', title: 'Connected as card_ro to the card database', src: `SELECT status, amount
FROM holds
WHERE card_id = 'ca4d0000-a11c-4000-8000-000000000001';` })}
<p>The read-only role can run <code>SELECT</code> and nothing else. That protects you from a test that accidentally changes the very data it is trying to check.</p>
${realWorld(`<p>In a real bank, testers would rarely get any login to a production database at all, and test environments often hide card numbers and personal details. Read-only roles like these are what a well-run test environment offers instead of full access.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Source of truth', 'The one service whose data counts when copies disagree. For cards, that is the card service.'],
  ['Database per service', 'Each service keeps its data in its own database, and no other service reads it directly.'],
  ['Projection', 'A service’s own copy of another service’s facts, kept up to date from events.'],
  ['Minor units', 'Money as a whole number of the smallest unit: cents for US dollars. `25000` means $250.00.'],
  ['Read-only role', 'A database login such as `card_ro` that can read but not change anything. Tests use it.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test needs to know whether alice’s email address is verified. Which service is the source of truth?',
  options: ['auth', 'profile', 'enrollment, because it has `contact_projection`', 'web'],
  answer: 1,
  why: '<p>The profile service owns contact details and their verification. The enrollment service keeps a copy for its own checks, but if the two disagree, the profile service is right.</p>',
})}
${check({
  q: 'A purchase response shows `"amount": 1999`. How much was the purchase?',
  options: ['$1,999.00', '$19.99', '$1.999', 'It depends on the card'],
  answer: 1,
  why: '<p>Amounts are whole cents in a stated currency. 1999 cents in US dollars is $19.99.</p>',
})}
${check({
  q: 'A test reports card 4417 lost, then immediately reads the enrollment service’s view of that card and still sees `ACTIVE`. What is the most likely explanation, and what should the test do?',
  options: ['The enrollment service is broken; fail the test', 'The enrollment service’s copy has not caught up yet; poll for a short, bounded time', 'The card was never reported lost; repeat the request', 'Read the card service’s table with the read-only role instead'],
  answer: 1,
  why: '<p>The enrollment service learns about the change from an event, a moment later. A test should wait for the copy with a short, bounded retry. If it still says <code>ACTIVE</code> after that, that is a real finding.</p>',
})}

<h2>Recap</h2>
${recap([
  'One Postgres server holds five service databases plus `testsupport`. Each service can only reach its own.',
  'Services share data through APIs and events, never through each other’s tables.',
  'A projection is a local copy built from events. It is useful, and briefly behind.',
  'Money is whole cents, time is UTC, IDs are UUIDs, and tables change only through migrations.',
  'Tests can look inside with the `_ro` roles, which can read but not change data.',
])}
`,
};
