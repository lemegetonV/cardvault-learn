import { figure, keyIdea, testerEye, terms, check, recap, code, terminal } from '../../src/components.mjs';
import { runOrder } from '../diagrams/suite.mjs';

export default {
  minutes: 10,
  lede: 'Every suite starts with the smallest useful test: is the thing even running? CardVault’s first test asks each service for its health. It is short, but it already shows the shape every later test follows, and the run around it shows how the suite gets the system into a known state before testing anything.',
  youWill: 'You will learn how pytest finds and runs a test, the arrange, act and assert shape, what happens once before any test, and how to run just the quick checks.',
  body: `
<h2>What makes a function a test</h2>
<p>pytest looks in the <code>tests/</code> folder for files whose names start with <code>test_</code>, and inside them for functions whose names start with <code>test_</code>. Each such function is one test. If it returns normally, the test passes. If anything inside it raises an error, most often a failed <code>assert</code>, the test fails.</p>
<p>Python’s <code>assert</code> statement checks a condition and raises <code>AssertionError</code> when it is false. pytest rewrites asserts as it loads a test file, so a failure shows both sides of the comparison instead of a bare “assertion failed”.</p>

<h2>The health check</h2>
${code({ title: 'tests/api/tests/health/test_health.py (part)', src: `
SERVICES = list(get_settings().services.items())


@pytest.mark.smoke
@pytest.mark.parametrize(("name", "url"), SERVICES, ids=[n for n, _ in SERVICES])
def test_health_reports_the_service_by_name(controls, name, url):
    body = expect_status(controls[name].http.get("/health"), 200).json()

    assert body == {"status": "ok", "service": name}
` })}
<p>Line by line:</p>
<ul>
<li><code>SERVICES</code> is every service and mock, read from the settings, as pairs of name and address: <code>("auth", "http://localhost:8001")</code> and so on.</li>
<li><code>@pytest.mark.smoke</code> is a <strong>marker</strong>, a label pytest can select by. Smoke tests are the quick “is it up” subset.</li>
<li><code>@pytest.mark.parametrize</code> runs the same test once per pair, so this one function is seven tests, named after each service. <a href="/learn/suite-tables-of-cases/">Tables of cases</a> uses this idea much more.</li>
<li><code>controls</code> is a parameter the test did not create itself. pytest supplies it, as a <strong>fixture</strong>: here, a set of ready-made clients for each service’s control endpoints. <a href="/learn/suite-fixtures/">Fixtures</a> explains how.</li>
<li>The body sends <code>GET /health</code>, insists on <code>200</code>, and compares the whole JSON body with what the spec says a healthy service returns.</li>
</ul>
<p>The blank line in the middle is deliberate. Above it is the <strong>act</strong> (send the request); below it is the <strong>assert</strong> (check the answer). Most tests in the suite also have an <strong>arrange</strong> part first, which sets up the data the test needs. Arrange, act, assert, separated by blank lines, is the shape every test in the suite follows.</p>

<h2>Before the first test: a known state</h2>
${figure({ svg: runOrder(), caption: 'The left box runs once, before any test. Each test on the right can then rely on the seed data being exactly as published.' })}
<p>A test can only predict an answer if it knows what the system held beforehand. So before the first test, the suite waits until every service reports itself ready, then resets everything and loads the seed data, the same fixed customers and cards every time. This happens in a pytest <strong>hook</strong>, a function pytest calls at a fixed moment, here <code>pytest_sessionstart</code> at the start of the run.</p>
${code({ title: 'tests/api/tests/conftest.py (part)', src: `
@pytest.hookimpl(tryfirst=True)
def pytest_sessionstart(session: pytest.Session) -> None:
    if hasattr(session.config, "workerinput"):
        return  # an xdist worker: the controller has already prepared the environment
    if session.config.option.collectonly:
        return
    settings = get_settings()
    controls = _controls(settings, record=False)
    environment.wait_until_ready(controls, settings.ready_wait_seconds)
    if settings.reset_at_start:
        environment.reset_and_seed(controls)
` })}
<p>The two early <code>return</code>s matter later. When tests run in parallel, several worker processes start, and only the first, the controller, should reset the system; and merely listing the tests should not touch it at all. If a service never becomes ready, the run stops with a message naming the service and its last answer, instead of hundreds of confusing failures.</p>

<h2>Running it</h2>
${terminal([
  ['uv run pytest -m smoke', 'CardVault environment: local (auth at http://localhost:8001)\n…\ncollected 397 items / 381 deselected / 16 selected\n…\n16 passed, 381 deselected in 0.46s'],
])}
<p><code>-m smoke</code> selects tests carrying that marker: the health tests plus one login and one card-reading test. It takes under a second, so it is the first thing to run against an environment you are unsure of.</p>
<p>Markers can also label a reading path. The 23 tests these lessons walk through carry a <code>lesson</code> marker, so <code>uv run pytest -m lesson</code> runs just them, and the <a href="/suite/">suite explorer</a> lists them in lesson order under “Start here”.</p>
${keyIdea(`<p>A test is a function named <code>test_…</code> that acts, then asserts. It can predict the answer because the run starts by putting the whole system into the same known state.</p>`)}
${testerEye(`<p>Health tests look trivial, but when one fails nothing else in the run can be trusted. That is why they are the smoke subset: run them first, and read the rest of a report only once they are green.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Arrange, act, assert', 'Set up, do the one thing under test, check the result: the shape of every test.'],
  ['Marker', 'A label on a test, such as `smoke`, that `pytest -m` can select by.'],
  ['Hook', 'A function pytest calls at a fixed moment, such as `pytest_sessionstart`.'],
  ['Seed data', 'The fixed customers, cards and history loaded after a reset.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test file defines `def check_login():` with a request and an assert inside. What does pytest do with it?',
  options: ['Runs it as a test', 'Ignores it, because the name does not start with `test_`', 'Reports an error', 'Runs it before every test'],
  answer: 1,
  why: '<p>pytest collects only functions named <code>test_…</code> (in files named <code>test_…</code>). Other functions are ordinary helpers, called only if a test calls them.</p>',
})}
${check({
  q: 'Why does the suite reset and reseed before the first test rather than trust whatever the system holds?',
  options: ['Resetting makes the services faster', 'Expected values come from known starting data, so the starting data must be known', 'pytest requires it', 'To delete old logs'],
  answer: 1,
  why: '<p>A test that expects alice to have four cards is only right if alice’s data is the seed data. Starting every run from the same state is what makes those expectations valid.</p>',
})}

<h2>Recap</h2>
${recap([
  'pytest runs every `test_…` function in every `test_…` file; a failed `assert` fails the test.',
  'Each test is arrange, act, assert, with blank lines between the parts.',
  'Before the first test, the suite waits for `/ready`, resets everything and loads the seed.',
  '`pytest -m smoke` runs the quick “is it up” subset.',
])}
`,
};
