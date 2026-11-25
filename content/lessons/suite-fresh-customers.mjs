import { figure, keyIdea, testerEye, realWorld, terms, check, recap, code, table } from '../../src/components.mjs';
import { sharedVsFresh, customerFanOut } from '../diagrams/suite.mjs';

export default {
  minutes: 11,
  lede: 'Most tests change something: they report a card lost, add it to the wallet, spend money. If two tests change the same customer, each one can spoil the other’s expected result. This lesson shows how the suite avoids that: every test that changes data creates its own customer first, with exactly the cards it needs.',
  youWill: 'You will learn why shared test data causes flaky tests, how `make_customer` and the `data.customer` template create a fresh customer in one call, and when the seed customers are still the right choice.',
  body: `
<h2>The problem with sharing</h2>
<p>The seed data gives every run two known customers, alice and bob. It is tempting to use them for everything. But picture two tests: one reports alice’s first card lost, the other expects that same card to be <code>ACTIVE</code>. Run them in one order and both pass. Run them in the other order, or at the same moment, and the second one fails, though nothing in CardVault is wrong.</p>
${figure({ svg: sharedVsFresh(), caption: 'On the left, test B’s result depends on whether test A has already run. On the right, the two tests cannot meet.' })}
<p>A test that passes or fails depending on what ran before it is called <strong>order-dependent</strong>, and it is one of the main sources of <strong>flaky tests</strong>: tests whose result changes without any change in the code. The cure is <strong>test isolation</strong>: each test owns the data it changes, so no other test can touch it.</p>

<h2>A fresh customer in one line</h2>
<p>Creating a customer through the normal APIs would take many calls across several services. CardVault offers a shortcut for tests: <code>POST /test/customers</code> on the enrollment service, one of the <a href="/learn/test-controls/">test controls</a>. It takes a template and builds the whole customer:</p>
${figure({ svg: customerFanOut(), caption: 'One call to the enrollment service creates the customer everywhere it needs to exist. Cards marked as enrolled also get a token and an operator record, as if they had joined the wallet earlier.' })}
<p>In the suite, a test asks for the <code>make_customer</code> fixture and calls it with a template:</p>
${code({ title: 'tests/api/tests/conftest.py (part)', src: `
@pytest.fixture
def make_customer(
    services: Services, orchestrator: EnrollmentControl
) -> Callable[[dict[str, Any]], Customer]:
    """Create a fresh customer from a template (see \`\`data.customer\`\`) and log in."""

    def make(template: dict[str, Any]) -> Customer:
        created = expect(orchestrator.create_customer(template), 201, NewCustomer)
        return log_in(services, created.username, created.password, created.cards)

    return make
` })}
<p>The fixture does not return a customer. It returns a function, <code>make</code>, that the test calls as often as it likes. This pattern is called a <strong>factory fixture</strong>, and it fits here because each test wants different cards. <code>make</code> creates the customer, logs in with the generated username and password, and hands back a <code>Customer</code> object holding the session and a client for each API, so the test can write <code>someone.cards.report_lost(...)</code>.</p>

<h2>Templates: saying only what matters</h2>
<p>The template is built with two small functions from the suite’s <code>data.py</code>. Each has defaults for an ordinary, healthy customer, so a test spells out only what makes its case special:</p>
${table(['Template', 'Gives'], [
  ['`customer(card())`', 'Verified email and phone, one active credit card used five days ago'],
  ['`customer(card(status="LOST"))`', 'The same, with the card already lost'],
  ['`customer(card("PREPAID"))`', 'A prepaid card, which the wallet does not accept'],
  ['`customer(card(), email_verified=False)`', 'A customer who has not verified their email'],
  ['`customer(card(enrolled=True))`', 'A card already in the wallet, with a token'],
])}
<p>Here is a whole test, from the card lifecycle file. The first line is the arrange step, and it reads almost like the case it tests: “a customer whose card starts in this status”.</p>
${code({ title: 'tests/api/tests/cards/test_card_lifecycle.py (part)', src: `
def test_card_transition(make_customer, start, action, http_status, result):
    someone = make_customer(customer(card(status=start)))
    card_id = someone.card_ids[0]

    resp = act(someone, action, card_id)
` })}
<p>The expected values in this kind of test come from the test itself: it chose the starting status, so it knows exactly what the card held before the action.</p>
${keyIdea(`<p>If a test changes data, it creates that data first. Then its expected values come from its own set-up, and no other test can change them.</p>`)}

<h2>When the seed customers are still right</h2>
<p>Fresh customers are not free: each one costs several calls. For tests that only read, the seed customers are the better choice, because their data is published and fixed. Reading alice’s four cards, or her 55 seed wallet transactions, is how the suite checks lists, paging and filters against known answers. The rule the suite keeps is simple: <strong>seed customers are read-only</strong>. A test that would change them makes its own customer instead.</p>
${testerEye(`<p>When a test fails only in a full run and passes alone, suspect shared data first. Look for two tests that touch the same customer, card or record, with at least one of them changing it.</p>`)}
${realWorld(`<p>Real banks rarely give testers a “create a customer” endpoint. Test teams there build fresh data through the normal sign-up APIs, or ask a data team for pools of accounts. The principle is the same: a test owns what it changes.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Flaky test', 'A test whose result changes from run to run without any change in the code.'],
  ['Order-dependent test', 'A test whose result depends on which tests ran before it.'],
  ['Test isolation', 'Each test owns the data it changes, so tests cannot affect each other.'],
  ['Factory fixture', 'A fixture that returns a function, so a test can create as many things as it needs.'],
  ['Template', 'The description of a fresh customer: their contact details and the cards they hold.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test closes one of alice’s seed cards. It passes. What is the risk?',
  options: ['None, since it passed', 'Any later test that reads alice’s cards as published now sees a closed card and fails', 'CardVault will refuse to close a seed card', 'The run will reset alice immediately'],
  answer: 1,
  why: '<p>The run reseeds once, at the start. A change to alice lasts until the next run, so every read-only test that expects the published seed data is now wrong. That is why seed customers are read-only.</p>',
})}
${check({
  q: 'A test needs a customer whose email is not verified and who holds one debit card. Which template fits?',
  options: ['`customer(card())`', '`customer(card("DEBIT"), email_verified=False)`', '`customer(email_verified=False)`', 'Use bob'],
  answer: 1,
  why: '<p><code>card("DEBIT")</code> gives the debit card and <code>email_verified=False</code> overrides the default. The third option has no card at all, and bob is a seed customer whose data must not change.</p>',
})}
${check({
  q: 'Why is `make_customer` a function-scoped fixture that returns a function, instead of a session fixture returning one customer?',
  options: ['Session fixtures cannot make HTTP calls', 'Each test needs its own customers, often with different cards, so it must be able to create them on demand', 'To make tests slower', 'pytest requires factories'],
  answer: 1,
  why: '<p>A single shared customer would bring back the sharing problem. A factory lets each test describe and create exactly the customers it needs, as many as it needs.</p>',
})}

<h2>Recap</h2>
${recap([
  'Tests that share data they change become order-dependent and flaky.',
  'A test that changes data creates its own customer with `make_customer(customer(card(...)))`.',
  '`POST /test/customers` builds the login, profile, cards and, if asked, the wallet enrolment in one call.',
  'Seed customers stay read-only and serve tests that check known lists and values.',
])}
`,
};
