import { figure, keyIdea, testerEye, terms, check, recap, code, terminal } from '../../src/components.mjs';
import { runPhases } from '../diagrams/suite.mjs';

export default {
  minutes: 11,
  lede: 'Run one at a time, the suite’s 397 tests spend most of their life waiting for answers from CardVault. Running several at once makes the whole suite much faster, but only if the tests cannot disturb each other. Fresh customers solved that for data. This lesson deals with what is left: the few switches every service shares.',
  youWill: 'You will learn how pytest-xdist spreads tests over worker processes, which tests cannot run alongside others and why, and how the suite runs in two passes.',
  body: `
<h2>Running tests side by side</h2>
<p><strong>pytest-xdist</strong> is a pytest plugin that runs tests in several <strong>worker processes</strong> at once. You switch it on with <code>-n</code>: <code>-n 4</code> starts four workers, <code>-n auto</code> starts one per CPU core. The main pytest process becomes the <strong>controller</strong>: it collects the tests, deals them out to the workers, and gathers the results into one report.</p>
<p>This only works because of <a href="/learn/suite-fresh-customers/">fresh customers</a>. Two tests running at the same moment each act on their own customer, so neither can see the other’s changes. Without that, a parallel run would fail at random.</p>
<p>There is one thing the workers must not each do: reset CardVault. If four workers reset and reseeded at the start, one could wipe the data another had already begun to use. So the start-of-run hook from <a href="/learn/suite-first-test/">The first test</a> checks where it is running, and a worker returns at once:</p>
${code({ title: 'tests/api/tests/conftest.py (part)', src: `
    if hasattr(session.config, "workerinput"):
        return  # an xdist worker: the controller has already prepared the environment
` })}
<p>xdist gives each worker’s configuration a <code>workerinput</code> attribute, and the controller has none, so this one line tells them apart. The controller resets once; the workers start after it.</p>

<h2>What fresh data cannot fix</h2>
<p>Some things in CardVault belong to everyone at once. The <a href="/learn/the-shared-clock/">shared clock</a> is one: when a test moves it forward a week, every service, and so every other running test, is suddenly a week ahead. <a href="/learn/faults-and-seeded-bugs/">Injected faults</a> are another: a test that makes the card service return errors makes it return errors to everybody. The same goes for the operator mock’s behaviour controls.</p>
<p>A test that touches one of these shared switches carries a marker, <code>serial</code>:</p>
${code({ title: 'tests/api/tests/auth/test_access_tokens.py (part)', src: `
@pytest.mark.serial
def test_access_token_expires_after_15_minutes_of_shared_clock_time(
    make_customer, shared_clock, services
):
` })}
<p>A whole file can be marked at once with <code>pytestmark = pytest.mark.serial</code> at the top, which the time-boundary tests do. Markers must be declared, so <code>serial</code> is listed with its meaning in the suite’s <code>pyproject.toml</code>; the suite runs with <code>--strict-markers</code>, so a misspelt marker stops the run with an error instead of being silently ignored.</p>

<h2>Two passes</h2>
<p>In a parallel run, the suite leaves the serial tests out. It does this in another pytest hook, <code>pytest_collection_modifyitems</code>, which pytest calls once it has collected every test and before any runs:</p>
${code({ title: 'tests/api/tests/conftest.py (part)', src: `
def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    # A serial test moves something every service shares (the clock, faults). While it runs,
    # any other test would see that change too, so in a parallel run serial tests are left
    # out, and run afterwards on their own with \`pytest -m serial\`.
    if not _parallel(config):
        return
    serial = [item for item in items if item.get_closest_marker("serial")]
    if serial:
        config.hook.pytest_deselected(items=serial)
        items[:] = [item for item in items if not item.get_closest_marker("serial")]
` })}
<p><code>items</code> is the list of tests about to run. The hook builds the list of serial ones, reports them as deselected (so the summary counts them honestly), and replaces the contents of <code>items</code> with the rest. <code>items[:] = …</code> changes the list pytest holds in place; assigning a new list to the name <code>items</code> would change nothing pytest can see.</p>
${figure({ svg: runPhases(), caption: 'A full run is two commands. The first spreads the ordinary tests over workers; the second runs the tests that move shared switches, one at a time.' })}
${terminal([
  ['uv run pytest -n auto', 'Parallel run: serial tests are left out; run them with: pytest -m serial\n…\n380 passed in 50.28s'],
  ['uv run pytest -m serial', '…\n17 passed, 380 deselected in 32.33s'],
])}
<p>Those times are from a four-core machine with the local stack. The serial pass is small but slow for its size, because its tests wait for clocks to settle, for retries and for timeouts. Plain <code>uv run pytest</code>, with no <code>-n</code>, runs all 397 in one process, serial tests included, since nothing else is running beside them.</p>
${keyIdea(`<p>Fresh data makes most tests safe to run side by side. A test that changes something every service shares must run alone, so it is marked <code>serial</code> and run in a second pass.</p>`)}
${testerEye(`<p>A test that moves the clock but is not marked <code>serial</code> usually passes in a parallel run, because the timing rarely lines up. When it does line up, some unrelated test fails. That is the hardest kind of flaky test to trace, so mark shared-switch tests the moment you write them.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['pytest-xdist', 'A pytest plugin that runs tests in several worker processes at once, switched on with `-n`.'],
  ['Worker', 'A process that runs some of the tests in a parallel run.'],
  ['Controller', 'The main pytest process in a parallel run: it deals out tests and gathers results.'],
  ['Serial test', 'A test that changes something every service shares, so it must run with nothing beside it.'],
  ['Deselected', 'Collected but left out of this run on purpose, and counted as such in the summary.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A new test injects a 5-second delay into the card service and checks a timeout. It is not marked `serial`. What might happen in `pytest -n auto`?',
  options: ['Nothing; it uses a fresh customer', 'Other tests running at the same moment hit the delay and fail or time out', 'xdist detects the fault and pauses other workers', 'The test is skipped automatically'],
  answer: 1,
  why: '<p>A fault applies to the service, not to one customer, so every test calling the card service during that window sees it. Only the <code>serial</code> marker keeps such a test away from others.</p>',
})}
${check({
  q: 'Why does only the controller reset and reseed CardVault at the start of a parallel run?',
  options: ['Workers have no network access', 'If every worker reset, one could wipe data another had already started using', 'Resetting is slow on workers', 'xdist forbids hooks in workers'],
  answer: 1,
  why: '<p>Workers start at slightly different moments. A late worker’s reset would delete customers that an early worker’s tests had just created. One reset by the controller, before any worker starts testing, avoids that.</p>',
})}

<h2>Recap</h2>
${recap([
  '`pytest -n auto` spreads tests over one worker per CPU core; the controller resets once.',
  'Fresh customers make ordinary tests safe to run side by side.',
  'Tests that move the clock, inject faults or change mock behaviour are marked `serial`.',
  'A full run is `pytest -n auto`, then `pytest -m serial`.',
])}
`,
};
