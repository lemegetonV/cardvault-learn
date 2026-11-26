import { code, tree, sequence, terminal, interview, table, keyIdea } from '../../src/components.mjs';

export default {
  minutes: 12,
  lede: 'The last lesson ended with two tests that repeated the same addresses, password and login call. A test framework is simply a tidy home for those repeated pieces. This lesson is the map of CardVault’s pytest framework: every file, its job, and what happens when you run it.',
  youWill: 'You will be able to name every file in the framework, say why it exists, and trace one test run from start to finish.',
  body: `
<h2>Every file and its job</h2>
<p>The whole framework lives in <code>tests/api/</code> in the CardVault repository. It has a dozen small files around the tests.</p>
${tree([
  ['tests/api/', 0, ''],
  ['requirements.txt', 1, 'The libraries to install: pytest, requests, pytest-html'],
  ['pytest.ini', 1, 'pytest’s settings: where the tests are, and the `smoke` label'],
  ['config.py', 1, 'Every service address and shared setting, in one place'],
  ['conftest.py', 1, '**Fixtures**: set-up that tests ask for by name, such as a logged-in customer'],
  ['helpers.py', 1, 'Create a fresh customer; wait for changes that finish later'],
  ['api/', 1, 'One class per service. Each method sends one API call'],
  ['auth_api.py', 2, 'Log in, who am I'],
  ['cards_api.py', 2, 'List cards, report lost, reissue, close'],
  ['wallet_api.py', 2, 'Wallet status, add and remove cards, opt out'],
  ['transactions_api.py', 2, 'List, detail, CSV export, disputes'],
  ['profile_api.py', 2, 'Contact details and verification'],
  ['customers_api.py', 2, 'Create a brand-new test customer'],
  ['card_network_api.py', 2, 'Make and settle purchases through the simulator'],
  ['data/', 1, ''],
  ['demo_customers.py', 2, 'What we know in advance about alice: the expected values'],
  ['schemas.py', 2, 'JSON Schemas: the shape a card and an error must have'],
  ['files/', 2, 'A receipt picture and a fake one, for dispute uploads'],
  ['tests/', 1, 'The tests themselves, one file per feature (72 tests)'],
  ['test_login.py', 2, '10 tests: sign-in, wrong passwords, tokens, refresh, lockout'],
  ['test_cards.py', 2, '9 tests: listing cards and changing them'],
  ['test_wallet.py', 2, '15 tests: eligibility rules, add, remove, opt out'],
  ['test_purchases.py', 2, '6 tests: approvals, declines, settlement'],
  ['test_transactions.py', 2, '11 tests: the history, CSV export, disputes and receipts'],
  ['test_profile.py', 2, '6 tests: contact details and verification'],
  ['test_response_shape.py', 2, '3 tests: responses checked against a JSON Schema'],
  ['test_security.py', 2, '5 tests: other customers’ data, forged tokens, protected fields'],
  ['test_api_behaviours.py', 2, '7 tests: pages, idempotency keys, version checks, rate limits'],
], 'tests/api')}

<h2>Three layers</h2>
<p>The files fall into three layers, and each layer only talks to the one below it.</p>
${table(['Layer', 'Files', 'Answers the question'], [
  ['Tests', '`tests/test_*.py`', 'What should be true? (the checks)'],
  ['Support', '`conftest.py`, `helpers.py`, `data/`', 'What does a test need before it starts?'],
  ['API clients', '`api/*.py`, `config.py`', 'How do we talk to each service?'],
])}
<p>Because of this split, a test reads like a description of behaviour. If the Cards service changes an address, you change one line in <code>cards_api.py</code> or <code>config.py</code>, and no test changes at all.</p>

<h2>Before and after</h2>
<p>Here is the “alice has four cards” test from the last lesson, as it looks in the framework:</p>
${code({ title: 'tests/api/tests/test_cards.py', src: `
@pytest.mark.smoke
def test_alice_has_her_four_cards(alice_token):
    response = CardsApi(alice_token).list_cards()

    assert response.status_code == 200
    cards = response.json()["items"]
    # Turn the list into {last4: product}, to compare with what we expect.
    found = {card["last4"]: card["product"] for card in cards}
    assert found == ALICE["cards"]
` })}
<ul>
<li><code>alice_token</code> in the brackets asks pytest for a <strong>fixture</strong>. pytest finds the function with that name in <code>conftest.py</code>, which logs alice in, and passes her token in. The login code is no longer in the test.</li>
<li><code>CardsApi(alice_token).list_cards()</code> replaces the URL and headers. The address lives in <code>config.py</code>, and the request is built in <code>cards_api.py</code>.</li>
<li><code>ALICE["cards"]</code> comes from <code>data/demo_customers.py</code>, so the expected values are written down once, where everyone can see them.</li>
<li><code>@pytest.mark.smoke</code> puts a label on the test, so <code>pytest -m smoke</code> runs just the quick checks.</li>
</ul>
<p>The test is also stronger now: it checks which four cards alice has, not just that there are four.</p>

<h2>What happens when you type pytest</h2>
${sequence({
  id: 'pytest-run',
  label: 'One pytest run, from the command to the result',
  actors: [
    { id: 'p', label: 'pytest', kind: 'plain' },
    { id: 'f', label: 'conftest.py', kind: 'plain' },
    { id: 't', label: 'test function', kind: 'plain' },
    { id: 'a', label: 'CardsApi', kind: 'plain' },
    { id: 's', label: 'Cards service', kind: 'bank' },
  ],
  steps: [
    { from: 'p', to: 'p', label: 'read pytest.ini, find tests', kind: 'self', note: 'pytest reads `pytest.ini`, looks in `tests/`, and collects every `test_` function: 72 of them.' },
    { from: 'p', to: 'f', label: 'alice_token?', note: 'The first test asks for `alice_token`. pytest runs that fixture in `conftest.py`, which logs alice in through `AuthApi`.' },
    { from: 'f', to: 'p', label: 'token', kind: 'reply', note: 'The fixture returns her token. Its scope is the whole session, so later tests reuse it without logging in again.' },
    { from: 'p', to: 't', label: 'run the test', note: 'pytest calls the test function and passes the token in.' },
    { from: 't', to: 'a', label: 'list_cards()', note: 'The test asks the client class for alice’s cards.' },
    { from: 'a', to: 's', label: 'GET /v1/cards', note: 'The client builds the URL from `config.CARD_URL`, adds the token header, and sends the request with requests.' },
    { from: 's', to: 'a', label: '200 + JSON', kind: 'reply', note: 'The Cards service answers.' },
    { from: 'a', to: 't', label: 'response', kind: 'reply', note: 'The client hands the response back untouched, so the test can check anything in it.' },
    { from: 't', to: 't', label: 'assert ...', kind: 'self', note: 'The asserts run. If all pass, the test passes; the first one that fails stops the test.' },
    { from: 't', to: 'p', label: 'PASSED', kind: 'reply', note: 'pytest records the result and moves on to the next test.' },
  ],
  caption: 'The order of one run. pytest drives everything; the test only says what to check.',
})}

<h2>Running it</h2>
${terminal([
  ['cd tests/api', ''],
  ['pip install -r requirements.txt', ''],
  ['pytest', '============================= 72 passed in 23.91s ============================='],
  ['pytest -m smoke', '======================= 5 passed, 67 deselected in 3.42s ======================='],
  ['pytest tests/test_cards.py', '(only the card tests)'],
  ['pytest -k lost', '(only tests with "lost" in their name)'],
], 'Terminal')}

${keyIdea('<p>Tests say <strong>what</strong> should be true. Fixtures and helpers prepare <strong>what the test needs</strong>. API classes know <strong>how</strong> to talk to each service. Each repeated detail lives in exactly one file.</p>')}

<p>The next lessons open these files one at a time, starting with <a href="/learn/py-config/">config.py</a>.</p>

${interview({
  say: `<p>“The framework has three layers. At the bottom, one client class per microservice wraps the HTTP calls with requests, reading base URLs from a config module driven by environment variables. In the middle, pytest fixtures in conftest.py handle set-up, such as a session-scoped login for a read-only demo customer and a fresh customer per test for anything that changes data. On top, tests are grouped by feature and only describe behaviour and assertions. Markers like smoke let us run subsets, and CI runs the whole suite and publishes an HTML report.”</p>`,
  qa: [
    ['Why wrap API calls in client classes?', '<p>So each endpoint’s URL and headers are written once. Tests stay short and readable, and when an endpoint changes, only the client changes.</p>'],
    ['What is conftest.py?', '<p>A special file that pytest loads automatically. Fixtures defined there can be used by every test in that folder and below it, without any import.</p>'],
    ['How do you keep tests independent?', '<p>Tests that only read data share the demo customer. Any test that changes data gets its own fresh customer from a fixture, so tests never affect each other and can run in any order.</p>'],
  ],
})}
`,
};
