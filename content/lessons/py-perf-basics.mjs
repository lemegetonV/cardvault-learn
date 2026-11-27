import { figure, interview, keyIdea, testerEye, table, realWorld } from '../../src/components.mjs';
import { loadShapes, percentiles } from '../diagrams/perf.mjs';

export default {
  minutes: 10,
  lede: 'Every test so far asks whether CardVault gives the right answer. Performance testing asks whether it gives that answer fast enough, and keeps doing so when many customers use it at once. This lesson covers the kinds of performance test and the few numbers that matter, before the next lessons write and run one.',
  youWill: 'You will be able to name the kinds of performance test, explain response time percentiles, throughput and error rate, and say why the average response time misleads.',
  body: `
<h2>Right, but slow, is still broken</h2>
<p>A customer who taps “Cards” and waits eight seconds will think the app is down, even if the list is perfectly correct when it arrives. And an app that answers in 10 ms for one person may slow to a crawl when a thousand people open it at nine in the morning. Functional tests, like the 93 in the suite, run one request at a time, so they cannot see either problem.</p>
<p><strong>Performance testing</strong> measures how fast a system answers and how it behaves under load: many requests at the same time, the way real traffic arrives.</p>

<h2>A first step: one request, timed</h2>
<p>The suite has one test that times a single request, in <code>test_cards.py</code>: <code>test_the_card_list_answers_quickly</code> checks that <code>response.elapsed</code> stays under a budget of one second. It is a useful alarm for a request that suddenly becomes very slow. But it measures one request with nobody else around, so it says nothing about behaviour under load. For that you need a load test.</p>

<h2>Four kinds of load test</h2>
${figure({ svg: loadShapes(), caption: 'The same tool runs all four. What changes is how many simulated users there are over time, and what question you ask.' })}
${table(['Kind', 'Question it answers', 'Example for CardVault'], [
  ['**Load test**', 'Does it meet its targets at the traffic we expect?', '200 customers browsing at once, as on a busy morning'],
  ['**Stress test**', 'Where does it break, and how does it fail?', 'Keep adding customers until errors appear; check it recovers'],
  ['**Spike test**', 'Does it survive a sudden jump?', 'Ten times the traffic for one minute, when a promotion starts'],
  ['**Soak test**', 'Does it stay healthy over time?', 'Normal traffic for eight hours, watching for memory that keeps growing'],
])}
<p>A stress test is expected to find a breaking point. What you check is that the system fails politely, with clear errors rather than wrong answers, and recovers when the load drops.</p>

<h2>The numbers that matter</h2>
${table(['Number', 'What it means'], [
  ['**Response time**', 'How long one request takes, from sending to the answer. Measured in milliseconds (ms)'],
  ['**Throughput**', 'How many requests the system handles per second, written RPS'],
  ['**Error rate**', 'The share of requests that fail: a 5xx status, a timeout, a refused connection'],
  ['**Concurrent users**', 'How many simulated users are active at the same moment'],
])}
<p>These numbers move together. As users increase, throughput rises, until the system is full. After that, throughput stops rising, response times climb, and soon errors start. Finding that point is what a stress test is for.</p>

<h2>Why the average misleads</h2>
<p>Response times are not spread evenly. Most requests are quick, and a few are very slow: the first request after a restart, one that waited for a busy database. The average mixes them into a number that describes nobody.</p>
${figure({ svg: percentiles(), caption: 'The median says a typical request took 11 ms. The 95th percentile says 1 request in 20 took 180 ms or more. The average says 31 ms, which no request took.' })}
<p>So performance results are given as <strong>percentiles</strong>. The 95th percentile, written <strong>p95</strong>, is the time that 95% of requests were faster than. The <strong>median</strong> (p50) is the middle: half were faster, half slower. Teams set targets on p95 or p99, such as “95% of card list requests answer within 300 ms”, because those describe the slow experiences real customers have. The average hides them.</p>

${realWorld('<p>Banks set performance targets, often called service level objectives, for each customer journey, and test against them before big releases. Load tests run against an environment built like production, never against production itself without careful planning, because the test traffic is real traffic to the servers.</p>')}

<h2>Tools, and who does it</h2>
<p>Common tools include <strong>JMeter</strong>, <strong>k6</strong>, <strong>Gatling</strong> and <strong>Locust</strong>. They all simulate many users and report the numbers above. This track uses Locust because its tests are plain Python, the same language as the API suite. In many companies an SDET writes and runs load tests for their own services, while a dedicated performance team handles large, system-wide tests.</p>

${keyIdea('<p>Performance testing checks speed under load. Load, stress, spike and soak tests differ in the traffic they apply and the question they answer. Judge results by percentiles such as p95, throughput and error rate, never by the average alone.</p>')}

${testerEye('<p>A performance number means nothing without its conditions. “p95 is 40 ms” needs “with 20 users, on this environment, for 5 minutes” beside it, or it cannot be compared with anything.</p>')}

${interview({
  say: `<p>“Besides functional API tests, I have a Locust load test for CardVault. It simulates customers logging in and browsing their cards, transactions and profile, and checks two budgets: 95% of requests under 500 ms and under 1% errors. I judge results by p95 and error rate, not the average, because a few slow requests hide inside an average. I know the main kinds of test: load at expected traffic, stress to find the breaking point, spike for sudden jumps, and soak for long runs.”</p>`,
  qa: [
    ['Have you done performance testing?', '<p>Yes, with Locust: a load test for the CardVault API with budgets on p95 response time and error rate, run for 30 seconds in CI after the functional tests, and run by hand with more users locally. I also have a single-request response-time check in the API suite.</p>'],
    ['Why use p95 instead of the average?', '<p>Response times are skewed: most are fast and a few are very slow. The average blends them into a number no request had, and hides the slow ones. p95 says what the slowest 5% of customers experience.</p>'],
    ['What is the difference between a load test and a stress test?', '<p>A load test checks the system meets its targets at the expected traffic. A stress test pushes beyond it to find where and how the system breaks, and whether it recovers.</p>'],
  ],
})}
`,
};
