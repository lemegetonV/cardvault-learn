import { figure, keyIdea, testerEye, realWorld, terms, check, recap, table } from '../../src/components.mjs';
import { outsideIn } from '../diagrams/suite.mjs';

export default {
  minutes: 8,
  lede: 'The first track explained how CardVault works. This track builds something that checks it: a suite of automated API tests written in Python with pytest. Before any code, this lesson sets out what the suite is for, where it stands, and where its expected answers come from.',
  youWill: 'You will learn what an outside-in API suite checks, the four ways it looks at CardVault, and the rule that every expected value must have a source.',
  body: `
<h2>A suite that tests from the outside</h2>
<p>An <strong>API test</strong> sends a request to a running service and checks the answer. A <strong>suite</strong> is many such tests, organised so they can run together, often hundreds at a time, and report clearly what passed and what failed.</p>
<p>CardVault’s suite tests the system the way a QA team tests something it did not build and cannot open: from the outside, through the same doors a client uses. It never imports CardVault’s own Python code. That matters, because a test that borrows the code it is checking tends to inherit that code’s mistakes. If the suite worked out a card’s balance with CardVault’s own function, a wrong function would produce a wrong expectation, and the test would pass.</p>
<p>The suite lives in the CardVault repository, in <code>tests/api/</code>, as a separate Python project with its own dependencies.</p>

<h2>Four ways to look in</h2>
${figure({ svg: outsideIn(), caption: 'The suite stands outside a running CardVault. HTTP is the main door; the other three are for facts HTTP cannot show.' })}
${table(['Door', 'Used for', 'Example'], [
  ['HTTP to the five bank services', 'Almost everything', 'Report a card lost, then read it back'],
  ['Controls on the two mocks', 'Making the outside world misbehave', 'The wallet operator declines the next enrolment'],
  ['Reading Kafka topics', 'Checking that an event was published, and its shape', 'A purchase publishes `auth.decided`'],
  ['Read-only SQL', 'Facts no API shows', 'A card number is stored encrypted'],
])}
<p>The order of that table is also an order of preference. An HTTP check is what a real client would see, so it is the strongest evidence that something works. The other doors are used only when the HTTP answer cannot settle the question.</p>

<h2>Where an expected value comes from</h2>
<p>Every test ends by comparing what happened with what should have happened. The second half is the hard part. In this suite, an expected value always has one of three sources:</p>
<ul>
<li><strong>The specification.</strong> CardVault’s <code>SPEC.md</code> says, for example, that a callback timestamp more than 5 minutes from the bank’s clock is refused with <code>401</code>.</li>
<li><strong>The test’s own setup.</strong> A test that creates a card with a 1,000.00 limit and approves a 10.00 purchase knows the card must have 990.00 available.</li>
<li><strong>The seed data.</strong> The seed customer alice always has the same four cards after a reset.</li>
</ul>
${keyIdea(`<p>An expected value is never copied from what the service returned last time. The service’s output is the thing under test; using it as the answer key would make every test pass, bugs included.</p>`)}

<h2>Local and stage</h2>
<p>The suite can point at two CardVault environments. <strong>Local</strong> is the stack on your own machine (or the one GitHub Actions starts for CI), with every bug flag off: there, every test must pass. <strong>Stage</strong> is a shared copy on a small cloud machine with some known defects switched on deliberately: there, some tests are meant to fail, and finding which ones is the exercise. <a href="/learn/suite-settings/">Settings and environments</a> shows how the suite switches between them.</p>
${testerEye(`<p>A suite that is green on a correct system and red on a broken one is doing its job. That is why the local run must stay green: a test that fails on a correct system is noise, and noise teaches people to ignore red.</p>`)}
${realWorld(`<p>Banks usually have several layers of tests owned by different teams. An outside-in API suite like this one sits between the developers’ unit tests and full end-to-end tests through a browser, and is often the main safety net before a release.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['API test', 'A test that sends a request to a running service and checks the answer.'],
  ['Suite', 'A set of tests organised to run together and report as one.'],
  ['Outside-in', 'Testing only through the doors a client uses, never with the system’s own code.'],
  ['Expected value', 'What a test says should happen, taken from the spec, the test’s setup or the seed data.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test needs the available balance a card should have after a purchase. Which source is right?',
  options: ['Call CardVault’s own `available()` function from the test', 'Work it out from the limit and purchases the test itself set up', 'Run the purchase once, note the balance, and paste it into the test', 'Read it from the card service’s database'],
  answer: 1,
  why: '<p>The test created the card and made the purchase, so it can work out the balance by hand. Borrowing CardVault’s function or pasting an earlier output would make the test agree with the system even when the system is wrong, and the database is a last resort for facts no API shows.</p>',
})}
${check({
  q: 'On stage, a test fails. On local, the same test passes. What does that most likely mean?',
  options: ['The test is flaky and should be retried', 'The test has found one of the defects switched on in stage', 'Stage is down', 'The local run is wrong'],
  answer: 1,
  why: '<p>Local runs with every defect off and must be green; stage has known defects on. A test that is green locally and red on stage is usually doing exactly what it should. It is still worth reading the failure, because a slow or unreachable stage can fail a test too.</p>',
})}

<h2>Recap</h2>
${recap([
  'The suite tests CardVault from the outside and never imports its code.',
  'HTTP is the main door; mock controls, Kafka and read-only SQL are for what HTTP cannot show.',
  'Every expected value comes from the spec, the test’s own setup or the seed data.',
  'Local must be green; stage has known defects on, so red there can be correct.',
])}
`,
};
