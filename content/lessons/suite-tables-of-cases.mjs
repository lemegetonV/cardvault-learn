import { figure, keyIdea, testerEye, terms, check, recap, code, terminal } from '../../src/components.mjs';
import { paramRows } from '../diagrams/suite.mjs';

export default {
  minutes: 12,
  lede: 'Many business rules are really tables: for each starting state and action, one right answer. The card lifecycle is one, the authorization decision is another. Writing a separate test for every row would mean dozens of near-identical functions. This lesson shows how the suite writes the table once, as data, and lets pytest turn each row into its own test.',
  youWill: 'You will learn how `@pytest.mark.parametrize` works, how to give each case a readable name, why a table should include rows where two rules compete, and how a refusal is checked twice.',
  body: `
<h2>A rule that is a table</h2>
<p>When the card service decides an authorization, it checks a list of conditions in a fixed order, and the first one that fails decides the answer (the first track’s <a href="/learn/authorization/">Deciding an authorization</a> walks through it). Each condition is one row of expected behaviour: a lost card gives <code>CARD_LOST</code>, a closed card <code>CARD_CLOSED</code>, and so on. The suite writes that list as a Python list of tuples, one tuple per case:</p>
${code({ title: 'tests/api/tests/authorization/test_decision_table.py (part)', src: `
EXPIRED = "2020-01"  # long past on any clock

DECLINES = [
    # id,                   card template,                                   amount, code
    ("lost", card(status="LOST"), 1_000, "CARD_LOST"),
    ("closed", card(status="CLOSED"), 1_000, "CARD_CLOSED"),
    ("expired", card(expiry=EXPIRED), 1_000, "CARD_EXPIRED"),
    ("over-available", card(limit=50_000), 50_001, "INSUFFICIENT_FUNDS"),
    # Order: an earlier check wins when several conditions hold at once.
    ("lost-beats-expired", card(status="LOST", expiry=EXPIRED), 1_000, "CARD_LOST"),
    ("closed-beats-expired", card(status="CLOSED", expiry=EXPIRED), 1_000, "CARD_CLOSED"),
    ("expired-beats-funds", card(expiry=EXPIRED, limit=100), 1_000, "CARD_EXPIRED"),
]
` })}
<p>A <strong>tuple</strong>, written in round brackets, is a fixed group of values. Amounts are in cents, so <code>1_000</code> is 10.00; Python allows the underscore in numbers purely for readability. Each row names its case, describes the card with the template from <a href="/learn/suite-fresh-customers/">fresh customers</a>, gives the amount, and states the expected decline code.</p>

<h2>One function, many tests</h2>
${code({ title: 'tests/api/tests/authorization/test_decision_table.py (part)', src: `
@pytest.mark.parametrize(
    ("template", "amount", "code"), [row[1:] for row in DECLINES], ids=[r[0] for r in DECLINES]
)
def test_card_purchase_is_declined(make_customer, card_network, template, amount, code):
    someone = make_customer(customer(template))
    card_id = someone.card_ids[0]
    before = expect(someone.cards.get(card_id), 200, Card)

    decision = expect(card_network.purchase(card_id, amount), 200, Authorization)

    assert (decision.decision, decision.decline_code, decision.hold_id) == (
        "DECLINED",
        code,
        None,
    )
    assert expect(someone.cards.get(card_id), 200, Card).available == before.available
` })}
<p><code>@pytest.mark.parametrize</code> takes the names of the parameters, then a list of values for them. pytest runs the function once for each entry, passing that entry’s values in. Two Python expressions prepare the lists:</p>
<ul>
<li><code>row[1:]</code> is a <strong>slice</strong>: the row without its first item, so the id is dropped and the remaining three values match <code>template</code>, <code>amount</code> and <code>code</code>.</li>
<li><code>[r[0] for r in DECLINES]</code> is a <strong>list comprehension</strong>: a list built by taking the first item of every row. Those become the <code>ids</code>, the names pytest shows.</li>
</ul>
${figure({ svg: paramRows(), caption: 'Each row of the table becomes a separate test with its own name, its own fresh customer and its own pass or fail.' })}
${terminal([
  ['uv run pytest "tests/authorization/test_decision_table.py::test_card_purchase_is_declined[lost-beats-expired]"', '…\n1 passed'],
])}
<p>Because every row is its own test, one wrong row fails alone and names itself, and you can run a single row by its id. Readable ids matter here: <code>[lost-beats-expired]</code> tells you which rule broke before you open any file.</p>

<h2>Rows where rules compete</h2>
<p>The first four rows test one condition each. They would all pass even if the service checked the conditions in a different order, because each card breaks only one rule. The last three rows are what test the order: a card that is both lost and expired must say <code>CARD_LOST</code>, because the lost check comes first. When a rule says “the first failing check decides”, the table needs rows where two checks fail at once.</p>
${keyIdea(`<p>Write a rule that is a table as a table: one row per case, each with its expected answer from the spec. Then add the rows where two conditions hold together, because those are the ones that test the order.</p>`)}

<h2>A refusal is checked twice</h2>
<p>Look again at the last line of the test. After asserting the decline, it reads the card back and checks <code>available</code> did not change. A decline is a claim about two things: the answer, and that no money was held. The spec says a declined authorization changes nothing, so the test reads that back instead of trusting the response alone. The card lifecycle table does the same: a refused move must leave the card in its starting status.</p>
${testerEye(`<p>When a parametrized test fails for one row only, the row’s id is the first clue: compare it with the rows that passed. If every row fails, the cause is usually in the shared part, the set-up or the client, not in the rule.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['`parametrize`', 'A pytest marker that runs one test function once per set of values.'],
  ['Test id', 'The name in square brackets that pytest gives each parametrized case.'],
  ['Tuple', 'A fixed group of values in round brackets, such as one row of a table.'],
  ['Slice', 'Part of a list or tuple: `row[1:]` is everything after the first item.'],
  ['List comprehension', 'A list built from another in one expression: `[r[0] for r in rows]`.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A table has one row per decline condition, each card breaking exactly one rule. The service starts checking expiry before the lost status. Does any row fail?',
  options: ['Yes, the lost row', 'No. Each card breaks one rule, so the order makes no difference; only a row with both conditions would catch it', 'Yes, all of them', 'Yes, the expired row'],
  answer: 1,
  why: '<p>With only one failing condition per card, every order gives the same answer. A card that is lost and expired at once is the case whose answer depends on the order.</p>',
})}
${check({
  q: 'Why do the decline rows read the card back after the decision?',
  options: ['To refresh the token', 'Because a decline must also leave the available amount unchanged, and the response alone does not show that', 'To slow the test down', 'pytest requires two asserts'],
  answer: 1,
  why: '<p>The response says “declined”, but a bug could still hold the money. Reading <code>available</code> before and after checks the second half of the rule.</p>',
})}
${check({
  q: 'You add a row `("prepaid", card("PREPAID"), 1_000, "CARD_LOST")` by mistake. What happens?',
  options: ['pytest refuses to run the table', 'That one case, `[prepaid]`, fails, naming the code it got; the other rows still pass', 'Every row fails', 'The row is skipped'],
  answer: 1,
  why: '<p>Each row is an independent test. A prepaid card with enough money is approved, so the row fails on its own. Its expected value was wrong, which is a reminder that a table is only as good as the source of its answers.</p>',
})}

<h2>Recap</h2>
${recap([
  'A rule that is a table is written as a list of rows with expected answers.',
  '`@pytest.mark.parametrize` runs one function per row; `ids` give each case a name.',
  'Rows where two conditions hold together test which rule wins.',
  'A refusal is checked twice: the error, and that nothing changed.',
])}
`,
};
