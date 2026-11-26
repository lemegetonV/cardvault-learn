import { code, terminal, interview, keyIdea, testerEye, table } from '../../src/components.mjs';

export default {
  minutes: 9,
  lede: 'A full run takes about 24 seconds today, and real suites take far longer. Most of the time you want only part of it: the quick checks after a deploy, one file you are working on, or only the tests that just failed. This lesson shows how to choose.',
  youWill: 'You will be able to label tests with markers, and run a subset of the suite by label, file, name or last result.',
  body: `
<h2>Labels on tests</h2>
<p>A <strong>marker</strong> is a label you put on a test with a decorator. The suite uses one, <code>smoke</code>, on five tests that together show the main features work: logging in, listing cards, a purchase, the transactions list and adding a card to the wallet.</p>
${code({ title: 'tests/api/tests/test_cards.py', src: `
@pytest.mark.smoke
def test_alice_has_her_four_cards(alice_token):
` })}
<p>Your own markers must be listed in <code>pytest.ini</code>. Otherwise pytest warns about a possible typo, because <code>@pytest.mark.smoek</code> would silently label nothing.</p>
${code({ lang: 'ini', title: 'tests/api/pytest.ini', src: `
# Labels we can put on tests to run a group of them, for example: pytest -m smoke
markers =
    smoke: a few quick tests that show the main features work
` })}

<h2>Running by label</h2>
${terminal([['pytest -m smoke', `collecting ... collected 72 items / 67 deselected / 5 selected

tests/test_cards.py::test_alice_has_her_four_cards PASSED                [ 20%]
tests/test_login.py::test_login_with_correct_password_returns_a_token PASSED [ 40%]
tests/test_purchases.py::test_a_purchase_is_approved_and_the_money_is_held PASSED [ 60%]
tests/test_transactions.py::test_a_purchase_appears_in_the_transactions_list PASSED [ 80%]
tests/test_wallet.py::test_add_a_card_to_the_wallet PASSED               [100%]

======================= 5 passed, 67 deselected in 3.42s =======================`]], 'Terminal')}
<p><strong>Deselected</strong> means collected but not run because of your choice. Marker expressions can combine labels, such as <code>-m "smoke and not slow"</code>.</p>

<h2>Other ways to choose</h2>
${table(['Command', 'Runs'], [
  ['`pytest tests/test_cards.py`', 'One file'],
  ['`pytest tests/test_cards.py::test_get_one_card`', 'One test, by its node id: file, two colons, name'],
  ['`pytest -k lost`', 'Tests whose name contains “lost” (6 today)'],
  ['`pytest -k "lost and not wallet"`', 'Name expressions with and, or, not'],
  ['`pytest --lf`', 'Only the tests that failed last time (last failed)'],
  ['`pytest -x`', 'Everything, but stop at the first failure'],
])}
<p><code>--lf</code> is the one to remember when fixing a failure: change the code, run only what failed, repeat, then run everything once at the end.</p>

<h2>Built-in markers</h2>
<p>pytest also ships markers with a meaning of their own:</p>
${code({ title: 'Example · built-in markers', src: `
@pytest.mark.skip(reason="The export screen is being rebuilt")
def test_export_layout():
    ...


@pytest.mark.skipif(sys.platform == "win32", reason="Needs a Unix shell")
def test_shell_script():
    ...


@pytest.mark.xfail(reason="Known bug, ticket CV-123")
def test_dispute_note_limit():
    ...
` })}
<ul>
<li><code>skip</code> never runs the test and reports it as skipped, with the reason.</li>
<li><code>skipif</code> skips only when the condition is true.</li>
<li><code>xfail</code> (expected to fail) runs the test but does not fail the run if it fails. If it suddenly passes, pytest reports it as an unexpected pass, a hint that the bug was fixed.</li>
</ul>
<p>Use them sparingly and always with a reason. A skipped test checks nothing, and skips tend to be forgotten.</p>

${keyIdea('<p>Markers label tests; <code>-m</code> runs a label, <code>-k</code> runs by name, a path or node id runs a file or one test, and <code>--lf</code> reruns only the failures.</p>')}

${testerEye('<p>Teams often run a smoke set on every deploy, the full regression set on every merge, and slow or expensive groups at night. Markers are how one suite serves all three.</p>')}

${interview({
  say: `<p>“I tag tests with markers registered in pytest.ini, for example a small smoke set covering login, cards, a purchase, transactions and the wallet. CI can run pytest -m smoke after a deploy and the full suite on every merge. Locally I use -k to run by name and --lf to rerun only the failures while I fix them.”</p>`,
  qa: [
    ['How do you run only smoke tests?', '<p>Mark them with <code>@pytest.mark.smoke</code>, register the marker in pytest.ini, and run <code>pytest -m smoke</code>.</p>'],
    ['What is the difference between skip and xfail?', '<p>skip does not run the test at all. xfail runs it and expects it to fail, so the run stays green, and pytest tells you if it starts passing.</p>'],
    ['Why register custom markers?', '<p>So a typo in a marker name is reported instead of silently leaving the test out of the group. With <code>--strict-markers</code>, an unregistered marker is an error.</p>'],
  ],
})}
`,
};
