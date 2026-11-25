import { figure, keyIdea, testerEye, realWorld, terms, check, recap, terminal } from '../../src/components.mjs';
import { stageReading } from '../diagrams/suite.mjs';

export default {
  minutes: 12,
  lede: 'Locally and in CI, CardVault runs with no known defects, and the suite is expected to be fully green. Stage is different on purpose: it is a shared machine where known defects are switched on, so a correct suite goes red there. This lesson shows how to point the suite at stage, how to run it gently, and how to read a red result as findings instead of noise.',
  youWill: 'You will learn what changes when the suite runs against stage, why it runs there with only two workers, and a short routine for deciding whether a red test is a defect, a test problem or the environment.',
  body: `
<h2>What stage is for</h2>
<p>Stage is a full CardVault on a small cloud machine, reachable only through an SSH tunnel (the first track’s <a href="/learn/running-cardvault/">Running CardVault yourself</a> describes the two places it runs). It exists to give the suite something to find. Several known defects are switched on there, so a run against stage is a rehearsal of real testing: the suite reports failures, and you work out what each one means.</p>
<p>That gives the two environments opposite expectations. Locally and in CI, every red test is a problem to fix today. On stage, some red tests are the suite doing its job.</p>

<h2>Pointing the suite at stage</h2>
<p><a href="/learn/suite-settings/">Settings and environments</a> showed the mechanism: <code>TEST_ENV=stage</code> loads the committed <code>envs/stage.env</code> (the tunnel’s local addresses, a longer HTTP timeout) and the untracked <code>.env.stage</code>, which holds the stage keys. Those keys come from the person who runs stage and never go into the repository. With the tunnel open and the keys in place:</p>
${terminal([
  ['TEST_ENV=stage uv run pytest -n 2', 'CardVault environment: stage (auth at http://127.0.0.1:18001)\nParallel run: serial tests are left out; run them with: pytest -m serial\n…'],
  ['TEST_ENV=stage uv run pytest -m serial', '…'],
], 'Running against stage')}
<p>Check the first line every time: it names the environment and the address the run is really using. The results that follow depend on which defects are switched on at the time, so they are not shown here.</p>

<h2>Running a test from this site</h2>
<p>You can also run a test on stage without a tunnel or a terminal. Every lesson excerpt of a test has a <strong>Run on stage</strong> button, and so does each test in the <a href="/suite/">suite explorer</a>. The button opens a page on the stage machine itself, which asks for the tools password, runs that test with pytest using <code>TEST_ENV=vm</code> (stage’s addresses as seen from the machine itself), and shows pytest’s output as it arrives.</p>
<p>It is the same suite and the same command as above, run one test or one file at a time. The page allows one run at a time, because each run resets and reseeds stage first and two at once would disturb each other.</p>

<h2>Running gently</h2>
<p>Two settings reflect that stage is small and shared:</p>
<ul>
<li><strong>Two workers, not one per core.</strong> The stage machine has two processor cores and runs the whole stack. <code>-n auto</code> on a powerful laptop could start many workers whose requests queue up on stage, turning slowness into timeouts that look like failures. <code>-n 2</code> keeps the load in proportion.</li>
<li><strong>A longer timeout.</strong> <code>HTTP_TIMEOUT_SECONDS=20</code> in <code>envs/stage.env</code>, double the local value, because calls travel through the tunnel to a busier machine.</li>
</ul>
<p>Stage also starts like local: the run resets and reseeds it (<code>RESET_AT_START=true</code>). That makes expected values valid, but it also wipes whatever anyone else was doing on stage, so a stage run is something to agree on, not to start casually.</p>

<h2>Reading a red result</h2>
${figure({ svg: stageReading(), caption: 'The same tests, two targets. A quick comparison with a local run sorts most stage failures before you read any evidence.' })}
<p>A short routine sorts most failures:</p>
<ol>
<li><strong>Compare with local.</strong> If the test passes locally (and in CI) but fails on stage, the code under test differs between the two, and a switched-on defect is the likely reason. If it fails in both places, look at the test or the code first.</li>
<li><strong>Look at the kind of failure.</strong> A wrong value or a wrong status is a statement about behaviour. A timeout alone, especially in a burst, says more about load or the tunnel; re-run that file alone before concluding anything.</li>
<li><strong>Read the evidence.</strong> The <a href="/learn/suite-evidence/">request list and correlation IDs</a> show what CardVault actually answered. Write down the observed behaviour and the spec rule it breaks, which is what a defect report needs.</li>
</ol>
<p>Note what the routine does not do: it never changes an assertion to make stage green. The expected values come from the spec; when stage disagrees, stage is what has to explain itself.</p>
${keyIdea(`<p>Stage is meant to fail. Run the same suite against it with fewer workers, then sort each red test by comparing with a local run, looking at the kind of failure, and reading the evidence against the spec.</p>`)}
${testerEye(`<p>A red test is a claim, not a verdict. Before reporting a defect, make sure the same test is green where the defect is absent, and that the failure message names a rule the spec actually states.</p>`)}
${realWorld(`<p>Real stage environments are shared by many teams, with data and deployments changing underneath the tests. Teams there tag which failures are known, track them as defects, and treat a new red as the signal worth attention.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Stage', 'A shared, deployed CardVault with known defects switched on, for practising real test runs.'],
  ['SSH tunnel', 'A secure connection that makes the stage machine’s ports appear on your own computer.'],
  ['Known defect', 'A fault deliberately present in an environment, which a correct test should detect.'],
  ['Triage', 'Sorting failures by likely cause before investigating each one in depth.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test is red on stage and green locally and in CI, with a clear wrong-value message. What is the most likely explanation?',
  options: ['The test is flaky', 'A known defect on stage, since the same test passes where none are switched on', 'The tunnel is down', 'The settings file is wrong'],
  answer: 1,
  why: '<p>The test and the expected value are the same in both places. What differs is the system, and stage is where defects are switched on. Reading the evidence then confirms which rule is broken.</p>',
})}
${check({
  q: 'You run `TEST_ENV=stage uv run pytest -n auto` on a 12-core laptop and see dozens of timeouts. What should you try first?',
  options: ['Raise every timeout to 120 seconds', 'Re-run with `-n 2`, because many workers overload the small stage machine', 'Mark the tests serial', 'Report the timeouts as defects'],
  answer: 1,
  why: '<p>Bursts of timeouts on a small shared machine point at load. Running with the intended two workers removes that cause; any failure left after that deserves a closer look.</p>',
})}
${check({
  q: 'Someone suggests changing an assertion so a test passes on stage. Why is that wrong?',
  options: ['It is fine if it is documented', 'The expected value comes from the spec; making stage green would hide the defect the test found', 'Assertions cannot be changed', 'It would break local runs only'],
  answer: 1,
  why: '<p>On stage, red is the suite reporting a real difference from the spec. Changing the test to match the system turns a finding into a false pass.</p>',
})}

<h2>Recap</h2>
${recap([
  'Locally and in CI everything should be green; stage has known defects and should not be.',
  '`TEST_ENV=stage` with `-n 2`, the tunnel open and the keys in `.env.stage`.',
  'A stage run resets and reseeds stage, so agree on it first.',
  'The Run on stage buttons run one test or file on stage from this site, one run at a time.',
  'Sort a red test: compare with local, look at the kind of failure, read the evidence against the spec.',
])}
`,
};
