import { figure, keyIdea, testerEye, realWorld, terms, check, recap, code, table } from '../../src/components.mjs';
import { moneySteps } from '../diagrams/suite.mjs';

export default {
  minutes: 13,
  lede: 'After a purchase is approved, its money moves in several steps: held, perhaps partly released, charged, perhaps partly refunded. A test of that money is only as good as its expected numbers. This lesson shows how the suite works every amount out by hand from a known starting point, and the small amounts it uses to catch arithmetic done the wrong way.',
  youWill: 'You will learn how to derive each expected balance from the test’s own set-up, how a fixture can hand a test a ready-made purchase, why the suite tests with awkward cent amounts, and how an error’s details are checked.',
  body: `
<h2>Start from a number you chose</h2>
<p>The first track’s <a href="/learn/holds-and-clearing/">Holds and clearing</a> lesson explained the four steps: an approval <strong>holds</strong> the amount, a <strong>reverse</strong> releases some or all of the hold, a <strong>settle</strong> turns the hold into a charge, and a <strong>refund</strong> gives charged money back. A test that checks these needs to know the card’s available amount at every step.</p>
<p>It could read the balance first and compare differences, but then a wrong starting balance would go unnoticed. The suite does something stricter: every money test starts from a fresh card with a limit it chose, <code>LIMIT = 100_000</code> (1,000.00 in cents), and nothing else on it. From there, every expected value can be worked out by hand.</p>
${figure({ svg: moneySteps(), caption: 'One purchase of 10.00, worked out by hand. The available amount is always the limit minus what is held and what is charged.' })}
<p>The test file’s docstring carries the same worked example, so a reader can check any assertion against it with pencil and paper.</p>

<h2>A purchase, ready-made</h2>
<p>Almost every test in the file needs the same start: a fresh card with one approved purchase. Rather than repeat those lines, the file defines a local factory fixture:</p>
${code({ title: 'tests/api/tests/clearing/test_hold_maths.py (part)', src: `
@pytest.fixture
def approved(make_customer, card_network):
    """Return a function that makes a fresh card with one approved 10.00 purchase."""

    def make(product: str = "CREDIT", amount: int = 1_000):
        someone = make_customer(customer(card(product, limit=LIMIT)))
        card_id = someone.card_ids[0]
        auth = expect(card_network.purchase(card_id, amount), 200, Authorization)
        assert auth.decision == "APPROVED"
        return someone, card_id, auth.trace_id

    return make
` })}
<p>The fixture is defined in the test file itself, because only this file needs it; fixtures that many files share go in <code>conftest.py</code>. Note the <code>assert</code> inside the set-up. If the purchase were not approved, every test using it would fail in a confusing way later; failing here says plainly that the set-up, not the step under test, went wrong. <code>card_network</code> plays the card network, sending the authorization and clearing messages a real network would.</p>
<p>The function returns three values at once as a tuple, and the test unpacks them into three names:</p>
${code({ title: 'tests/api/tests/clearing/test_hold_maths.py (part)', src: `
def test_partial_reverse_releases_that_part_of_the_hold(approved, card_network):
    someone, card_id, trace_id = approved()

    result = expect(card_network.reverse(trace_id, 300), 200, Clearing)

    assert (result.hold_status, result.hold_amount, result.reversed_amount) == ("ACTIVE", 700, 300)
    assert available(someone, card_id) == LIMIT - 700
` })}
<p>The expected values are arithmetic on the set-up: 10.00 held, 3.00 reversed, so 7.00 still held and <code>LIMIT - 700</code> available. Writing <code>LIMIT - 700</code> instead of <code>99_300</code> keeps the reasoning visible in the assertion.</p>

<h2>Rules that differ by product</h2>
<p>Settling for more than was held is allowed on a credit card (a tip, a fuel top-up) but refused on debit and prepaid. The suite tests each case by product, including the refusal:</p>
${code({ title: 'tests/api/tests/clearing/test_hold_maths.py (part)', src: `
@pytest.mark.parametrize("product", ["DEBIT", "PREPAID"])
def test_only_credit_may_settle_above_the_hold(approved, card_network, product):
    someone, card_id, trace_id = approved(product)

    error = expect_error(card_network.settle(trace_id, 1_001), 422, "OVER_SETTLE_NOT_ALLOWED")

    assert error.details == {"hold_amount": 1_000, "amount": 1_001}
    assert available(someone, card_id) == LIMIT - 1_000
` })}
<p>Many CardVault errors carry a <code>details</code> object explaining the refusal. Comparing it with the whole expected dictionary checks that the service explains the right numbers, not just that it said no. The last line, as in <a href="/learn/suite-tables-of-cases/">Tables of cases</a>, checks the refusal changed nothing.</p>

<h2>Amounts chosen to catch floats</h2>
<p>CardVault keeps money as whole cents. A common bug is a step that converts to dollars as a <strong>floating-point number</strong> (a <code>float</code>, the computer’s approximate decimal) and back. Floats cannot store most decimal fractions exactly, so in Python <code>0.57 - 0.01</code> gives <code>0.5599999999999999</code>, and turning that back into cents can lose one.</p>
<p>A test with round amounts like 10.00 would never notice. So the suite has a table of amounts chosen because their float forms are inexact:</p>
${table(['Held', 'Reversed', 'Left (expected)', 'In float dollars'], [
  ['0.03', '0.01', '0.02', '`0.019999999999999997`'],
  ['0.57', '0.01', '0.56', '`0.5599999999999999`'],
  ['1.15', '0.15', '1.00', '`0.9999999999999999`'],
  ['19.99', '9.99', '10.00', '`9.999999999999998`'],
])}
<p>The test asserts the exact cents left (<code>result.hold_amount == left</code>). If any step on the way used float dollars and cut off the fraction, one of these rows would be a cent short.</p>
${keyIdea(`<p>Start money tests from an amount you chose, so every expected balance is arithmetic you can show. Then pick amounts that break the likely mistakes, such as cents that floats cannot hold exactly.</p>`)}
${testerEye(`<p>For any money rule, test the edges and the remainders: exactly the held amount, one cent more, the rest after a partial step, and a credit balance that goes below zero. Those are where rounding and off-by-one mistakes live.</p>`)}
${realWorld(`<p>Real card systems also deal in several currencies with different numbers of decimal places, and in foreign-exchange conversions where rounding is a business rule of its own. CardVault keeps to one currency, USD, so its tests can concentrate on the hold, charge and refund arithmetic.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Worked expectation', 'An expected value derived by arithmetic from the test’s own set-up, such as `LIMIT - 700`.'],
  ['Unpacking', 'Assigning the items of a tuple to several names at once: `a, b, c = make()`.'],
  ['Floating-point number', 'A computer’s approximate representation of a decimal; most money fractions cannot be stored exactly.'],
  ['Error details', 'The `details` object in a CardVault error, giving the values behind the refusal.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A fresh credit card has a limit of 1,000.00. A 10.00 purchase is approved, 3.00 reversed, then 7.00 settled. What is `available`?',
  options: ['1,000.00', '993.00', '990.00', '997.00'],
  answer: 1,
  why: '<p>After the reverse, 7.00 is held. Settling 7.00 turns that hold into a charge of the same size, so available stays at the limit minus 7.00.</p>',
})}
${check({
  q: 'A test asserts that a 0.57 hold minus a 0.01 reverse leaves 56 cents. The service converts to float dollars and truncates to cents. What does the test see?',
  options: ['56', '55, because 0.5599999999999999 dollars truncates to 55 cents', '57', 'An error'],
  answer: 1,
  why: '<p>0.57 − 0.01 in floats is just below 0.56. Truncating to whole cents gives 55, one short, and the assertion fails. Round amounts like 10.00 would hide this.</p>',
})}
${check({
  q: 'Why does the `approved` fixture assert that the purchase was approved?',
  options: ['To test approvals', 'So a broken set-up fails clearly at the set-up, instead of causing a confusing failure in the step being tested', 'Fixtures must contain an assert', 'To slow the test'],
  answer: 1,
  why: '<p>If the purchase were declined, a later reverse or settle would fail with an error that looks like a clearing bug. Checking the precondition places the failure where the cause is.</p>',
})}

<h2>Recap</h2>
${recap([
  'Money tests start from a fresh card with a limit the test chose.',
  'Expected balances are arithmetic on that limit, written as `LIMIT - 700`.',
  'A local factory fixture gives each test a ready-made approved purchase, and checks it.',
  'Awkward cent amounts catch arithmetic done in float dollars.',
])}
`,
};
