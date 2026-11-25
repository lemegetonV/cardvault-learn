import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table, code } from '../../src/components.mjs';
import { eligibilityLadder } from '../diagrams/wallet.mjs';

export default {
  minutes: 9,
  lede: 'Not every card may go into the phone wallet. A closed card obviously may not, but neither may a prepaid card, a card nobody has used for months, or a card whose owner has not verified their phone. Eligibility is the set of rules that decides, and it is one of the clearest pieces of logic in CardVault to test.',
  youWill: 'You will learn the eight eligibility rules, their order, and where the enrollment service gets the facts it checks.',
  body: `
<h2>Eight rules, first failure wins</h2>
<p>The enrollment service decides eligibility with one function, <code>evaluate</code>, in <code>app/services/enrollment/eligibility.py</code>. It checks eight rules in a fixed order and stops at the first one that fails. That rule’s name becomes the <strong>reason</strong> the customer sees.</p>
${figure({ svg: eligibilityLadder() })}
<p>The first four rules are facts about the card. The last four are about the customer: what they chose and whether their <a href="/learn/contact-details/">contact details</a> are verified.</p>
${table(['Rule', 'Detail worth knowing'], [
  ['Expiry', 'A card expires at 00:00 UTC on the first day of the month <em>after</em> its expiry month, so `2029-06` is valid until the end of 30 June 2029.'],
  ['Product', 'PREPAID cards are never eligible.'],
  ['Recent use', 'The card must have been used within the last 90 days. A card that was never used fails.'],
  ['Removed by customer', 'If the customer removed this card from the wallet, it is not re-added automatically.'],
])}
<p>Every time comparison uses the <a href="/learn/the-shared-clock/">shared clock</a>. Moving the clock 91 days forward makes a card used yesterday ineligible, without any data changing.</p>
${keyIdea(`<p>Only one reason is reported, the first failing rule. A card that is both PREPAID and unused reports <code>PRODUCT_NOT_SUPPORTED</code>, because rule 3 comes before rule 4. When you fix the first problem, the next one may appear.</p>`)}

<h2>Where the facts come from</h2>
<p>The card’s status, product, expiry and last use belong to the card service. The contact flags belong to the profile service. The enrollment service cannot read their databases, so it keeps its own copies, called <a href="/learn/each-service-owns-its-data/">projections</a>, updated from <code>card.lifecycle</code> and <code>contact.updated</code> events. Opt-out and per-card removal are its own data.</p>
<p>This has a consequence: the enrollment service judges eligibility on its <em>copy</em>. Right after a card is used for the first time, the copy may be a moment behind, until the <code>CARD_USED</code> event arrives.</p>

<h2>The seed customers</h2>
<p>The seed data has been chosen so that most rules can be seen without any setup.</p>
${table(['Card', 'Eligible?', 'Why'], [
  ['alice-credit (4417)', 'yes', 'Enrolled'],
  ['alice-debit (2045)', 'yes', 'Enrolled'],
  ['alice-credit-unused (7380)', 'no', '`NOT_RECENTLY_USED`: last used 120 days ago'],
  ['alice-prepaid (5521)', 'no', '`PRODUCT_NOT_SUPPORTED`'],
  ['bob-credit (1029)', 'yes', 'Enrolled'],
  ['bob-debit-lost (8836)', 'no', '`CARD_NOT_ACTIVE`: it is LOST, and its enrolment is suspended'],
  ['charlie-credit (6604)', 'no', '`CUSTOMER_OPTED_OUT`'],
  ['dana-credit (3172), dana-debit (9958)', 'no', '`PHONE_NOT_VERIFIED`'],
])}
<p><code>GET /v1/wallet</code> shows each of the customer’s cards with <code>eligible</code> and <code>ineligible_reason</code>, so you can read these straight from the API.</p>

<h2>When eligibility is checked</h2>
<p>The same function runs at four moments:</p>
<ul>
<li>when the customer adds a card (an ineligible card gets <code>422 CARD_INELIGIBLE</code> with <code>details.reason</code>);</li>
<li>when the customer opts in, for each of their cards;</li>
<li>when an event changes a card or a contact, for cards already in the wallet;</li>
<li>during the <strong>sweep</strong>, which checks every card at once.</li>
</ul>
<p>In a real bank the sweep would run every night. In CardVault a test starts it with <code>POST /internal/v1/sweep</code> and the tests service key. It adds cards that have become eligible and removes those that no longer are, and its answer lists what it did to each card. A card that ended in FAILED is retried by the sweep at most once per day.</p>
${code({ lang: 'json', title: 'POST /internal/v1/sweep: the answer after moving the clock 91 days', src: `{
  "cards_checked": 9,
  "actions": [
    { "card_id": "ca4d0000-a11c-4000-8000-000000000001", "action": "REMOVE" },
    …
  ]
}` })}
${testerEye(`<p>Eligibility is a pure function with an ordered list of rules, which suits a table-driven test: one row per rule, each with a card that fails only that rule. Then add rows for the order (two failures at once, expect the earlier reason) and for the edges: used exactly 90 days ago (eligible) and 90 days and one second ago (not), and the first instant after the expiry month (expired).</p>`)}
${realWorld(`<p>Card networks and wallet providers set their own conditions too, such as which card ranges a wallet supports, and a bank adds risk checks of its own. CardVault keeps a small, readable set of rules so each one can be tested on its own.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Eligibility', 'Whether a card may be in the wallet now, decided by eight ordered rules.'],
  ['Ineligible reason', 'The name of the first rule that failed, such as `NOT_RECENTLY_USED`.'],
  ['Sweep', 'A check of every card at once that enrols newly eligible cards and removes ineligible ones. Started by tests in CardVault.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A PREPAID card has expired. Which reason does the wallet show?',
  options: ['`PRODUCT_NOT_SUPPORTED`', '`CARD_EXPIRED`, because expiry is checked before product', 'Both reasons', '`CARD_NOT_ACTIVE`'],
  answer: 1,
  why: '<p>Rule 2, expiry, comes before rule 3, product. The first failing rule wins.</p>',
})}
${check({
  q: 'A card has expiry `2026-11`. On the shared clock it is 30 November 2026, 23:59 UTC. Is it expired?',
  options: ['Yes, it is the expiry month', 'No, it expires at 00:00 UTC on 1 December 2026', 'Yes, cards expire on the 1st of their expiry month', 'Only on a DEBIT card'],
  answer: 1,
  why: '<p>A card is valid through its whole expiry month and expires at the first instant of the next month.</p>',
})}
${check({
  q: 'dana verifies her phone. Without anyone calling the sweep, are her cards now in the wallet?',
  options: ['Yes, verification enrols them', 'No: they are now eligible, but she must add them, opt in, or the sweep must run', 'Yes, after the contact.updated event', 'No, dana can never use the wallet'],
  answer: 1,
  why: '<p>Events only adjust cards that are already in the wallet. Becoming eligible does not enrol a card by itself; the customer or the sweep does.</p>',
})}

<h2>Recap</h2>
${recap([
  'Eight rules, checked in order; the first failure is the reason.',
  'Four rules are about the card, four about the customer.',
  'Facts come from the service’s own projections, updated by events.',
  'Times use the shared clock: 90 days of recent use, expiry at the start of the next month.',
  'The sweep, started by tests, enrols and removes cards in bulk.',
])}
`,
};
