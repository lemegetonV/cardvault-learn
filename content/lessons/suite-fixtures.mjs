import { figure, keyIdea, testerEye, terms, check, recap, code, table } from '../../src/components.mjs';
import { fixtureGraph } from '../diagrams/suite.mjs';

export default {
  minutes: 13,
  lede: 'The tests so far received things they never created: `controls`, `alice`. Those are fixtures, pytest’s way of handing a test what it needs and tidying up afterwards. They are what keep three hundred tests short, and what makes clean-up happen even when a test fails halfway.',
  youWill: 'You will learn how a fixture is declared and requested, what scope means, how `yield` gives reliable clean-up, and the handful of fixtures nearly every test uses.',
  body: `
<h2>Asking for something by name</h2>
<p>A <strong>fixture</strong> is a function marked with <code>@pytest.fixture</code>. A test asks for one simply by naming it as a parameter. Before the test runs, pytest finds the fixture with that name, runs it, and passes in what it returns:</p>
${code({ title: 'tests/api/tests/conftest.py (part)', src: `
@pytest.fixture(scope="session")
def alice(services: Services, settings: Settings) -> Customer:
    """The seed customer alice, logged in. Read-only: never change her data."""
    return log_in(services, ALICE.username, settings.seed_user_password, [])
` })}
<p>Fixtures can ask for other fixtures the same way: <code>alice</code> needs <code>services</code> (the httpx clients) and <code>settings</code> (for the seed password). pytest works out the order. Fixtures shared by many test files live in a file called <code>conftest.py</code>, which pytest loads automatically; no test imports it.</p>
${figure({ svg: fixtureGraph(), caption: 'Which fixture is given to which. This is a picture of needs, not of time: pytest creates each one when a test first needs it.' })}

<h2>Scope: how long a fixture lives</h2>
<p>The <strong>scope</strong> says how often a fixture is created:</p>
${table(['Scope', 'Created', 'Used for'], [
  ['`session`', 'Once per run, then shared', 'Things that are expensive and never change: settings, httpx clients, logging alice in'],
  ['`function` (the default)', 'Fresh for every test', 'Anything a test changes, or must not share'],
])}
<p>A session fixture saves work, but every test sees the same object. That is safe for alice only because no test changes her data; the docstring says so, and the suite keeps to it. A test that needs to change a customer asks for a fresh one instead, through <code>make_customer</code>, the subject of <a href="/learn/suite-fresh-customers/">the next lesson</a>.</p>

<h2>Clean-up that always happens</h2>
<p>Some fixtures change something shared and must change it back. The <code>shared_clock</code> fixture lets a test move CardVault’s clock, and afterwards must restore real time, whether the test passed or not:</p>
${code({ title: 'tests/api/tests/conftest.py (part)', src: `
@pytest.fixture
def shared_clock(controls: dict[str, ServiceControl]) -> Iterator[ServiceControl]:
    control = controls["auth"]
    yield control
    expect_status(control.set_clock(reset=True), 200)
    wait_until(
        lambda: [expect(c.clock(), 200, ClockView).offset_seconds for c in controls.values()],
        lambda offsets: not any(offsets),
        timeout=5,
        what="every service to be back on real time",
    )
` })}
<p>A fixture with <code>yield</code> works in two halves. Everything before <code>yield</code> runs before the test; the yielded value is what the test receives; everything after runs once the test is over. pytest runs the second half even if the test failed, so a failing clock test cannot leave the clock moved for the tests after it. (The <code>wait_until</code> part is explained in <a href="/learn/suite-moving-time/">Moving the clock</a>.)</p>
<p>Compare the alternative: clean-up as the last lines of the test. A failed <code>assert</code> stops the test at that line, so the clean-up would never run, and one failure would cause a cascade of unrelated ones.</p>
${keyIdea(`<p>Put set-up and clean-up in a fixture, either side of <code>yield</code>. The test body then contains only the behaviour being tested, and the clean-up runs whatever happens.</p>`)}

<h2>A fixture nobody asks for</h2>
<p>A fixture with <code>autouse=True</code> runs for every test without being named. The suite has one: before each test it empties the list of recorded requests, so a failure report shows only that test’s requests.</p>
${code({ title: 'tests/api/tests/conftest.py (part)', src: `
@pytest.fixture(autouse=True)
def _exchange_log() -> Iterator[None]:
    exchanges.clear()
    yield
` })}

<h2>The fixtures you will meet most</h2>
${table(['Fixture', 'Scope', 'Gives the test'], [
  ['`settings`', 'session', 'Every address, key and option'],
  ['`services`', 'session', 'One httpx client per service and mock'],
  ['`controls`', 'session', 'The `/test/*` controls of every service'],
  ['`alice`', 'session', 'The seed customer, logged in. Read only.'],
  ['`make_customer`', 'function', 'A way to create a fresh customer with cards'],
  ['`card_network`', 'session', 'card-service’s internal API, called as the network would'],
  ['`shared_clock`', 'function', 'The clock control; real time restored afterwards'],
])}
${testerEye(`<p>When a test seems to depend on another test, look at the fixtures it shares. A session fixture that something changes, or clean-up that only runs on success, are the two usual causes of tests that pass alone and fail together.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Fixture', 'A function pytest runs to give a test something it asks for by name.'],
  ['`conftest.py`', 'A file of shared fixtures and hooks that pytest loads automatically.'],
  ['Scope', 'How long a fixture’s value lives: once per run (`session`) or per test (`function`).'],
  ['`yield` fixture', 'Set-up before `yield`, clean-up after; the clean-up runs even if the test fails.'],
  ['`autouse`', 'A fixture that runs for every test without being named.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test moves the clock and then fails on its second assert. The clock reset is in the fixture after `yield`. What state does the next test see?',
  options: ['The moved clock, because the test stopped early', 'Real time, because pytest runs the code after `yield` even when the test fails', 'It depends on the order of tests', 'The run stops'],
  answer: 1,
  why: '<p>pytest always finishes a yield fixture after the test, pass or fail. That is the whole point of putting clean-up there instead of at the end of the test.</p>',
})}
${check({
  q: 'Why is `alice` session-scoped while `make_customer` is function-scoped?',
  options: ['alice is faster to create', 'No test changes alice, so one shared login is safe; customers that tests change must be fresh each time', 'Session fixtures cannot create customers', 'It is arbitrary'],
  answer: 1,
  why: '<p>Sharing is safe only for things nobody changes. alice is read-only by rule; anything a test changes gets a fresh fixture so tests cannot see each other’s changes.</p>',
})}

<h2>Recap</h2>
${recap([
  'A test names a fixture as a parameter and pytest supplies it; fixtures can use fixtures.',
  'Shared fixtures live in `conftest.py`; `session` scope shares, `function` scope is fresh.',
  'Clean-up goes after `yield`, so it runs even when the test fails.',
  'Share only what no test changes; alice is shared and read-only.',
])}
`,
};
