import { figure, interview, table, testerEye } from '../../src/components.mjs';
import { pyramid } from '../diagrams/app.mjs';

export default {
  minutes: 9,
  lede: 'You know the app. The last step before writing any code is deciding what to test and where. This lesson builds a simple test plan for CardVault, the kind of thinking interviewers ask about with “How would you test this?”.',
  youWill: 'You will be able to explain a risk-based test plan for CardVault and say which tests belong at API level and which at UI level.',
  body: `
<h2>Start from risk</h2>
<p>You can never test everything, so testers start by asking two questions about each feature: <strong>what could go wrong</strong>, and <strong>how bad would it be</strong>. A wrong available balance costs money. A slightly misaligned button does not. That is <strong>risk-based testing</strong>: spend the most effort where a failure would hurt most.</p>
<p>For CardVault the biggest risks are clear: money (approvals, holds, settlement), security (one customer seeing another’s data), and the wallet rules (letting in a card that should be refused).</p>

<h2>Where each test belongs</h2>
${figure({ svg: pyramid(), caption: 'The test pyramid: developers’ unit tests at the base, many fast API tests above them, and fewer, slower UI tests at the top.' })}
<p>Tests can run at different levels. <strong>API tests</strong> call the services directly: they are fast, stable, and can try many cases. <strong>UI tests</strong> drive a real browser through the screens: they are slower and break more easily, but they are the only way to check what the customer actually sees. A healthy suite has many API tests and fewer UI tests, which is why the picture is a pyramid.</p>
<p>The services themselves also have <strong>unit tests</strong>, written by the developers, which test single functions without any network. As an SDET you mostly own the API and UI levels.</p>

<h2>A test plan for CardVault</h2>
${table(['Feature', 'Biggest risks', 'API tests', 'UI tests'], [
  ['Sign-in', 'Strangers get in; real customers get locked out', 'Correct and wrong passwords, lockout, missing or fake tokens', 'Sign in and out, error message, session warning'],
  ['Cards', 'Wrong balance; a lost card still works', 'Report lost, reissue, close, and which changes are not allowed', 'Buttons per card status, confirmation before closing'],
  ['Wallet', 'Ineligible cards get in; the status never updates', 'Each eligibility rule, add, remove, opt out, PENDING to ENROLLED', 'Add a card and see the badge change, reasons shown'],
  ['Purchases', 'Money held or charged wrongly', 'Approve, decline, exact boundaries, settlement, lost card declined', 'None: shoppers never see this screen'],
  ['Transactions', 'Missing or wrong history; disputes break', 'Purchase appears, filters, CSV export, dispute rules', 'Filters, detail page, dispute form and upload'],
  ['Profile', 'Unverified details still allowed', 'Change and verify, effect on the wallet', 'Verify with a code, validation messages'],
  ['Everywhere', 'One customer sees another’s data', 'Every endpoint with another customer’s ID', 'None needed'],
])}

<h2>Kinds of test to mix in</h2>
<ul>
<li><strong>Positive</strong>: the normal path works. A purchase within the limit is approved.</li>
<li><strong>Negative</strong>: bad input is refused cleanly. A dispute with an unknown reason returns <code>422</code>.</li>
<li><strong>Boundary</strong>: just inside and just outside a limit. Exactly the available amount, then one cent more.</li>
<li><strong>State</strong>: what is allowed depends on the current status. A closed card cannot be reported lost.</li>
<li><strong>Cross-service</strong>: an action in one service changes another. A lost card is paused in the wallet.</li>
<li><strong>Security</strong>: no token, a fake token, someone else’s data.</li>
</ul>

${testerEye('<p>Every row of the plan above becomes real tests in the next two tracks. The API track writes the API column in pytest, and the UI track writes the UI column in Playwright.</p>')}

${interview({
  say: `<p>“I start from risk. For a bank wallet that means money, security and the eligibility rules. Most of the testing goes at API level, because the business rules live in the services and API tests are fast and stable, so I cover positive, negative, boundary, state and cross-service cases there.</p>
<p>Then a smaller set of UI tests covers the key customer journeys and what only the screen shows, such as messages, badges and forms. Developers own the unit tests underneath. Everything runs in CI on every change.”</p>`,
  qa: [
    ['How would you test the add-to-wallet feature?', '<p>At API level: one test per eligibility rule plus a passing card, the 202 and PENDING answer, then wait for ENROLLED, plus remove and opt out. Cross-service: report the card lost and check it is paused. At UI level: add a card and see the badge go from PENDING to ENROLLED, and check that an ineligible card shows its reason and has no Add button.</p>'],
    ['Why not test everything through the UI?', '<p>UI tests are slow and fragile: a changed button label can break them even when the feature works. Testing every business rule that way would make the suite slow and unreliable. The API is where the rules are, so that is where most rule tests go.</p>'],
    ['How do you decide what to automate?', '<p>Automate what is run often, is stable, and is high risk: regression checks for money, security and core flows. Keep exploratory testing for new features and things that need human judgement, such as layout and wording.</p>'],
  ],
})}
`,
};
