import { keyIdea, testerEye, realWorld, terms, check, recap, table, sequence } from '../../src/components.mjs';

const race = sequence({
  id: 'seq-race',
  label: 'Two authorizations with the same trace_id arrive at once. Request A locks the card row, finds no stored decision, approves and creates a hold, and commits. Request B was waiting for the lock; it then finds A’s stored decision and returns it without a second hold.',
  actors: [
    { id: 'a', label: 'Request A', kind: 'mock' },
    { id: 'db', label: 'card row', kind: 'bank' },
    { id: 'b', label: 'Request B', kind: 'mock' },
  ],
  steps: [
    { from: 'a', to: 'db', label: 'SELECT … FOR UPDATE', note: 'Request A locks card 4417’s row. Same `trace_id` as B, arriving a millisecond earlier.' },
    { from: 'b', to: 'db', label: 'SELECT … FOR UPDATE', note: 'Request B asks for the same lock and has to wait. It does nothing else meanwhile.' },
    { from: 'a', to: 'a', kind: 'self', label: 'no decision stored: approve, hold', note: 'Holding the lock, A checks for a stored decision for this `trace_id`, finds none, approves, creates the hold and reduces `available`.' },
    { from: 'a', to: 'db', label: 'COMMIT (lock released)', note: 'A’s changes become visible and the lock is released.' },
    { from: 'db', to: 'b', kind: 'reply', label: 'lock granted', note: 'B now holds the lock and sees A’s committed work.' },
    { from: 'b', to: 'b', kind: 'self', label: 'decision stored: return it', note: 'B checks again for a stored decision, now that it holds the lock, finds A’s, and returns it. No second hold.' },
  ],
  caption: 'Check, then lock, then check again: the second check is the one that counts.',
});

export default {
  minutes: 10,
  lede: 'This lesson is optional depth. Most defects show up with one request at a time, but some only appear when two requests touch the same thing at the same moment. Those are races, and they are among the hardest defects to find. CardVault guards against them in a few specific ways, and knowing where helps you aim concurrent tests.',
  youWill: 'You will learn the four locking techniques CardVault uses, which race each one prevents, and how to test for races.',
  body: `
<h2>What a race looks like</h2>
<p>Imagine two identical authorizations for 4417 arriving at the same instant, perhaps a network retry overlapping the original. Each one reads the card, sees no decision for this <code>trace_id</code>, and creates a hold. The customer is charged twice. Neither request did anything wrong on its own; the defect is in how they overlapped. That is a <strong>race condition</strong>.</p>
<p>The usual cure is a <strong>lock</strong>: a way for one request to say “wait until I am finished” to the others that want the same thing.</p>
${race}

<h2>Four techniques in CardVault</h2>
${table(['Technique', 'Where', 'Prevents'], [
  ['Row lock, `SELECT … FOR UPDATE`', 'Card row during authorization, clearing and lifecycle changes; enrolment rows during callbacks; transaction row when disputing', 'Two changes to the same row interleaving'],
  ['`FOR UPDATE SKIP LOCKED`', 'Outbox relays', 'Two relays sending the same row; a busy row is skipped, not waited for'],
  ['Advisory lock per customer', 'Wallet opt-out, opt-in, add and remove', 'An opt-out and an add for the same customer interleaving'],
  ['Unique index', 'Idempotency keys; one open dispute per transaction; one enrolment per card', 'Two inserts of something that must exist once'],
])}
<p>An <strong>advisory lock</strong> is a lock on an idea rather than a row: Postgres lets code lock any number, here one derived from the customer’s ID. It is useful when the thing being protected spans several rows, such as “this customer’s wallet”. It is released automatically when the transaction ends.</p>
<p>A <strong>unique index</strong> is the last line of defence. Even if two requests both pass every check, the database refuses the second insert, and the code turns that refusal into a clean answer, such as <code>409 DISPUTE_ALREADY_OPEN</code>. For idempotency keys, a request that arrives while the first one with the same key is still running gets <code>409 IDEMPOTENCY_IN_PROGRESS</code>.</p>
${keyIdea(`<p>Checking before acting is not enough when two requests can act at once. Lock first, then check, or let a database constraint make the second attempt fail. The check inside the lock is the one that counts.</p>`)}

<h2>The limit of these locks</h2>
<p>Every one of these techniques relies on Postgres, so they work across any number of requests inside one service. They also assume one copy of each service; the migrations, for example, run when a container starts, which would race with several copies. CardVault documents this as a known limitation: one replica per service.</p>
${testerEye(`<p>To test a race, make the overlap happen on purpose. Send the same request many times at once (for example, 20 parallel requests with one <code>trace_id</code> or one idempotency key), then assert the invariant: exactly one hold, one dispute, one row, and <code>available</code> reduced exactly once. Repeat the burst several times, because a race that loses once in fifty tries is still a defect. A <code>latency</code> fault on the service widens the window and makes overlaps more likely.</p>`)}
${realWorld(`<p>Large systems often run many copies of each service and add distributed locks, optimistic concurrency on every row, or single-writer designs where all changes for one account go through one queue. CardVault’s per-card partitioning of events is a small version of that last idea.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Race condition', 'A defect that appears only when two operations overlap in time.'],
  ['Row lock', 'A database lock on specific rows, taken with `SELECT … FOR UPDATE`, held until the transaction ends.'],
  ['Advisory lock', 'A lock on an application-chosen number, here one per customer, to protect something larger than a row.'],
  ['Unique index', 'A database rule that refuses a second row with the same key.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'In the sequence above, why does Request B check for a stored decision again after getting the lock?',
  options: ['To save time', 'Because A may have created the decision while B waited; only a check made while holding the lock is reliable', 'Because the first check failed', 'It does not need to'],
  answer: 1,
  why: '<p>Anything read before the lock may be out of date by the time the lock is granted. The second check sees A’s committed work.</p>',
})}
${check({
  q: 'alice opts out and adds a card at the same instant, from two browser tabs. What stops the add from slipping in half-way through the opt-out?',
  options: ['Nothing', 'The per-customer advisory lock: one waits until the other’s transaction ends', 'The unique index on enrolments', 'SKIP LOCKED'],
  answer: 1,
  why: '<p>Wallet-wide actions for one customer take the same advisory lock, so they run one after the other.</p>',
})}

<h2>Recap</h2>
${recap([
  'A race is two operations overlapping in a way neither expects.',
  'CardVault uses row locks, SKIP LOCKED, per-customer advisory locks and unique indexes.',
  'Lock, then check; a unique index catches what slips through.',
  'All of it assumes one replica per service, a documented limitation.',
  'Test races with bursts of identical requests and assert the invariant.',
])}
`,
};
