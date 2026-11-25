import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, code } from '../../src/components.mjs';
import { cursorPages } from '../diagrams/history.mjs';

export default {
  minutes: 10,
  lede: 'Listing transactions sounds like the easiest feature in the system. Yet it hides some of the most common defects in real software: a purchase that appears on two pages or on none, a date filter that silently drops the last day, money that turns into 0.30000000000000004, and a spreadsheet that runs a merchant’s name as a formula.',
  youWill: 'You will learn how the history is filtered and paged, and what the CSV export does to amounts, times and dangerous text.',
  body: `
<h2>Filtering</h2>
<p><code>GET /v1/wallet/transactions</code> returns the customer’s wallet transactions, newest first. Every filter is optional, and filters combine.</p>
${table(['Parameter', 'Example', 'Meaning'], [
  ['`card_id`', '`?card_id=…&card_id=…`', 'Only these cards. Repeat it for several'],
  ['`status`', '`?status=SETTLED&status=REFUNDED`', 'Only these statuses. Repeat it for several'],
  ['`from`', '`2026-11-01` or `2026-11-01T09:00:00Z`', 'On or after this moment'],
  ['`to`', '`2026-11-30`', 'On or before this moment'],
])}
<p>Both bounds are <strong>inclusive</strong>. A date on its own means a whole UTC day, so <code>to=2026-11-30</code> includes everything up to 23:59:59.999999 on 30 November. A datetime must have a time zone, such as <code>Z</code> or <code>+05:30</code>; one without is refused with <code>422</code>, because the service cannot guess which time zone was meant. A <code>from</code> later than <code>to</code> is also a <code>422</code>.</p>
${keyIdea(`<p>“Inclusive” is a promise about both ends. The classic defect is an upper bound that stops at the <em>start</em> of the last day, so every purchase on that day disappears. Always test a purchase at the very first and very last instant of a range.</p>`)}

<h2>Paging with a cursor</h2>
<p>alice has 55 transactions, so the list comes in pages: 20 by default, 1 to 100 with <code>limit</code>. Each page ends with a <code>next_cursor</code>; passing it back as <code>cursor</code> gives the next page. It is <code>null</code> on the last page.</p>
${figure({ svg: cursorPages() })}
<p>The cursor is an opaque string, but inside it is the last item’s time and <code>txn_id</code>. The next page starts strictly after that pair. Why not simply ask for “page 2”, items 21 to 40? Because new purchases keep arriving at the top. With page numbers, a purchase that arrives while alice is reading pushes everything down one place, and she sees one item twice. A cursor is anchored to an item, not a position, so new arrivals cannot shift it.</p>
<p>The <code>txn_id</code> is the tie-breaker. Two purchases at exactly the same time still have a fixed order, so neither is skipped or repeated at a page boundary. A cursor that cannot be read returns <code>400 INVALID_CURSOR</code>.</p>

<h2>Only your own</h2>
<p>Every query is limited to the customer in the token. Asking for another customer’s transaction by its ID, <code>GET /v1/wallet/transactions/{txn_id}</code>, returns <code>404 TRANSACTION_NOT_FOUND</code>, exactly as if it did not exist. A 403 would confirm that the ID is real, which tells an attacker something.</p>

<h2>The CSV export</h2>
<p><code>GET /v1/wallet/transactions/export</code> takes the same filters and returns a CSV file, newest first, with no paging and at most 10,000 rows. Three details make it trustworthy:</p>
${table(['Detail', 'What the export does', 'Why'], [
  ['Money', 'Dollars with two decimals, worked out from whole cents with integer arithmetic: `1050` becomes `10.50`', 'Floating-point numbers cannot store most cents exactly'],
  ['Times', 'UTC, ISO 8601 with `Z`: `2026-11-25T09:20:11Z`', 'No guessing which time zone a time is in'],
  ['Dangerous text', 'A cell starting with `=`, `+`, `-`, `@`, tab or carriage return gets a leading `\'`', 'Spreadsheets run such cells as formulas'],
])}
${code({ lang: 'text', title: 'The header and one seed row of alice’s export (IDs and times shortened)', src: `txn_id,occurred_at_utc,card_id,merchant_name,mcc,status,decline_code,amount,cleared_amount,reversed_amount,refunded_amount,currency,settled_at_utc
…,…Z,…,"'=HYPERLINK(""http://example.com"",""Formula Cafe"")",5814,SETTLED,,6.75,6.75,0.00,0.00,USD,…Z` })}
<p>That merchant name is part of alice’s seed data. The cell is wrapped in double quotes, with its inner quotes doubled, because it contains commas; that is standard CSV. Without the leading quote, opening the file in a spreadsheet would turn the merchant name into a working link; with other formulas it could do worse. This attack is called <strong>CSV injection</strong>. The file is named after the filter, for example <code>wallet-transactions-2026-11-01-2026-11-30.csv</code>, with <code>all</code> for a bound that was left out.</p>
${testerEye(`<p>One of alice’s seed purchases exists to check money arithmetic: 30 cents authorized, 10 reversed, 20 settled. The export must show <code>0.30</code>, <code>0.20</code> and <code>0.10</code>, and a test that adds the parts must get exactly 0.30, never <code>0.30000000000000004</code>. Walk every page with the cursor and assert you collected all 55 of alice’s transactions, each exactly once. Compare the export with the list for the same filter: same transactions, same order. And for every filter, try the boundaries, an empty result, and a value that should be refused.</p>`)}
${realWorld(`<p>Real statements are often generated as PDFs and stored, because a statement is a legal record that must not change later. A live export like CardVault’s is closer to the download button in a banking app, built on demand from current data.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Inclusive bound', 'A range limit that includes the value itself, at both ends.'],
  ['Cursor pagination', 'Paging by “after this item” instead of by page number, so new items do not shift pages.'],
  ['Tie-breaker', 'A second sort key, here `txn_id`, that makes the order unique.'],
  ['CSV injection', 'Text in an exported file that a spreadsheet runs as a formula.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A purchase happened at 2026-11-30T23:59:30Z. Is it in the result of `?from=2026-11-01&to=2026-11-30`?',
  options: ['No, `to` means the start of 30 November', 'Yes: a date as `to` covers the whole UTC day', 'Only in the export', 'Only if `to` has a time'],
  answer: 1,
  why: '<p>Both bounds are inclusive, and a bare date covers the full UTC day up to its last microsecond.</p>',
})}
${check({
  q: 'alice reads page 1 of her history. Before she asks for page 2, a new purchase arrives. What does page 2 show?',
  options: ['The last item of page 1 again', 'Exactly the items after the last one she saw; the new purchase only appears on page 1', 'The new purchase first', 'An error, the cursor is out of date'],
  answer: 1,
  why: '<p>The cursor points at a specific item, not a position. Items added at the top do not shift what comes after it.</p>',
})}
${check({
  q: 'A merchant name is `@SUM(1+1)`. How does it appear in the CSV export?',
  options: ['`@SUM(1+1)`', '`\'@SUM(1+1)`, with a leading quote so spreadsheets treat it as text', 'It is removed', '`2`'],
  answer: 1,
  why: '<p>Cells starting with <code>=</code>, <code>+</code>, <code>-</code>, <code>@</code>, tab or carriage return get a leading quote. The stored name is unchanged; only the export is made safe.</p>',
})}

<h2>Recap</h2>
${recap([
  'Filters: `card_id`, `status` (both repeatable), `from` and `to` (inclusive, dates or zoned datetimes).',
  'Pages use a cursor of time plus `txn_id`, so nothing is skipped or repeated.',
  'Another customer’s transaction is a 404, like a missing one.',
  'The export uses dollar strings from integer cents, UTC times, and neutralises formula-like cells.',
])}
`,
};
