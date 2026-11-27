import { code, terminal, interview, keyIdea, testerEye, table } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'A load test that only prints numbers needs a person to read them, and nobody reads CI output for numbers every day. To guard against the app getting slower, the test must decide by itself whether a run passed. This lesson adds budgets to the locustfile, runs the check in CI, and is honest about what such a small check can and cannot prove.',
  youWill: 'You will be able to turn a load test into a pass or fail check with budgets and an exit code, explain how it runs in CI, and say what a short CI load test proves.',
  body: `
<h2>Budgets</h2>
<p>A <strong>performance budget</strong> is a limit a run must stay within, agreed in advance, like an expected value in a functional test. The CardVault locustfile has two:</p>
${code({ title: 'tests/perf/locustfile.py', src: `
# The budgets a run must meet. 95% of requests must be faster than this:
P95_BUDGET_MS = 500
# And no more than this share of requests may fail (0.01 = 1%):
MAX_FAILURE_RATIO = 0.01
` })}
<p>Where should the numbers come from? Ideally from a requirement, such as “the cards screen loads within one second for 95% of customers”, minus time for the network and the page. Without one, teams measure a healthy baseline and set the budget with room above it, so ordinary noise does not fail the run but a real slowdown does. Here, local runs give a p95 around 100 ms, so 500 ms leaves plenty of room.</p>

<h2>The check</h2>
${code({ title: 'tests/perf/locustfile.py', src: `
@events.quitting.add_listener
def check_budgets(environment, **kwargs):
    """Runs when Locust stops. A non-zero exit code tells CI the run failed."""
    total = environment.stats.total
    p95 = total.get_response_time_percentile(0.95)
    if total.fail_ratio > MAX_FAILURE_RATIO:
        print(f"FAILED: {total.fail_ratio:.1%} of requests failed (budget {MAX_FAILURE_RATIO:.0%})")
        environment.process_exit_code = 1
    elif p95 > P95_BUDGET_MS:
        print(f"FAILED: 95% of requests took up to {p95} ms (budget {P95_BUDGET_MS} ms)")
        environment.process_exit_code = 1
    else:
        print(f"PASSED: p95 {p95} ms, {total.fail_ratio:.1%} failed")
        environment.process_exit_code = 0
` })}
<ul>
<li>Locust has <strong>events</strong>: moments during a run that your code can react to. <code>@events.quitting.add_listener</code> is a decorator that registers the function to run when Locust is about to stop.</li>
<li><code>environment.stats.total</code> holds the totals for all requests together: the Aggregated row of the table.</li>
<li><code>get_response_time_percentile(0.95)</code> returns the p95 in milliseconds, and <code>fail_ratio</code> the share of requests that failed, from 0 to 1.</li>
<li><code>{total.fail_ratio:.1%}</code> formats a number as a percentage with one decimal place: 0.004 becomes <code>0.4%</code>.</li>
<li><code>environment.process_exit_code</code> sets the number Locust exits with. By convention 0 means success and anything else failure. That number is what CI looks at.</li>
</ul>

<h2>Seeing it fail</h2>
<p>A check you have never seen fail may not work. To try it, the budget was lowered to 50 ms in a copy of the file, and a 10-second run made:</p>
${terminal([['locust --headless --users 10 --spawn-rate 5 --run-time 10s --only-summary', `FAILED: 95% of requests took up to 110 ms (budget 50 ms)
[...] locust.main: Shutting down (exit code 1)`], ['echo $?', '1']], 'Terminal (copy with a 50 ms budget)')}
<p><code>echo $?</code> prints the exit code of the last command. With the real 500 ms budget, the same run prints <code>PASSED</code> and exits with 0.</p>

<h2>In CI</h2>
<p>The <code>api-tests</code> workflow runs the load test straight after the API tests, as <a href="/learn/py-ci/">Running in CI</a> shows:</p>
${code({ lang: 'yaml', title: '.github/workflows/api-tests.yml', src: `
      - name: Run a short load test (Locust)
        working-directory: tests/perf
        run: |
          pip install -r requirements.txt
          locust --headless --users 10 --spawn-rate 5 --run-time 30s --only-summary --html ../api/reports/load-test.html
` })}
<p>If the budgets are broken, Locust exits with 1, the step turns red, and so does the pull request. The HTML report goes into the same download as the test reports, so the charts are there to look at.</p>

<h2>What a short CI load test proves</h2>
${table(['It does catch', 'It does not tell you'], [
  ['A change that makes a request much slower, such as a missing database index', 'How many customers the real system can handle'],
  ['Errors that only appear when requests overlap', 'How production behaves, on different machines with real data volumes'],
  ['A service that falls over under a little load', 'Slow problems such as memory growth over hours'],
])}
<p>CI machines are small and shared, so their timings vary, which is why the budget is generous. Treat this as a <strong>performance smoke test</strong>: a quick alarm on every change. Capacity, stress and soak tests run separately, on an environment built like production, for longer, and are read by people.</p>

${keyIdea('<p>Budgets turn a load test into a pass or fail check: a listener on Locust’s quitting event compares p95 and the failure ratio with the budgets and sets the exit code, which CI reads. A short CI run is an alarm for regressions, not a measure of capacity.</p>')}

${testerEye('<p>Keep the budget a team decision, written down with its reason. If a budget is raised every time a run fails, it stops protecting anything.</p>')}

${interview({
  say: `<p>“My Locust test has two budgets in the locustfile: p95 under 500 ms and under 1% failures. A listener on Locust’s quitting event checks them and sets the exit code, so CI fails the build when they are broken. The workflow runs it for 30 seconds with 10 users after the API tests and keeps the HTML report. I treat that as a performance smoke test that catches regressions on every change. Real capacity and soak testing need a production-like environment and longer runs.”</p>`,
  qa: [
    ['How do you make a Locust run fail in CI?', '<p>Set <code>environment.process_exit_code</code> to a non-zero value when the results break a budget, usually in a listener on the quitting event. CI treats a non-zero exit code as a failed step.</p>'],
    ['How do you choose a performance budget?', '<p>From a requirement or service level objective where one exists. Otherwise measure a healthy baseline several times and set the budget with headroom above it, so normal variation passes and real regressions fail.</p>'],
    ['Is a 30-second load test in CI enough?', '<p>It is enough to catch large regressions and errors under overlapping requests on every change. It cannot show capacity, production behaviour or problems that build up over hours; those need separate, longer tests on a production-like environment.</p>'],
  ],
})}
`,
};
