import { figure, keyIdea, testerEye, terms, check, recap, code } from '../../src/components.mjs';
import { reconFindings } from '../diagrams/suite.mjs';

export default {
  minutes: 12,
  lede: 'Reconciliation compares the bank’s enrolment records with the operator’s daily file and reports every difference. Testing it brings a new problem: a run looks at every record in the system, including those of every other test running at the same time. This lesson shows how the suite creates one difference on purpose and finds exactly that one in a crowded report.',
  youWill: 'You will learn how to plant one known difference per test, how to filter a shared result down to your own data, how a list unpacking doubles as an assertion, and how a failing run is tested.',
  body: `
<h2>Four kinds of difference</h2>
<p>The first track’s <a href="/learn/reconciliation/">Reconciliation</a> lesson explained why it exists: two systems hold copies of the same facts, and messages between them can be lost. Each difference is reported as a <strong>finding</strong> of one of four types.</p>
${figure({ svg: reconFindings(), caption: 'Each test makes one of the first four rows happen to its own enrolment, then expects that finding. The last row is the control case.' })}

<h2>Planting one difference</h2>
<p>The bank’s side of each test is a fresh customer with an enrolled card. The operator’s side is changed through the mock’s <code>/test/state</code> control, which edits the operator’s records directly: delete one, change its status, or add one the bank has never heard of. The operator’s next daily file then contains exactly that difference.</p>
${code({ title: 'tests/api/tests/reconciliation/test_reconciliation.py (part)', src: `
def test_a_different_status_is_a_status_mismatch(enrolled, reconciliation, operator_state):
    upsert = [{"enrollment_id": enrolled["enrollment_id"], "status": "SUSPENDED"}]
    expect_status(operator_state.change_state(upsert=upsert), 200)

    [finding] = findings_for(run_now(reconciliation), enrolled["enrollment_id"])

    assert (finding.type, finding.sor_status, finding.operator_status) == (
        "STATUS_MISMATCH",
        "ENROLLED",
        "SUSPENDED",
    )
` })}
<p>“Upsert” means update the record if it exists, insert it if not. The test changes only the status of its own enrolment, so the expected finding follows directly: the bank (the <strong>system of record</strong>, SOR) says <code>ENROLLED</code>, the operator says <code>SUSPENDED</code>.</p>

<h2>Finding your own result in a shared report</h2>
<p>A run compares <em>every</em> enrolment, so its findings include whatever other tests, running in parallel, have just done to theirs. Asserting “the run has one finding” would fail at random. The suite filters the findings to its own enrolment first:</p>
${code({ title: 'tests/api/tests/reconciliation/test_reconciliation.py (part)', src: `
def findings_for(run: ReconciliationRun, enrollment_id: object) -> list:
    return [f for f in run.findings if str(f.enrollment_id) == str(enrollment_id)]


def run_now(reconciliation) -> ReconciliationRun:
    run = expect(reconciliation.run(), 201, ReconciliationRun)
    assert run.status == "COMPLETED"
    assert run.finding_count == len(run.findings)
    return run
` })}
<p><code>run_now</code> also checks two things true of every run whatever else is in it: it completed, and its count agrees with its list. Facts that hold regardless of other tests’ data are called <strong>invariants</strong>, and they are the safe things to assert about a shared result.</p>
<p>Back in the test, <code>[finding] = …</code> is list unpacking with exactly one name. Python raises an error unless the list has exactly one item, so this line also asserts “exactly one finding for my enrolment”: not zero, which would mean the difference was missed, and not two, which would mean it was reported twice.</p>
${keyIdea(`<p>When a result covers the whole system, plant one difference that only your test owns, filter the result down to it, and assert only invariants about the rest.</p>`)}

<h2>The case where nothing should be found</h2>
<p>Two tests check that no finding appears when none should. One leaves the records matching and expects an empty list for its enrolment. The other adds a card and runs reconciliation at once, while the enrolment is still waiting for its callback:</p>
${code({ title: 'tests/api/tests/reconciliation/test_reconciliation.py (part)', src: `
    someone = make_customer(customer(card()))
    added = expect(someone.wallet.add(someone.card_ids[0]), 202, WalletCard)

    run = run_now(reconciliation)

    assert findings_for(run, added.enrollment.enrollment_id) == []
    assert run.skipped_in_flight >= 1
` })}
<p>At that moment the two sides really do differ, and that is expected: the operator has not answered yet. The spec says such in-flight enrolments are skipped, not reported. The count uses <code>&gt;= 1</code>, not <code>== 1</code>, because other tests may have enrolments in flight at the same moment.</p>

<h2>When the file cannot be fetched</h2>
<p>The last test makes the operator’s file endpoint fail, using the generic fault control every service has, and expects the run to fail cleanly with <code>502 OPERATOR_FILE_UNAVAILABLE</code>, stored as <code>FAILED</code> with no findings. An error is better than an empty report here: “no differences” and “could not check” must never look the same. Because a fault affects every caller of the operator, this one test is <a href="/learn/suite-parallel-serial/">serial</a>.</p>
${testerEye(`<p>For any check that compares two systems, test that it reports each kind of difference, that it stays silent when they agree, that expected temporary differences are skipped, and that it fails loudly when it cannot see one side.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Finding', 'One difference a reconciliation run reports, with a type and both sides’ values.'],
  ['System of record (SOR)', 'The bank’s authoritative copy of enrolments, compared with the operator’s.'],
  ['Upsert', 'Update a record if it exists, insert it if it does not.'],
  ['Invariant', 'A fact that must hold whatever other data is present, such as a count matching its list.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'Tests run in parallel. A reconciliation test asserts `run.finding_count == 1`. What happens?',
  options: ['It always passes', 'It fails whenever another test’s planted difference is in the same run', 'It always fails', 'The run refuses to start'],
  answer: 1,
  why: '<p>A run covers every enrolment. Other tests plant differences at the same time, so the total varies. Filtering to the test’s own enrolment is what makes the assertion stable.</p>',
})}
${check({
  q: '`[finding] = findings_for(run, my_id)` raises an error. What could have happened?',
  options: ['The run failed to start', 'There were zero findings for that enrolment, or more than one', 'The finding type was wrong', 'The id was a string'],
  answer: 1,
  why: '<p>Unpacking into one name needs exactly one item. Zero means the difference was missed; two means it was reported twice. Either is a real failure.</p>',
})}
${check({
  q: 'Why should an unreachable operator file make the run fail, instead of completing with no findings?',
  options: ['To keep the database small', 'Because “no differences” would falsely say the systems agree, when in fact nothing was compared', 'Because the spec has no other error', 'It does not matter'],
  answer: 1,
  why: '<p>An empty report is a strong claim. If the comparison did not happen, the honest result is a failure that someone will notice and investigate.</p>',
})}

<h2>Recap</h2>
${recap([
  'Each test plants one difference in the operator’s records for its own enrolment.',
  'Filter the run’s findings to your enrolment; assert only invariants about the rest.',
  '`[finding] = …` asserts there is exactly one.',
  'Test silence when records agree, skipping of in-flight enrolments, and a clear failure when the file is unavailable.',
])}
`,
};
