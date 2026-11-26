import { code, interview, keyIdea, testerEye, table, sequence } from '../../src/components.mjs';

export default {
  minutes: 12,
  lede: 'Almost every test needs something ready before it starts: a logged-in customer, a card, a token. pytest’s answer is the fixture, a function that prepares that thing and hands it to any test that asks for it by name. This lesson reads the suite’s two fixtures in conftest.py.',
  youWill: 'You will be able to explain what a fixture is, how a test asks for one, what scope means, and how a fixture would clean up after a test.',
  body: `
<h2>Asking by name</h2>
<p>A <strong>fixture</strong> is a function marked with <code>@pytest.fixture</code>. A test asks for it by naming it as a parameter. Before running the test, pytest finds the fixture with that name, runs it, and passes in whatever it returns.</p>
${code({ title: 'tests/api/tests/test_cards.py', src: `
def test_get_one_card(customer):
    card_id = customer["wallet_card"]["card_id"]

    response = CardsApi(customer["token"]).get_card(card_id)
` })}
<p>The test never calls <code>customer()</code> itself. Seeing the name <code>customer</code> in the brackets is enough for pytest. The <code>@</code> line above a function is a <strong>decorator</strong>: it gives the function extra behaviour, here registering it with pytest.</p>

<h2>conftest.py</h2>
<p><code>conftest.py</code> is a file name pytest knows. It loads it automatically, and every test in that folder and below can use its fixtures without an <code>import</code>. The suite has two.</p>
${code({ title: 'tests/api/conftest.py', src: `
@pytest.fixture(scope="session")
def alice_token():
    """Log in as alice once for the whole run, and share her token.
...
    """
    response = AuthApi().login("alice", config.DEMO_PASSWORD)
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.fixture
def customer():
    """A brand-new customer for one test, logged in.
...
    """
    created = create_logged_in_customer(
        cards=[
            {"product": "CREDIT", "enrolled": True},
            {"product": "DEBIT"},
        ]
    )
    return {
        "token": created["token"],
        "wallet_card": created["cards"][0],
        "new_card": created["cards"][1],
    }
` })}
<ul>
<li><code>alice_token</code> logs in the demo customer alice and returns her token. The <code>assert</code> with a second value prints the response body if the login fails, so a broken login is obvious at once.</li>
<li><code>customer</code> creates a brand-new customer with two cards: a credit card already in the wallet and a debit card that is not. It returns a dictionary with the token and both cards. The work of creating and logging in lives in <code>create_logged_in_customer()</code> in <code>helpers.py</code>, which the next lesson looks at.</li>
</ul>

<h2>Scope: how often it runs</h2>
${table(['Scope', 'Runs', 'Used here for'], [
  ['`function` (the default)', 'Once for every test that asks', '`customer`: each test gets its own, so it can change anything'],
  ['`module`', 'Once per test file', 'Not used'],
  ['`session`', 'Once for the whole run', '`alice_token`: logging in again for every test would only slow the run'],
])}
<p>A shared fixture is only safe when no test changes what it shares. That is why alice is read-only, and every test that changes data uses <code>customer</code>.</p>

${sequence({
  id: 'fixture-run',
  label: 'Two tests that ask for fixtures',
  actors: [
    { id: 'p', label: 'pytest', kind: 'plain' },
    { id: 'a', label: 'alice_token', kind: 'plain' },
    { id: 'c', label: 'customer', kind: 'plain' },
    { id: 't', label: 'tests', kind: 'plain' },
  ],
  steps: [
    { from: 'p', to: 'a', label: 'first use', note: 'The first test that names `alice_token` makes pytest run it. alice logs in.' },
    { from: 'a', to: 'p', label: 'token (kept)', kind: 'reply', note: 'Session scope: pytest keeps the token for every later test that asks.' },
    { from: 'p', to: 'c', label: 'test 1 asks', note: 'Test 1 names `customer`, so pytest creates a new customer.' },
    { from: 'p', to: 't', label: 'run test 1', note: 'pytest calls test 1 with the customer dictionary.' },
    { from: 'p', to: 'c', label: 'test 2 asks', note: 'Function scope: test 2 gets another brand-new customer, never test 1’s.' },
    { from: 'p', to: 't', label: 'run test 2', note: 'Test 2 also asks for `alice_token`. pytest passes the kept token; no new login.' },
  ],
  caption: 'pytest decides when each fixture runs. Function scope gives every test a fresh copy; session scope shares one.',
})}

<h2>Cleaning up afterwards</h2>
<p>Some fixtures must undo their work, for example deleting a record they created. A fixture does that with <code>yield</code> instead of <code>return</code>. The code before <code>yield</code> is set-up, the yielded value goes to the test, and the code after it runs when the test ends, even if the test failed.</p>
${code({ title: 'Example · a fixture that cleans up', src: `
@pytest.fixture
def lost_card(customer):
    card_id = customer["new_card"]["card_id"]
    CardsApi(customer["token"]).report_lost(card_id)
    yield card_id                       # the test runs here
    CardsApi(customer["token"]).reissue(card_id)   # tidy up afterwards
` })}
<p>The suite has no clean-up step because every changing test owns a throwaway customer. Nothing it does can affect another test. Notice also that a fixture can ask for another fixture: <code>lost_card</code> names <code>customer</code>.</p>

${keyIdea('<p>A fixture prepares what a test needs and is requested by name. Scope sets how often it runs: per test for anything a test may change, once per session for read-only things that are slow to make.</p>')}

${testerEye('<p>If you know other frameworks, fixtures replace set-up and tear-down methods such as <code>setUp</code> in unittest or <code>@BeforeEach</code> in JUnit. The difference is that each test lists exactly what it needs, so you can see its dependencies at a glance.</p>')}

${interview({
  say: `<p>“Set-up lives in pytest fixtures in conftest.py. A session-scoped fixture logs in a read-only demo customer once per run. A function-scoped fixture creates a fresh customer with known cards for every test that changes data, so tests are independent and can run in any order or in parallel. When a fixture must clean up, it yields the value and tears down after the yield.”</p>`,
  qa: [
    ['What is conftest.py?', '<p>A file pytest loads automatically. Fixtures in it are available to every test in its folder and below, with no import.</p>'],
    ['What fixture scopes are there?', '<p>function (the default), class, module, package and session. Wider scopes run less often, which is faster, but are shared, so they suit only data that tests do not change.</p>'],
    ['How does a fixture clean up?', '<p>It uses <code>yield</code>. Code after the yield runs when the test finishes, whether it passed or failed.</p>'],
  ],
})}
`,
};
