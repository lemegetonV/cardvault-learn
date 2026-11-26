import { code, terminal, interview, keyIdea, testerEye, table } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'A flaky test passes on one run and fails on the next with no change to the code. Flaky tests are dangerous because people learn to ignore red. This lesson covers why tests flake, how the suite avoids it, when a rerun is honest, and how to make the suite faster by running tests in parallel.',
  youWill: 'You will be able to name the common causes of flaky tests, explain waiting versus sleeping, and run the suite in parallel with pytest-xdist.',
  body: `
<h2>Why tests flake</h2>
${table(['Cause', 'What happens', 'How the suite avoids it'], [
  ['Timing', 'The test checks before a background step has finished', 'Poll with a deadline, never a fixed sleep'],
  ['Shared data', 'Another test changed the data this one relies on', 'Shared data is read-only; changers get a fresh customer'],
  ['Left-over state', 'Earlier runs left something behind', 'Unique values every run'],
  ['Order', 'A test only passes after another one has run', 'Every test makes its own starting state'],
  ['Environment', 'A service is slow or restarting', 'Timeouts on every call, and a clean app in CI'],
])}
<p>Each of these is a real cause with a real fix. “It is just flaky” is not a diagnosis.</p>

<h2>Waiting, not sleeping</h2>
<p>When a result arrives later, the suite asks again every half second until it appears or ten seconds pass, as you saw in <a href="/learn/py-flow-test/">A flow test</a>:</p>
${code({ title: 'tests/api/helpers.py', src: `
def wait_for_wallet_status(wallet_api, card_id, expected_status, timeout=10):
...
    deadline = time.time() + timeout
    status = None
    while time.time() < deadline:
        response = wallet_api.get_card(card_id)
        status = response.json()["enrollment"]["status"]
        if status == expected_status:
            return
        time.sleep(0.5)
    raise AssertionError(
        f"Wallet status was {status}, expected {expected_status} within {timeout}s"
    )
` })}
<p>The final message says what it last saw, so a failure tells you whether the status was stuck at <code>PENDING</code> or went somewhere unexpected.</p>

<h2>A flaky test found while writing this track</h2>
<p>The <a href="/learn/py-test-data/">Test data</a> lesson told the story: a test passed five times and failed on the sixth, because each run added a failed login to the same made-up username until it was locked. It looked random. It was left-over state, and the fix was a unique name per run. A rerun would have hidden it for a while and then it would have come back.</p>

<h2>When is a rerun honest?</h2>
<p>A plugin such as pytest-rerunfailures can rerun failed tests automatically (<code>pytest --reruns 2</code>). That is reasonable only for a known cause outside your control, such as a shared environment that sometimes restarts, and only while the cause is being fixed. Used as a habit, reruns turn real bugs, including race conditions in the app itself, into green builds. The suite does not use reruns.</p>

<h2>Running tests in parallel</h2>
<p>The <strong>pytest-xdist</strong> plugin starts several worker processes and shares the tests out among them. <code>-n 4</code> means four workers; <code>-n auto</code> means one per CPU core.</p>
${terminal([
  ['pytest -q', '============================= 79 passed in 26.44s =============================='],
  ['pytest -q -n 4', '============================= 79 passed in 12.38s =============================='],
], 'Terminal')}
<p>On this machine four workers cut the run from about 26 seconds to about 12. CI uses <code>-n 4</code> too.</p>

<h2>Why the suite is safe to run in parallel</h2>
<p>Parallel runs expose every hidden dependency between tests, because tests now run at the same time and in a different order. The suite is safe because of rules you already know:</p>
<ul>
<li>Tests that change data each create their own customer, so two workers never touch the same records.</li>
<li>alice is read-only, so every worker can read her at once.</li>
<li>Session fixtures run once <em>per worker</em>, so with four workers alice logs in four times. That is fine for a read-only login, but a session fixture that created shared data would need care.</li>
</ul>

${keyIdea('<p>Flaky tests have causes: timing, shared data, left-over state, order and environment. Fix the cause. Tests that own their data can run in any order and in parallel.</p>')}

${testerEye('<p>A good check before trusting a new test: run it many times in a row and in parallel, for example with a short shell loop around <code>pytest -n 4</code>. If it ever fails, find out why before merging.</p>')}

${interview({
  say: `<p>“I treat flaky tests as bugs. The usual causes are timing, shared or left-over data, order dependence and the environment. My suite polls with a deadline instead of sleeping, gives every state-changing test its own customer, and makes remembered values unique. That isolation is also what lets us run with pytest-xdist on four workers, which took the run from 24 seconds to about 10. I only use reruns for a known external cause, and temporarily.”</p>`,
  qa: [
    ['How do you deal with a flaky test?', '<p>Reproduce it, by running it repeatedly, in parallel or in a different order. Find the cause: timing, data, order or environment. Fix the cause. Quarantine it only briefly, with a ticket, if it blocks others.</p>'],
    ['What do you need before running tests in parallel?', '<p>Independent tests: no shared mutable data, no order dependence, and set-up that is safe to run in several processes at once.</p>'],
    ['Why are automatic reruns risky?', '<p>They hide real problems, including race conditions in the product, and they make a slow suite slower. A pass after a rerun still means something failed.</p>'],
  ],
})}
`,
};
