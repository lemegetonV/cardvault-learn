import { keyIdea, testerEye, realWorld, terms, check, recap, table, code } from '../../src/components.mjs';

export default {
  minutes: 9,
  lede: 'Two kinds of “something wrong” are built into CardVault on purpose. Faults are problems in the world around the code: a slow network, a service that answers 503, an event bus that refuses messages. Seeded bugs are mistakes planted in the code itself. They test different things, and a tester needs to keep them apart.',
  youWill: 'You will learn to inject faults precisely, and understand what seeded bugs are for and how to approach them.',
  body: `
<h2>Faults: when the world misbehaves</h2>
<p>Correct code can still meet a broken environment. A <strong>fault</strong> simulates that. CardVault’s code is expected to cope: retry, wait, or report a clear error, but never corrupt data. Faults let a test check that it does.</p>
${table(['Fault type', 'What it does', 'Typical use'], [
  ['`latency`', 'Adds `latency_ms` before handling a request', 'Loading states; timeouts in callers'],
  ['`error`', 'Answers with `status` (default 503) without handling the request', 'Error states; retries; outbox backoff'],
  ['`timeout`', 'Hangs for `timeout_ms` (default 30 s), then answers 504', 'Callers that give up and retry'],
  ['`kafka_publish_failure`', 'The service’s producer fails to publish', 'Events wait in the outbox, then go out in order'],
  ['`consumer_pause`', 'The service’s consumers stop reading', 'Eventual consistency; catching up'],
  ['`relay_pause`', 'The service’s outbox relays stop sending', 'Events held back, then delivered'],
])}
<p>Faults are set per service with <code>POST /test/faults</code>, which replaces that service’s whole set; <code>{"faults": []}</code> clears it, and so does a reset. A <code>scope</code> narrows an HTTP fault to a method and path (a path ending in <code>*</code> is a prefix) or a Kafka fault to a topic.</p>
${code({ lang: 'json', title: 'POST /test/faults on the enrollment service: fail the next two adds', src: `{
  "faults": [
    {
      "type": "error",
      "status": 503,
      "scope": { "method": "POST", "path": "/v1/wallet/cards/*" },
      "fail_next": 2
    }
  ]
}` })}
<p>As with the mocks, a fault fires on the next N matches (<code>fail_next</code>), on a seeded random share (<code>rate</code> plus <code>seed</code>), or on every match until cleared. Requests to <code>/test/…</code>, the health and readiness checks and the API docs are never affected, so a test can always switch a fault off again.</p>
${keyIdea(`<p>A fault test asks “does the system stay correct when its surroundings fail?”. The interesting assertions come <em>after</em> the fault is lifted: nothing was lost, nothing was applied twice, and the system recovered on its own.</p>`)}

<h2>Seeded bugs: when the code is wrong</h2>
<p>A test suite needs something to find. CardVault therefore contains a number of <strong>seeded bugs</strong>: realistic defects planted deliberately in its own code, of the kinds that real systems have. They are switched off when you run CardVault locally and in CI, so a correct suite runs green there. On the hosted stage environment a set of them is switched on, so a good suite run against stage should go red, in the right places.</p>
<p>Which bugs exist and where they live is kept private, on purpose, and this site does not describe them. That mirrors real work: nobody tells a tester where the defects are. Every lesson in this track describes CardVault’s <em>correct</em> behaviour, so any difference you can demonstrate on stage is a genuine finding.</p>
${table(['', 'Fault', 'Seeded bug'], [
  ['What is wrong', 'The environment', 'The code'],
  ['Who turns it on', 'Your test, at run time', 'The environment’s set-up, not your test'],
  ['Locally and in CI', 'Whenever a test asks', 'Off'],
  ['What a good test does', 'Shows the system copes', 'Fails, with clear evidence'],
])}

<h2>From a red test to a finding</h2>
<p>When a test fails on stage, the job is to turn that into a finding someone can act on. A good finding says what was expected and why (which rule, from which lesson or spec), what happened instead, and how to reproduce it from a known state. It includes the request, the response, and the <a href="/learn/journey-of-a-request/">correlation ID</a>, which leads straight to the logs of every service involved.</p>
${testerEye(`<p>Write tests from the rules, not from what you see the system do. A test written by copying current behaviour passes on a defect as happily as on correct code. The lessons in this track give you the rules: each status code, each limit, each ordering promise. Test those, and the seeded bugs will show themselves.</p>`)}
${realWorld(`<p>Deliberately broken software is a long-standing training tool, and teams use “bug bashes” and mutation testing, where small defects are planted automatically to measure whether a suite notices. Seeded bugs are the hand-made version of the same idea: they measure your tests.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Fault', 'A simulated problem in the environment, injected at run time by a test.'],
  ['Fault injection', 'Deliberately causing faults to check that a system stays correct.'],
  ['Seeded bug', 'A defect planted on purpose in the code so tests have something real to find.'],
  ['Finding', 'A demonstrated difference between expected and actual behaviour, with evidence.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'A test sets an `error` fault with `scope.path` `/v1/profile*` on the profile service and no `fail_next` or `rate`. How long does it last?',
  options: ['For one request', 'Until faults are replaced, cleared, or the service is reset', 'For 30 seconds', 'Until the clock moves'],
  answer: 1,
  why: '<p>With neither <code>fail_next</code> nor <code>rate</code>, a fault fires on every matching request until it is cleared.</p>',
})}
${check({
  q: 'Your suite is all green locally and in CI, but three tests fail against stage. What is the most likely explanation, and what should you do?',
  options: ['Stage is broken; ignore it', 'Stage has seeded bugs switched on; check each failure against the rule it tests and report it as a finding with evidence', 'The tests are flaky; add retries', 'Delete the failing tests'],
  answer: 1,
  why: '<p>Seeded bugs are off locally and in CI and on in stage. A failure there is exactly what the suite is for, as long as the test checks a real rule.</p>',
})}
${check({
  q: 'With `kafka_publish_failure` on the card service, a test reports a card lost. What should it assert once the fault is cleared?',
  options: ['That the report-lost call failed', 'That the event was published once the fault lifted and the wallet card was suspended', 'That the card is ACTIVE again', 'Nothing; events are lost under this fault'],
  answer: 1,
  why: '<p>The report-lost call succeeds; the event waits in the outbox. After the fault is lifted, it must be published and its effects must follow.</p>',
})}

<h2>Recap</h2>
${recap([
  'Faults simulate a failing environment; six types, set per service, scoped and repeatable.',
  'Test controls, health checks and docs are never affected by faults.',
  'Seeded bugs are planted defects: off locally and in CI, a set on in stage.',
  'This site describes correct behaviour only; differences on stage are findings.',
  'Good findings cite the rule, the evidence and the correlation ID.',
])}
`,
};
