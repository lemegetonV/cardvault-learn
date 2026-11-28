import { code, terminal, interview, table, keyIdea, shot, testerEye } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'A passing test tells you little. A failing one is where the work starts, and Playwright gives you a lot to work with: a precise error, a log of what it tried, the line that failed, a screenshot and a recording. This lesson breaks your first test on purpose and reads every part of the result.',
  youWill: 'You will be able to read a Playwright failure from top to bottom and decide whether the app or the test is wrong.',
  body: `
<h2>Break it on purpose</h2>
<p>Take <a href="/learn/pw-first-test/">your first test</a> and change the heading it expects from “Checkout wallet” to “My wallet”. Only the last line changes:</p>
${code({ lang: 'typescript', title: 'Example · learn/first-test.spec.ts, last line changed', src: `
  await expect(page.getByRole('heading', { name: 'My wallet' })).toBeVisible();
` })}
<p>Run it. This is the real output, with a few long divider lines shortened and the trace instructions left out:</p>
${terminal([['npx playwright test learn/first-test.spec.ts', `  ✓  1 [setup] › learn/saved-login.setup.ts:5:1 › sign in as alice and save the login (558ms)
  ✘  2 [learn] › learn/first-test.spec.ts:6:1 › alice can sign in and see her wallet (5.7s)

  1) [learn] › learn/first-test.spec.ts:6:1 › alice can sign in and see her wallet ─────────────────

    Error: expect(locator).toBeVisible() failed

    Locator: getByRole('heading', { name: 'My wallet' })
    Expected: visible
    Timeout: 5000ms
    Error: element(s) not found

    Call log:
      - Expect "toBeVisible" getByRole('heading', { name: 'My wallet' }) with timeout 5000ms
      - waiting for getByRole('heading', { name: 'My wallet' })


      12 |
      13 |   await expect(page).toHaveURL('/wallet');
    > 14 |   await expect(page.getByRole('heading', { name: 'My wallet' })).toBeVisible();
         |                                                                  ^
      15 | });
      16 |
        at /home/user/cardvault/tests/ui/learn/first-test.spec.ts:14:66

    attachment #1: screenshot (image/png) ─────────────────────────────────────────
    test-results/first-test-alice-can-sign-in-and-see-her-wallet-learn/test-failed-1.png

    Error Context: test-results/first-test-alice-can-sign-in-and-see-her-wallet-learn/error-context.md

    attachment #3: trace (application/zip) ────────────────────────────────────────
    test-results/first-test-alice-can-sign-in-and-see-her-wallet-learn/trace.zip

  1 failed
    [learn] › learn/first-test.spec.ts:6:1 › alice can sign in and see her wallet
  1 passed (7.2s)`]], 'Real output')}

<h2>Read it from the top</h2>
<ol>
<li><strong>Which test.</strong> The <code>✘</code> line names the project, the file and line where the test starts, and the test name. 5.7 seconds is long for this test, a first hint that something waited.</li>
<li><strong>Which check.</strong> <code>expect(locator).toBeVisible() failed</code> says the failure is an assertion, not a crash.</li>
<li><strong>What it looked for, and what it got.</strong> The locator, what was expected (<code>visible</code>), how long it kept trying (<code>5000ms</code>, the default for assertions), and the reason: <code>element(s) not found</code>. Nothing on the page matched “a heading called My wallet” at any time in those 5 seconds.</li>
<li><strong>The call log.</strong> Each step Playwright took for this check. Here it is short: it waited for the heading and never found it. In other failures the log shows things like “element is not visible” or “element is disabled”, which tell you exactly what blocked an action.</li>
<li><strong>Where.</strong> A few lines of your file with a <code>&gt;</code> on line 14 and a caret under the failed call.</li>
<li><strong>The evidence.</strong> Paths to a screenshot taken at the moment of failure, a page snapshot (<code>error-context.md</code>), and a trace: a recording of the whole test. The settings file asks for these on failure only.</li>
</ol>

<h2>The same failure in the HTML report</h2>
<p><code>npx playwright show-report</code> shows the same error with every step and its timing, and the screenshot below it:</p>
${shot({ src: 'pw-report-failure.png', alt: 'The HTML report for the failed test: the error, a list of steps where only the last expect is marked failed after 5.0 seconds, and the screenshot showing the Checkout wallet page.', caption: 'Every step passed except the last check, which used its full 5 seconds. The screenshot shows the page at that moment: a heading that says Checkout wallet.' })}
<p>The steps list makes the timing obvious: everything took milliseconds except the failed check, which spent 5.0 seconds waiting. “View Trace” opens the recording, which the lesson on <a href="/learn/pw-debugging/">debugging</a> covers.</p>

<h2>Who is wrong: the app or the test?</h2>
<p>A failure means the app and the test disagree. It does not say which one is right. Look for evidence that tells the two apart:</p>
<ul>
<li><strong>The screenshot</strong> shows the wallet page with the heading “Checkout wallet”. So the sign-in worked and the page loaded; only the expected name differs.</li>
<li><strong>The page snapshot</strong> in <code>error-context.md</code> lists every heading, link and button on the page as text, so you can search it for the name you expected.</li>
<li><strong>The requirement</strong> decides. CardVault’s wallet page is called “Checkout wallet”, so the test is wrong. If the product had renamed the page to “My wallet” and the screen still said “Checkout wallet”, the same output would be a real bug.</li>
</ul>

${keyIdea('<p>Read a failure in order: which test, which check, what it expected, why it failed, where, then the evidence. Then decide from the screenshot, the snapshot and the requirement whether the app or the test is wrong.</p>')}

<h2>Failures you will meet</h2>
${table(['The error says', 'It usually means'], [
  ['`element(s) not found`', 'The locator matches nothing: wrong name or text, wrong page, or the element never appeared'],
  ['`Expected: ... Received: ...`', 'The element or page was found, but its value was different, for example the address in `toHaveURL`'],
  ['`strict mode violation ... resolved to 4 elements`', 'The locator matches several elements, so Playwright will not guess which one to act on'],
  ['`Test timeout of 30000ms exceeded`', 'An action kept waiting (for an element that never became ready) until the whole test ran out of time'],
])}
<p>All four were seen while building this suite. The first is above; the second is in <a href="/learn/pw-async-await/">the lesson on await</a>; the third is in <a href="/learn/pw-narrowing/">narrowing a match</a>. The last one is the slowest to read: when an action such as <code>click()</code> waits, it is limited by the test’s 30-second timeout, not the 5-second assertion timeout, so check the call log for what it was waiting for.</p>

${testerEye('<p>Never “fix” a failing test by copying the value the app shows into the assertion. First decide what the right value is from a requirement or known data. Otherwise the test agrees with whatever the app does, including its bugs.</p>')}

${interview({
  say: `<p>“When a Playwright test fails I read the error from the top: which assertion, the locator, expected against received, and the timeout. The call log shows what Playwright waited for. Then I look at the evidence: the screenshot at failure, the page snapshot and the trace. The requirement decides whether the app or the test is wrong; I never just copy the app’s current value into the test.”</p>`,
  qa: [
    ['A test fails with “element(s) not found”. What do you check?', '<p>First the screenshot or trace: is the test on the page I expect, and is the element there under a different name? Then the locator: role, name and text. Then timing: did the element appear later than the timeout, or never? Each answer points to a different cause: a wrong locator, a wrong page, a slow app or a real bug.</p>'],
    ['What evidence does Playwright give you for a failed test?', '<p>The error with expected and received values, the call log, the code frame, and, depending on the config, a screenshot, a page snapshot, a video and a trace: a recording of every action with the page, network and console at each step. The HTML report puts them together.</p>'],
    ['How long does an assertion wait before failing?', '<p>A web-first assertion keeps retrying for 5 seconds by default, set by <code>expect.timeout</code> in the config or per assertion with <code>{ timeout }</code>. Actions such as <code>click()</code> have no time limit of their own by default and are bounded by the test timeout, 30 seconds by default.</p>'],
  ],
})}
`,
};
