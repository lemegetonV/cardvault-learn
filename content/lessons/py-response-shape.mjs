import { code, interview, keyIdea, testerEye, table } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'A test that checks the status code and two fields will still pass if a third field disappears or turns from a number into text. The app that reads that field breaks; the test does not notice. A JSON Schema check looks at the whole response at once.',
  youWill: 'You will be able to explain what a JSON Schema is, read the suite’s schemas, and say what a schema check proves and what it does not.',
  body: `
<h2>Shape versus values</h2>
${table(['Check', 'Catches', 'Misses'], [
  ['Values: `card["status"] == "ACTIVE"`', 'A wrong value in the fields you named', 'Any field you did not name'],
  ['Shape: a JSON Schema', 'A missing field, a wrong type, a value outside the allowed set', 'A right-shaped but wrong value, such as the wrong balance'],
])}
<p>The two work together. Shape checks protect every program that reads the response. Value checks prove the business result.</p>

<h2>What a schema looks like</h2>
<p>A <strong>JSON Schema</strong> is a description of a JSON document, written as JSON itself. In Python it is just a dictionary. This is the schema for one card:</p>
${code({ title: 'tests/api/data/schemas.py', src: `
CARD_SCHEMA = {
    "type": "object",
    "required": [
        "card_id",
        "product",
        "last4",
        "expiry",
        "status",
        "limit",
        "available",
        "currency",
    ],
    "properties": {
        "card_id": {"type": "string"},
        "product": {"enum": ["CREDIT", "DEBIT", "PREPAID"]},
        "last4": {"type": "string", "pattern": "^[0-9]{4}$"},
        "expiry": {"type": "string", "pattern": "^[0-9]{4}-[0-9]{2}$"},
        "status": {"enum": ["ACTIVE", "LOST", "CLOSED"]},
        "limit": {"type": "integer", "minimum": 0},
        "available": {"type": "integer"},
        "currency": {"type": "string"},
` })}
<ul>
<li><code>"type": "object"</code>: the card must be a JSON object, a dictionary.</li>
<li><code>"required"</code>: the fields that must be present.</li>
<li><code>"properties"</code>: a rule for each field. <code>"integer"</code> matters here because money is in whole cents; a decimal would be a bug.</li>
<li><code>"enum"</code>: the value must be one of these.</li>
<li><code>"pattern"</code>: the text must match a <strong>regular expression</strong>, a small pattern language. <code>^[0-9]{4}$</code> means exactly four digits from start (<code>^</code>) to end (<code>$</code>).</li>
</ul>
<p>The rules come from the API documentation, not from a sample response, for the same reason as every other expected value.</p>

<h2>The check</h2>
${code({ title: 'tests/api/tests/test_response_shape.py', src: `
def test_card_list_matches_its_schema(alice_token):
    response = CardsApi(alice_token).list_cards()

    assert response.status_code == 200
    # validate() does nothing when the response fits the schema, and fails the
    # test with the field and the reason when it does not.
    validate(instance=response.json(), schema=CARD_PAGE_SCHEMA)
` })}
<p><code>validate</code> comes from the <strong>jsonschema</strong> library. <code>CARD_PAGE_SCHEMA</code> describes the whole page: a list called <code>items</code> where every item must match <code>CARD_SCHEMA</code>, and a <code>next_cursor</code> that is text or null. One line checks every field of every card.</p>
<p>To prove the check can fail, a card with <code>last4</code> set to <code>"44177"</code> was given to it. It failed with <code>'44177' does not match '^[0-9]{4}$'</code>, naming the field and the rule.</p>

<h2>Every error has the same shape</h2>
<p>Programs that call CardVault rely on errors always looking alike. One test sends three different bad requests and checks each against the error schema:</p>
${code({ title: 'tests/api/tests/test_response_shape.py', src: `
def test_every_error_has_the_same_shape(alice_token):
    errors = [
        CardsApi(token="").list_cards(),  # 401: no token
        CardsApi(alice_token).get_card(UNKNOWN_CARD_ID),  # 404: no such card
        AuthApi().login("", "any-password"),  # 422: the request is invalid
    ]

    for response in errors:
        assert response.status_code >= 400
        validate(instance=response.json(), schema=ERROR_SCHEMA)
` })}

<h2>pydantic, in one paragraph</h2>
<p>Many larger Python suites use <strong>pydantic</strong> instead. You write a class with typed fields, such as <code>last4: str</code> and <code>limit: int</code>, and turn a response into an object of that class; a missing field or wrong type raises an error. It gives the same protection plus auto-complete in the editor, at the cost of a class per response. A schema dictionary is simpler to start with, and the two ideas are the same.</p>

${keyIdea('<p>A schema check proves the response has every field, with the right types and allowed values. It does not prove the values are correct, so keep value checks for the business result.</p>')}

${testerEye('<p>Schema checks catch the bugs that break other teams: a renamed field, a number sent as text, a new status nobody was told about. They are the first step towards <a href="/learn/py-mocks-contracts/">contract testing</a>.</p>')}

${interview({
  say: `<p>“Besides checking key values, I validate response structure with JSON Schema using the jsonschema library. The schemas follow the API documentation: required fields, types, enums for statuses, and patterns, for example four digits for last4. One test also checks that every error, whatever its status, has the same error_code, message and correlation_id shape. In bigger frameworks I would use pydantic models for the same job.”</p>`,
  qa: [
    ['What is the difference between schema validation and functional assertions?', '<p>Schema validation checks structure: fields present, types, allowed values. Functional assertions check that the values are right for this scenario. You need both.</p>'],
    ['Where do your schemas come from?', '<p>From the API contract, usually the OpenAPI document. Many teams generate them from it, so the tests follow the contract rather than a sample response.</p>'],
    ['JSON Schema or pydantic?', '<p>Both check structure. JSON Schema is a plain data description that any language can use. pydantic gives typed Python objects and editor help. Larger Python suites often prefer pydantic.</p>'],
  ],
})}
`,
};
