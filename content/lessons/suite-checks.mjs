import { keyIdea, testerEye, terms, check, recap, code, table } from '../../src/components.mjs';

export default {
  minutes: 12,
  lede: 'Once a test has a response, it has to decide whether the response is right. That means two separate questions: does the answer have the right shape, and does it say the right thing? This lesson shows the small helpers that answer the first question in one line, so the test body can concentrate on the second.',
  youWill: 'You will learn what a pydantic model checks, what `expect` and `expect_error` do, and how to tell a good expected value from one copied out of the system.',
  body: `
<h2>Shape first: models</h2>
<p>A response body arrives as text in JSON. Before a test can ask “is this card LOST?”, it should know the body is a card at all: that it has a <code>status</code>, that the status is one of the three the spec allows, that <code>last4</code> is four digits. Checking each of those by hand in every test would bury the real question.</p>
<p><strong>pydantic</strong> does it in one step. A <strong>model</strong> is a Python class that lists fields and their types; pydantic checks a JSON body against it and returns an object with those fields, or explains exactly which field is wrong:</p>
${code({ title: 'tests/api/src/cardvault_tests/models/cards.py (part)', src: `
Product = Literal["CREDIT", "DEBIT", "PREPAID"]
CardStatus = Literal["ACTIVE", "LOST", "CLOSED"]


class Card(ApiModel):
    card_id: uuid.UUID
    product: Product
    last4: str = Field(pattern=r"^\\d{4}$")
    expiry: str = Field(pattern=r"^\\d{4}-\\d{2}$")
    status: CardStatus
    limit: int
    available: int
    currency: Literal["USD"]
    last_used_at: datetime | None
    created_at: datetime
` })}
<p><code>Literal[...]</code> allows only the listed values. <code>Field(pattern=...)</code> adds a regular expression the text must match. <code>datetime | None</code> means a time, or <code>null</code>. All the suite’s models extend <code>ApiModel</code>, which allows extra fields: a new field in a response is not a breaking change for a client, so it should not fail a test.</p>

<h2>One line per response: expect</h2>
${code({ title: 'tests/api/src/cardvault_tests/checks.py (part)', src: `
def expect(resp: httpx.Response, status: int, model: type[M]) -> M:
    """Assert the status, then parse the body into \`\`model\`\` (which checks its shape)."""
    assert resp.status_code == status, f"expected {status}, got {describe(resp)}"
    try:
        return model.model_validate(resp.json())
    except ValidationError as exc:
        raise AssertionError(
            f"body does not match {model.__name__}: {exc}\\n{describe(resp)}"
        ) from None
` })}
<p><code>expect</code> is suite code, not part of pytest or httpx. It asserts the status code, validates the body against the model, and hands back the parsed object. When either check fails, the message includes the method, URL, status and the start of the body (that is what <code>describe</code> builds), so the reason is on screen without re-running anything.</p>
<p>Errors get their own helper, because every CardVault service answers errors in one shape: <code>error_code</code>, <code>message</code>, <code>correlation_id</code> and sometimes <code>details</code>. <code>expect_error(resp, 409, "INVALID_STATE_TRANSITION")</code> checks the status, the shape, the code, and one more thing: that the <code>correlation_id</code> in the error is the one the request carried. A support engineer relies on that ID to find the failure in the logs, so it is part of the contract.</p>
${table(['Helper', 'Checks', 'Returns'], [
  ['`expect(resp, 200, Card)`', 'Status, then the body’s shape', 'A `Card` object'],
  ['`expect_error(resp, 404, "CARD_NOT_FOUND")`', 'Status, error shape, `error_code`, correlation ID', 'The `ErrorBody`'],
  ['`expect_status(resp, 202)`', 'Status only', 'The response, for bodies with no model'],
])}

<h2>Then meaning: the expected value</h2>
<p>With the shape settled, the test body asserts on business values only. Here is a test that reads the seed customer alice’s cards:</p>
${code({ title: 'tests/api/tests/cards/test_reading_cards.py (part)', src: `
@pytest.mark.smoke
def test_alice_sees_exactly_her_four_seed_cards(alice):
    page = expect(alice.cards.list(), 200, CardPage)

    seen = {(c.card_id, c.product, c.status, c.last4) for c in page.items}
    expected = {(c.card_id, c.product, c.status, c.last4) for c in ALICE.cards}
    assert seen == expected
    assert page.next_cursor is None
` })}
<p>The expected value, <code>ALICE.cards</code>, is written in the suite’s <code>data.py</code> from CardVault’s published seed data: four cards with fixed IDs, products, statuses and last four digits. The test compares <em>sets</em> (the <code>{ … for c in … }</code> syntax builds one), because the claim is “exactly these four cards”, and the order is a different claim tested elsewhere.</p>
<p>Notice what the test does not do. It does not call the API once, copy the answer into the test, and compare against that next time. That kind of expectation agrees with whatever the system does, including its bugs.</p>
${keyIdea(`<p>Every assertion should be traceable to a source you could show someone: a line in the spec, a value the test itself created, or the published seed data. If the only answer to “why this value?” is “that is what it returned”, the test proves nothing.</p>`)}

<h2>What a check proves, and what it leaves out</h2>
<p>A <code>200</code> with a valid <code>Card</code> proves the request was accepted and the answer is well formed. It does not prove the business result. “Report lost returned 200” is not “the card is lost”; the lifecycle tests therefore read the card back afterwards and check its status. Likewise, a refused request is checked twice: the error, and that the card is unchanged.</p>
${testerEye(`<p>Ask of every test: if CardVault had a bug here, which line would fail? If no line would, the test is checking the wrong thing, however green it is.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Model', 'A pydantic class listing a response’s fields and types; validating a body against it checks the shape.'],
  ['`expect`', 'Suite helper: assert the status, validate the body, return the parsed object.'],
  ['`expect_error`', 'Suite helper: assert an error’s status, `error_code` and correlation ID.'],
  ['Expected value', 'The right answer, traced to the spec, the test’s own setup or the seed data.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A response has `"status": "FROZEN"`. The test calls `expect(resp, 200, Card)`. What happens?',
  options: ['It passes; the test checks status later', 'It fails, naming the `status` field, because `FROZEN` is not an allowed value', 'pydantic changes it to `ACTIVE`', 'It fails with a connection error'],
  answer: 1,
  why: '<p><code>status</code> is a <code>Literal</code> of three values. Anything else fails validation, and <code>expect</code> turns that into an assertion error that names the field and shows the response.</p>',
})}
${check({
  q: 'A test reports a card lost and asserts only `expect(resp, 200, Card)`. What could still be wrong without the test noticing?',
  options: ['Nothing; a 200 means it worked', 'The returned card could still say ACTIVE, or a later read could', 'The URL', 'The correlation ID'],
  answer: 1,
  why: '<p>The test checked that the answer was accepted and well formed, not that it said LOST, and not that the change was stored. A complete test asserts the status in the response and reads the card back.</p>',
})}
${check({
  q: 'Which expected value is sound for “alice’s card count”?',
  options: ['Whatever the API returned on the first run', '4, from the published seed data the run loads at the start', 'The number of rows in the cards table', 'Any number greater than zero'],
  answer: 1,
  why: '<p>The run resets and loads the seed, which gives alice exactly four cards. That is a source independent of the code under test. The first-run answer copies the system; the table count is a database detail; “greater than zero” would pass with the wrong number.</p>',
})}

<h2>Recap</h2>
${recap([
  'Models check a response’s shape; `expect` does status plus shape in one line.',
  '`expect_error` checks CardVault’s error shape, code and correlation ID.',
  'Business assertions compare with values from the spec, the setup or the seed.',
  'A success response is not the business result: read the state back.',
])}
`,
};
