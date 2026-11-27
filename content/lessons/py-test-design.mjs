import { code, interview, keyIdea, testerEye, table } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'A phone number field accepts millions of possible values, and you can test perhaps ten. Test design techniques are the reasoning that picks those ten, so each test checks something the others do not. Interviewers ask for them by name, and this lesson shows each one on CardVault.',
  youWill: 'You will be able to explain equivalence partitioning, boundary value analysis, decision tables and state transition testing, and apply each to a CardVault rule.',
  body: `
<h2>Why pick tests on purpose</h2>
<p>Testing every possible input is impossible, and testing random inputs wastes effort: ten valid phone numbers check the same thing ten times. The techniques below all do the same job. They split the inputs into groups the app should treat the same way, then pick the few values most likely to expose a mistake. Every expected result comes from the rule, which is why you always start by reading the rule.</p>

<h2>The rule we will use</h2>
<p>When a customer changes their phone number, CardVault accepts only the compact international form: a <code>+</code>, a first digit from 1 to 9, and up to 15 digits in total, with no spaces. <code>+447700900123</code> is accepted; <code>07700 900123</code> is refused with <code>422</code> and the error code <code>VALIDATION_ERROR</code>.</p>

<h2>Equivalence partitioning</h2>
<p><strong>Equivalence partitioning</strong> splits all possible inputs into groups, called partitions, where the app should behave the same for every member. Testing one value per partition is then enough, because a second value from the same group adds little.</p>
${table(['Partition', 'Example', 'Expected'], [
  ['A valid number', '`+447700900123`', 'Accepted'],
  ['No `+` at the start', '`447700900123`', 'Refused'],
  ['Starts with `+0`', '`+05550100101`', 'Refused'],
  ['Spaces inside', '`+44 7700 900123`', 'Refused'],
  ['Too many digits', '`+1234567890123456`', 'Refused'],
])}
<p>Notice that the invalid side has several partitions, one per way of being wrong. Each needs its own test, because each is a different check in the code, and any one of them could be missing.</p>

<h2>Boundary value analysis</h2>
<p>Mistakes cluster at the edges of a range: a developer writes <code>&lt;</code> where the rule means <code>&lt;=</code>. <strong>Boundary value analysis</strong> tests the values on each edge and just beyond it. The digit count runs from 2 to 15, so there are two edges and four values:</p>
${table(['Digits', 'Example', 'Expected', 'Why'], [
  ['1', '`+1`', 'Refused', 'One below the lowest'],
  ['2', '`+12`', 'Accepted', 'The lowest allowed'],
  ['15', '`+123456789012345`', 'Accepted', 'The highest allowed'],
  ['16', '`+1234567890123456`', 'Refused', 'One above the highest'],
])}
<p>The suite keeps all of these cases, partitions and boundaries together, in one data file, and runs them with one test. You met that test in <a href="/learn/py-test-data/">Test data</a>:</p>
${code({ title: 'tests/api/data/contact_details.json', lang: 'json', src: `
  {"case": "phone with 16 digits, one too many", "changes": {"phone": "+1234567890123456"}, "expected_status": 422},
  {"case": "phone with 15 digits, the most allowed", "changes": {"phone": "+123456789012345"}, "expected_status": 200},
  {"case": "phone with 2 digits, the fewest allowed", "changes": {"phone": "+12"}, "expected_status": 200},
  {"case": "phone with 1 digit, one too few", "changes": {"phone": "+1"}, "expected_status": 422}
` })}
<p>Money has boundaries too. A purchase of exactly the available amount must be approved and one cent more declined; <a href="/learn/py-negative-tests/">Positive and negative tests</a> writes those two tests.</p>

<h2>Decision tables</h2>
<p>Some rules combine several conditions. Whether a card may join the wallet depends on its product, its status, when it was last used, and whether the customer’s email and phone are verified. A <strong>decision table</strong> lists the combinations that matter and the outcome of each, so none is forgotten:</p>
${table(['Product', 'Status', 'Used in 90 days', 'Email verified', 'Phone verified', 'Outcome'], [
  ['Credit or debit', 'Active', 'Yes', 'Yes', 'Yes', 'Eligible'],
  ['Prepaid', 'Active', 'Yes', 'Yes', 'Yes', '`PRODUCT_NOT_SUPPORTED`'],
  ['Credit', 'Lost', 'Yes', 'Yes', 'Yes', '`CARD_NOT_ACTIVE`'],
  ['Credit', 'Active', 'No', 'Yes', 'Yes', '`NOT_RECENTLY_USED`'],
  ['Credit', 'Active', 'Yes', 'No', 'Yes', '`EMAIL_NOT_VERIFIED`'],
  ['Credit', 'Active', 'Yes', 'Yes', 'No', '`PHONE_NOT_VERIFIED`'],
])}
<p>The full rule has three more conditions (the card has not expired, the customer has not opted out of the wallet, and has not removed this card), left out here to keep the table short. Even five yes-or-no conditions make 32 combinations. You do not need all 32. Each row above changes one condition from the eligible row, so each proves that one condition is checked. When the rule says which reason wins if several fail, a few rows with two failures check that order too. Each row becomes one case in <a href="/learn/py-parametrize/">Many cases with parametrize</a>.</p>

<h2>State transition testing</h2>
<p>A card moves between statuses: active, lost, closed. What you may do depends on where it is now. <strong>State transition testing</strong> draws the statuses and the allowed moves between them, then tests each allowed move and a few forbidden ones: reporting an active card lost works, while reporting a closed card lost is refused with <code>409</code>. The state tests in <a href="/learn/py-negative-tests/">Positive and negative tests</a> come from this kind of picture.</p>

<h2>Two more you will hear</h2>
${table(['Technique', 'Idea', 'When it helps'], [
  ['Pairwise testing', 'Instead of every combination, cover every pair of values at least once', 'Many settings with many values each, such as browser, language and currency'],
  ['Error guessing', 'Use experience to try what often breaks: empty values, very long text, special characters, a repeated request', 'After the systematic techniques, as a final sweep'],
])}

${keyIdea('<p>Split the inputs into groups the rule treats alike and test one of each (partitions), test both sides of every edge (boundaries), list the combinations of conditions (decision tables), and test the allowed and forbidden moves between statuses (state transitions).</p>')}

${testerEye('<p>Each technique gives you a reason for every test. When a reviewer asks why a test exists, “it is the upper boundary of the digit count” is a better answer than “it seemed like a good idea”.</p>')}

${interview({
  say: `<p>“I choose cases with the standard techniques. For a phone field I split the inputs into equivalence partitions, one valid and one per way of being invalid, and test the boundaries of the length: 1, 2, 15 and 16 digits. For rules with several conditions, like wallet eligibility, I use a decision table where each row flips one condition. For anything with statuses, like a card, I test the allowed and forbidden transitions. In the suite those cases are data rows, run by one parametrized test.”</p>`,
  qa: [
    ['What is the difference between equivalence partitioning and boundary value analysis?', '<p>Partitioning groups inputs the app should treat alike and tests one value per group. Boundary analysis then tests the edges of each range, and just beyond them, because off-by-one mistakes happen there. They are used together.</p>'],
    ['A field accepts ages from 18 to 65. Which values do you test?', '<p>Boundaries 17, 18, 65 and 66, one typical valid value such as 30, and invalid partitions such as empty, negative, a decimal and text.</p>'],
    ['When would you use a decision table?', '<p>When the outcome depends on a combination of conditions. The table makes every important combination visible, so missing cases are easy to spot, and each row becomes a test case.</p>'],
  ],
})}
`,
};
