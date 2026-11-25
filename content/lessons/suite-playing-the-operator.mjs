import { figure, keyIdea, testerEye, realWorld, terms, check, recap, code } from '../../src/components.mjs';
import { operatorControlFlow } from '../diagrams/suite.mjs';

export default {
  minutes: 12,
  lede: 'The wallet operator belongs to another company, so the bank cannot make it fail when a test would like it to. CardVault’s operator is a mock with controls instead: a test can tell it to decline, return errors, or send its callbacks twice or in the wrong order. This lesson shows how the suite uses those controls to test how the bank copes, and why those tests run alone.',
  youWill: 'You will learn how a test switches a misbehaviour on for a limited number of calls, what outcome to expect for each kind of failure, and how to check what the operator actually sent.',
  body: `
<h2>A partner you can make misbehave</h2>
<p>A <strong>mock</strong> is a stand-in for a real system that a test can control. CardVault’s operator mock behaves like a well-run operator by default. Its <code>/test/behaviour</code> control changes that, and the suite wraps it in a small class:</p>
${code({ title: 'tests/api/src/cardvault_tests/clients/operator.py (part)', src: `
    def behave(self, *controls: dict[str, Any]) -> httpx.Response:
        """Replace every control; no arguments turns them all off."""
        return self.http.post("/test/behaviour", json={"controls": list(controls)}, auth=self.auth)
` })}
<p><code>*controls</code> gathers any number of positional arguments into a tuple, so a test can pass one control or several. Each control is a small dictionary: a <code>type</code> of misbehaviour, and optionally a <code>scope</code> (which calls it affects) and <code>fail_next</code> (how many calls before it switches itself off).</p>
${figure({ svg: operatorControlFlow(), caption: 'Every operator-failure test has this shape. Step 5 is the fixture’s clean-up, so it runs even when step 4 fails.' })}

<h2>Each failure, and what the bank should do</h2>
<p>The spec says how the bank must react to each kind of trouble, so each test’s expectation comes straight from it:</p>
${code({ title: 'tests/api/tests/enrolment/test_operator_failures.py (part)', src: `
ENROL = {"method": "POST", "path": "/v1/enrollments"}


def test_a_short_outage_is_retried_and_the_card_still_enrols(make_customer, operator):
    expect_status(operator.behave({"type": "error", "fail_next": 2, "scope": ENROL}), 200)
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]

    expect(someone.wallet.add(card_id), 202, WalletCard)

    wait_for_enrolment(someone, card_id, "ENROLLED")


@pytest.mark.slow
def test_a_long_outage_ends_failed_after_five_attempts(make_customer, operator):
    expect_status(operator.behave({"type": "error", "status": 503, "scope": ENROL}), 200)
    someone = make_customer(customer(card()))
    card_id = someone.card_ids[0]

    expect(someone.wallet.add(card_id), 202, WalletCard)

    failed = wait_for_enrolment(someone, card_id, "FAILED", timeout=30)
    assert failed.enrollment.status_reason == "OPERATOR_UNAVAILABLE"
` })}
<p>The pair tests both sides of the retry rule. Two failures, then success: the bank’s retries must carry the card through to <code>ENROLLED</code>, with nothing visible to the customer but a short delay. Failures that never stop: after five attempts the bank must give up and record <code>FAILED</code> with the reason <code>OPERATOR_UNAVAILABLE</code>. Retries use real time with growing gaps, so the second test waits up to 30 seconds and carries the <code>slow</code> marker.</p>
<p><code>fail_next</code> matters. A control that stayed on forever would also break the operator calls of the next part of the test, or of the next test. Limiting it to the calls under test keeps the failure exactly where it is wanted.</p>

<h2>Checking what the operator sent</h2>
<p>When the operator sends the same callback twice, the bank should apply it once. To prove that, a test needs evidence from both sides: what the operator sent, and what the bank did. The mock records every callback it sends, with the bank’s reply:</p>
${code({ title: 'tests/api/tests/enrolment/test_operator_failures.py (part)', src: `
    sent = wait_until(
        lambda: operator.sent_callbacks(enrolment_id),
        lambda cbs: len(cbs) == 2,
        what="the operator to send the callback twice",
    )

    assert sent[0]["event_id"] == sent[1]["event_id"], "a redelivery keeps its event_id"
    assert [c["delivery"] for c in sent] == [200, 200], "both are acknowledged"
    changes = [h for h in enrolments.history(enrolment_id) if h["source"] == "CALLBACK"]
    assert [(h["from_status"], h["to_status"]) for h in changes] == [("PENDING", "ENROLLED")]
` })}
<p>The first two assertions confirm that the duplicate really happened: the same event, sent twice, both accepted. Without them, a passing test could mean the mock never sent the second copy at all. The last assertion is the actual rule: the bank’s history shows exactly one change caused by a callback.</p>
${keyIdea(`<p>When a test makes a partner misbehave, first check that the misbehaviour actually happened, then check the bank’s reaction. Otherwise a test can pass because nothing unusual occurred.</p>`)}

<h2>Why these tests run alone</h2>
<p>The operator mock is one shared service. While a test has it returning errors, every other test that enrols a card would meet those errors too. So the whole file is marked <code>serial</code> (see <a href="/learn/suite-parallel-serial/">Parallel and serial tests</a>), and the <code>operator</code> fixture switches every control off after each test, pass or fail.</p>
<p>Not every operator test needs that. Changing the operator’s <em>records</em>, which the next lesson uses, touches only the records of the test’s own fresh enrolments, so those tests use a separate fixture, <code>operator_state</code>, with no clean-up of the controls, and run in parallel.</p>
${testerEye(`<p>For every external partner, list the ways it can fail: refuse, error, time out, repeat itself, answer late or out of order. Each one should have a test with the bank’s expected reaction, taken from the spec, not from what the bank happens to do.</p>`)}
${realWorld(`<p>A real operator offers a sandbox at best, and it rarely lets you order a timeout on the next call. Teams then rely on a mock like this one, or on fault-injection tools in front of the real sandbox, and keep a small number of tests against the real partner to catch differences between the two.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Mock', 'A controllable stand-in for a real system, used so tests can create situations the real one would not.'],
  ['`fail_next`', 'How many matching calls a control affects before it switches itself off.'],
  ['Scope', 'Which calls a control applies to, by method and path.'],
  ['Retry with back-off', 'Trying again after a failure, with growing gaps, up to a fixed number of attempts.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test switches on `duplicate_callback`, adds a card, and asserts only that the bank’s history shows one callback change. Why is that not enough?',
  options: ['It is enough', 'If the mock never sent the duplicate, the test passes without testing anything; it must also confirm two identical callbacks were delivered', 'History is not reliable', 'It should assert two changes'],
  answer: 1,
  why: '<p>“One change” is also what happens when there is no duplicate at all. Checking the operator’s record of what it sent proves the situation under test really occurred.</p>',
})}
${check({
  q: 'The operator returns errors on the next two enrolment calls only. What should the customer’s card end as?',
  options: ['FAILED with OPERATOR_UNAVAILABLE', 'ENROLLED, because the bank retries and the third attempt succeeds', 'PENDING for ever', 'REMOVED'],
  answer: 1,
  why: '<p>The bank retries up to five attempts. Two failures leave attempts to spare, so the enrolment completes normally, just a little later.</p>',
})}
${check({
  q: 'Why does the short-outage test set `fail_next: 2` instead of leaving the error control on?',
  options: ['It is faster', 'With errors that never stop, every retry would fail too and the card would end FAILED, so the test could not show that retries recover', 'The mock requires fail_next', 'There is no difference'],
  answer: 1,
  why: '<p>The claim is “a short outage is survived”. That needs failures that end. The long-outage test leaves errors on deliberately, because there the claim is “the bank gives up after five attempts”.</p>',
})}

<h2>Recap</h2>
${recap([
  'The operator mock’s `/test/behaviour` makes it decline, fail, repeat or reorder on purpose.',
  'Each failure’s expected reaction comes from the spec: retry, give up as FAILED, apply once, ignore the old.',
  'Check the misbehaviour happened (the mock’s record), then check the bank’s reaction.',
  'Behaviour controls are shared, so those tests are serial; record changes are not.',
])}
`,
};
