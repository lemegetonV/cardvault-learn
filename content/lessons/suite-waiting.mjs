import { figure, keyIdea, testerEye, terms, check, recap, code } from '../../src/components.mjs';
import { sleepVsPoll } from '../diagrams/suite.mjs';

export default {
  minutes: 12,
  lede: 'A lot of CardVault’s work finishes after the response has gone back: the operator calls back about two seconds later, events travel through Kafka, the outbox relay delivers in the background. A test that checks straight away sees the work half done. This lesson shows how the suite waits for that work without guessing how long it takes.',
  youWill: 'You will learn why a fixed sleep is both slow and flaky, how `wait_until` polls with a deadline, how to read its failure message, and how to test that something did not happen.',
  body: `
<h2>Why sleeping is the wrong tool</h2>
<p>The obvious way to wait is <code>time.sleep(3)</code>: pause for a while, then check. The trouble is that “a while” is a guess. On a fast day the work is done in one second and the test wastes two. On a slow day, say a busy CI machine, the work takes 3.6 seconds and the test fails, though CardVault behaved perfectly.</p>
${figure({ svg: sleepVsPoll(), caption: 'A fixed sleep is too long on a fast day and too short on a slow one. Polling stops as soon as the answer is right.' })}
<p>Making the sleep longer only trades the second problem for a worse first one: every test becomes as slow as the slowest day. The suite therefore has one rule, written in its README: wait, never sleep.</p>

<h2>Polling with a deadline</h2>
<p><strong>Polling</strong> means asking again and again until the answer is right. The suite’s version is one small function:</p>
${code({ title: 'tests/api/src/cardvault_tests/waits.py (part)', src: `
def wait_until(
    probe: Callable[[], T],
    done: Callable[[T], bool],
    *,
    timeout: float = 15.0,
    interval: float = 0.25,
    what: str = "condition",
) -> T:
    """Call \`\`probe()\`\` until \`\`done(result)\`\` is true; return that result."""
    deadline = time.monotonic() + timeout
    last: T | None = None
    while True:
        last = probe()
        if done(last):
            return last
        if time.monotonic() >= deadline:
            raise WaitTimeout(f"{what} not reached within {timeout}s; last value: {last!r}")
        time.sleep(interval)
` })}
<ul>
<li><code>probe</code> is a function that looks at the system, usually one API call. <code>done</code> is a function that judges what the probe returned. Keeping them apart means the function can return the last thing the probe saw, so the test can go on to assert on it.</li>
<li>The <code>*</code> in the parameter list makes everything after it keyword-only: callers must write <code>timeout=10</code>, which keeps calls readable.</li>
<li><code>time.monotonic()</code> is a clock that only moves forward, unaffected by changes to the computer’s time. It is real time, not CardVault’s <a href="/learn/suite-moving-time/">shared clock</a>, which is right: how long to wait is a real-world question.</li>
<li>When the deadline passes, <code>WaitTimeout</code> (a kind of <code>AssertionError</code>, so pytest reports a normal failure) names what was awaited and the last value seen.</li>
</ul>
<p>The short <code>time.sleep(interval)</code> inside is not a guess about the work; it only spaces out the questions so the test does not hammer the service.</p>

<h2>Waiting for an enrolment</h2>
<p>Adding a card to the wallet answers <code>202</code> with status <code>PENDING</code>; the operator’s callback makes it <code>ENROLLED</code> about two seconds later (the first track’s <a href="/learn/enrolment/">enrolment</a> lesson steps through it). The suite wraps that wait in a named helper:</p>
${code({ title: 'tests/api/src/cardvault_tests/wallet.py (part)', src: `
def wait_for_enrolment(
    customer: Customer, card_id: object, status: str, timeout: float = 20.0
) -> WalletCard:
    return wait_until(
        lambda: wallet_card(customer, card_id),
        lambda c: c.enrollment is not None and c.enrollment.status == status,
        timeout=timeout,
        what=f"enrolment of card {card_id} to become {status}",
    )
` })}
<p>A <code>lambda</code> is a small function written inline: <code>lambda c: c.enrollment.status == status</code> takes one argument, <code>c</code>, and returns the comparison. The probe reads the customer’s wallet card; the done check accepts it once the enrolment has the wanted status. Used in a test:</p>
${code({ title: 'tests/api/tests/enrolment/test_add_and_remove.py (part)', src: `
    added = expect(someone.wallet.add(card_id), 202, WalletCard)
    assert added.enrollment.status == "PENDING"

    enrolled = wait_for_enrolment(someone, card_id, "ENROLLED")
` })}
<p>If the callback never comes, the failure reads like <code>enrolment of card 7c1e… to become ENROLLED not reached within 20.0s; last value: WalletCard(… status='PENDING' …)</code>. That already says a lot: the request was accepted and the card stayed pending, so the place to look is the operator call or its callback, not the add request.</p>

<h2>Choosing the timeout</h2>
<p>The timeout is the most anyone should ever have to wait, not the usual time. The enrolment wait allows 20 seconds for work that normally takes about two, because a loaded machine can be several times slower and a pass costs only the real time taken. The cost of a generous timeout falls only on failing tests, which wait the full time before reporting.</p>
<p>A timeout is never a fix. If a test starts timing out, the first question is why the work got slower or stopped, not how much more time to give it.</p>

<h2>Waiting for something not to happen</h2>
<p>“A plain card purchase must not appear in the wallet history” is a claim about absence, and absence has no moment at which it is finished. Waiting ten seconds and seeing nothing proves only that nothing arrived in ten seconds. The suite uses a <strong>marker</strong> instead: it does something afterwards that travels the same path, waits for that, and then checks the first thing is missing.</p>
${code({ title: 'tests/api/tests/transactions/test_transaction_status.py (part)', src: `
    plain = expect(card_network.purchase(own.card_id, 700), 200, Authorization)
    marker = wallet_purchase(card_network, own, 800)

    wait_for_transaction(someone, marker.trace_id)

    assert find(someone, plain.trace_id) is None
` })}
<p>This works because events for one card are published in order (the outbox keeps them in order per card). Once the later wallet purchase is visible, the earlier plain purchase would have been processed too, so its absence now means something.</p>
${keyIdea(`<p>Wait for a condition, not for a length of time. Poll with a generous deadline, fail with the last value seen, and prove absence with a marker that follows the same path.</p>`)}
${testerEye(`<p>When a wait fails, read the last value before anything else. “Still PENDING” and “now FAILED” point to completely different causes, and neither is fixed by a longer timeout.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Polling', 'Asking the system again and again until the answer is right or a deadline passes.'],
  ['`wait_until`', 'Suite helper: poll `probe` until `done` accepts its result; fail with the last value at the timeout.'],
  ['Timeout', 'The longest a wait may last: a limit for failures, not the expected time.'],
  ['`lambda`', 'A small inline function, such as `lambda c: c.status == "ENROLLED"`.'],
  ['Marker (for absence)', 'A later action on the same path; once it is visible, an earlier one would have been too.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test sleeps 2 seconds after adding a card, then expects ENROLLED. It passes locally and fails in CI one run in ten. What is the best change?',
  options: ['Sleep 5 seconds', 'Poll with `wait_for_enrolment`, which returns as soon as the card is ENROLLED and fails only after 20 seconds', 'Retry the whole test on failure', 'Mark it serial'],
  answer: 1,
  why: '<p>The work sometimes takes longer than 2 seconds on CI. A longer sleep would slow every run and could still be too short. Polling finishes as soon as the work does and leaves a wide margin for slow days.</p>',
})}
${check({
  q: '`wait_until` times out with `last value: WalletCard(… status=\'FAILED\' …)`. What does that tell you?',
  options: ['The timeout was too short', 'The enrolment finished, but with a different outcome, so the cause is in the flow, not the waiting', 'The service is down', 'Nothing useful'],
  answer: 1,
  why: '<p>FAILED is a final status, so more time would not help. The operator or callback reported a failure, and that is where to look.</p>',
})}
${check({
  q: 'To show a plain purchase never reaches the wallet history, a test waits 10 seconds, then checks the history. Why is that weak?',
  options: ['10 seconds is too long', 'It only proves nothing arrived within 10 seconds; on a slow day the purchase might still be on its way', 'The history cannot be read', 'Plain purchases are always visible'],
  answer: 1,
  why: '<p>Absence has no end point, so any fixed wait is a guess. A later marker on the same ordered path gives a real point after which the first purchase would have been visible.</p>',
})}

<h2>Recap</h2>
${recap([
  'Fixed sleeps are slow on good days and flaky on bad ones.',
  '`wait_until(probe, done, timeout=…, what=…)` polls and fails with the last value it saw.',
  'Timeouts are generous limits for failures; a timeout is never the fix.',
  'Prove absence with a marker that follows the same ordered path.',
])}
`,
};
