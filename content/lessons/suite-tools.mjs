import { figure, keyIdea, testerEye, terms, check, recap, table, code, terminal } from '../../src/components.mjs';
import { toolLayers } from '../diagrams/suite.mjs';

export default {
  minutes: 9,
  lede: 'A test suite is built from a handful of tools, each with one job. Mixing them up is the most common source of confusion when reading test code for the first time, so this lesson separates them before any of them is used.',
  youWill: 'You will learn what Python, pytest, httpx, pydantic and uv each do in the suite, how they stack, and the commands that install and run it.',
  body: `
<h2>Five layers</h2>
${figure({ svg: toolLayers(), caption: 'Each layer uses the one below it. The test files at the top read almost like the spec because the layers underneath carry the mechanics.' })}
<p>Reading from the bottom:</p>
${table(['Tool', 'Its one job', 'Where you see it'], [
  ['**Python** (3.12 or newer)', 'The language every other layer is written in', 'Everywhere'],
  ['**uv**', 'Installs the right versions of everything into a private folder, and runs commands inside it', '`uv sync`, `uv run pytest`'],
  ['**httpx**', 'Sends HTTP requests and gives back responses', 'Inside the client classes'],
  ['**pydantic**', 'Checks that a JSON body has the expected fields and types, and turns it into a Python object', 'The response models'],
  ['**pytest**', 'Finds the tests, runs them, supplies what they need, and reports', '`def test_…`, `assert`, fixtures, markers'],
  ['**cardvault_tests**', 'The suite’s own code, built on the layers above, so tests stay short', '`expect(...)`, `make_customer(...)`'],
])}
<p>Two tools are worth separating carefully. <strong>pytest is the test runner</strong>: it decides what runs and when, and turns a failed <code>assert</code> into a red result. <strong>httpx is the HTTP library</strong>: it knows nothing about tests. A test uses httpx to act and plain Python <code>assert</code> to check; pytest is the thing around both.</p>

<h2>A small project of its own</h2>
<p>The suite is a separate Python project in <code>tests/api/</code>. Its <code>pyproject.toml</code> names what it needs:</p>
${code({ title: 'tests/api/pyproject.toml (part)', lang: 'toml', src: `
[project]
name = "cardvault-api-tests"
requires-python = ">=3.12"
dependencies = [
    "pytest>=9.2",
    "httpx>=0.28.1,<1",
    "pydantic>=2.14",
    "pydantic-settings>=2.16",
    "pyjwt[crypto]>=2.15",
    "pytest-xdist>=3.8",
    "allure-pytest>=2.16",
    "confluent-kafka>=2.12",
    "jsonschema>=4.25",
    "psycopg[binary]>=3.2",
]
` })}
<p>The list says “at least this version”. The exact versions that were tested are pinned in a second file, <code>uv.lock</code>, which uv writes and which is committed. So everyone who installs the suite, including CI, gets the same versions.</p>
<p>The later entries arrive when a lesson needs them: <code>pyjwt</code> reads access tokens, <code>pytest-xdist</code> runs tests in parallel, <code>allure-pytest</code> writes a report, <code>confluent-kafka</code> reads events, <code>jsonschema</code> checks their shape, and <code>psycopg</code> reads the database.</p>

<h2>Installing and running</h2>
${terminal([
  ['cd tests/api'],
  ['uv sync', 'Creates .venv/ and installs the locked versions'],
  ['uv run pytest -m smoke', 'Runs pytest inside .venv/: here only the quick "is it up" tests'],
])}
<p><code>uv sync</code> creates a <strong>virtual environment</strong>, a private folder (<code>.venv/</code>) holding Python packages for this project only, so they cannot clash with anything else on the machine. <code>uv run</code> runs a command with that folder switched on. You never need to “activate” anything by hand.</p>
${keyIdea(`<p>Keep the jobs apart in your head: <strong>pytest runs</strong>, <strong>httpx calls</strong>, <strong>pydantic checks shapes</strong>, <strong>uv installs</strong>, and <code>cardvault_tests</code> is ordinary code that the suite wrote for itself on top of them.</p>`)}
${testerEye(`<p>When a test fails, the layer tells you where to look. A failed <code>assert</code> is a wrong answer from CardVault (or a wrong expectation). An httpx error such as a connection refused means CardVault was not reachable. A pydantic error means the answer arrived with the wrong shape.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Test runner', 'The program that finds tests, runs them and reports. Here, pytest.'],
  ['HTTP library', 'Code that sends requests and returns responses. Here, httpx.'],
  ['Virtual environment', 'A private folder of packages for one project (`.venv/`).'],
  ['Lock file', '`uv.lock`: the exact versions installed, committed so every run matches.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test fails with `httpx.ConnectError: Connection refused`. Which layer is complaining, and what does it suggest?',
  options: ['pytest: the test has a syntax error', 'httpx: the request never reached a service, so the stack is probably not running', 'pydantic: the response had the wrong shape', 'CardVault: it rejected the request'],
  answer: 1,
  why: '<p>A connection error comes from the HTTP library before any response exists. CardVault did not answer at all, so start the stack (or the stage tunnel) before reading anything into the test.</p>',
})}
${check({
  q: 'Why is `uv.lock` committed when `pyproject.toml` already lists the dependencies?',
  options: ['It is not needed; it is a cache', '`pyproject.toml` gives minimum versions; the lock pins the exact ones, so every machine runs the same', 'The lock holds secrets', 'pytest reads its markers from it'],
  answer: 1,
  why: '<p>“At least 2.14” could mean a different version next month. The lock file records exactly what was tested, so a new release of a library cannot change the suite’s behaviour without anyone noticing.</p>',
})}

<h2>Recap</h2>
${recap([
  'pytest runs tests, httpx makes HTTP calls, pydantic checks shapes, uv installs.',
  '`cardvault_tests` is the suite’s own code on top of those tools.',
  'The suite is its own project in `tests/api/`, with versions pinned in `uv.lock`.',
  '`uv sync` installs; `uv run pytest` runs inside the project’s `.venv/`.',
])}
`,
};
