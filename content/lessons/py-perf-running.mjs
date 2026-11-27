import { terminal, shot, interview, keyIdea, testerEye, table, perfButton } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'A locustfile does nothing until Locust runs it, and then it produces a lot of numbers. This lesson runs the CardVault load test two ways, with Locust’s web page and from the command line, and reads the results: which numbers to look at first, and what they say.',
  youWill: 'You will be able to start a load test from the web UI and headless, choose users and ramp-up, save HTML and CSV results, and read the statistics table and charts.',
  body: `
<h2>Install and start</h2>
${terminal([
  ['cd tests/perf', ''],
  ['python3 -m venv .venv && source .venv/bin/activate', ''],
  ['pip install -r requirements.txt', ''],
  ['locust', 'Starting web interface at http://0.0.0.0:8089, press enter to open your default browser.'],
], 'Terminal')}
<p>Locust finds <code>locustfile.py</code> in the folder and starts a small web page on port 8089. CardVault must be running on your computer (<code>make up &amp;&amp; make seed</code> in the repository root).</p>

<h2>The web UI</h2>
${shot({ src: 'locust-start.png', alt: 'Locust’s start form with fields for the number of users (20), the ramp up in users started per second (2), and the host, and a Start button', caption: 'Locust’s start page, filled in for 20 users started 2 per second.' })}
${table(['Field', 'Meaning'], [
  ['Number of users', 'How many simulated customers run at the same time, at the peak'],
  ['Ramp up', 'How many new users start each second until the peak. 20 users at 2 per second takes 10 seconds to reach full load'],
  ['Host', 'The default address. The CardVault locustfile gives full URLs, so this is only a placeholder'],
])}
<p>A gradual ramp-up matters. Starting everyone in the same instant is a spike test, not a load test, and the first seconds would be full of logins colliding.</p>
<p>After Start, the <strong>Statistics</strong> tab fills in live, one row per request name:</p>
${shot({ src: 'locust-stats.png', alt: 'Locust’s statistics table after about 40 seconds with 20 users: list cards 190 requests with median 7 ms and 95th percentile 14 ms; log in 20 requests with median 66 ms and 95th percentile 120 ms; aggregated 408 requests, 0 failures, 10.2 requests per second', caption: 'About 40 seconds into a run with 20 users on a laptop. No failures; logging in is the slowest request.' })}
<p>Read it in this order:</p>
<ol>
<li><strong># Fails</strong>, on the Aggregated row. Any failures come first: a fast error is not a success. The Failures tab lists each kind of failure with its message.</li>
<li><strong>95%ile</strong> per request. Here listing cards is 14 ms for 95% of requests, and logging in 120 ms. Login is slow on purpose, because checking a password is made slow so stolen password stores are hard to crack. That is expected, and it is why the test logs in once per user, not in every task.</li>
<li><strong>Current RPS</strong>: the throughput right now, about 10 requests per second. With 20 users each waiting 1 to 3 seconds between tasks, that is what you would predict: 20 users ÷ 2 seconds on average ≈ 10.</li>
</ol>
<p>That last check is worth making a habit. If the throughput is far below what the users and waits predict, the users are stuck waiting for slow responses.</p>

<h2>The charts</h2>
${shot({ src: 'locust-charts.png', alt: 'Two Locust charts over 45 seconds: requests per second climbing to about 10 as users ramp up, with zero failures; response times with the median steady near 8 ms and the 95th percentile high at the start, then settling around 15 to 25 ms', caption: 'Throughput climbs as users start, then holds. Response times spike at the start, while every user logs in, then settle.' })}
<p>Charts show what a table cannot: change over time. A healthy load test looks like this one, flat once the ramp is over. Trouble looks like a 95th percentile line that keeps climbing while the user count stays flat, which means something is filling up, or failures that appear only after a certain number of users.</p>

<h2>Headless, from the command line</h2>
<p>For CI, or to repeat exactly the same run, skip the web page and give everything on the command line:</p>
${terminal([['locust --headless --users 10 --spawn-rate 5 --run-time 30s --only-summary --html report.html --csv results', `...
PASSED: p95 80 ms, 0.0% failed
Type     Name                  # reqs      # fails |    Avg     Min     Max    Med |   req/s  failures/s
--------|---------------------|-------|-------------|-------|-------|-------|-------|--------|-----------
GET      list cards                69     0(0.00%) |      7       4      19      7 |    2.32        0.00
GET      list transactions         50     0(0.00%) |      8       5      17      8 |    1.68        0.00
POST     log in                    10     0(0.00%) |    150      77     351    130 |    0.34        0.00
GET      view profile              31     0(0.00%) |      8       4      17      7 |    1.04        0.00
--------|---------------------|-------|-------------|-------|-------|-------|-------|--------|-----------
         Aggregated               160     0(0.00%) |     16       4     351      7 |    5.38        0.00
...`]], 'Terminal (the Name column narrowed)')}
${table(['Option', 'What it does'], [
  ['`--headless`', 'No web page: start at once and stop at the end'],
  ['`--users`, `--spawn-rate`', 'The peak user count and the ramp-up, as in the form'],
  ['`--run-time 30s`', 'Stop after 30 seconds (also `5m`, `1h`)'],
  ['`--only-summary`', 'Print the table once at the end, instead of every few seconds'],
  ['`--html report.html`', 'Save a report page with the table and the charts'],
  ['`--csv results`', 'Save the numbers as CSV files, for a spreadsheet or another program'],
])}
<p>The <code>PASSED</code> line is not from Locust itself. It comes from a check in the locustfile that the next lesson, <a href="/learn/py-perf-pass-fail/">Pass or fail: budgets and CI</a>, explains.</p>

<h2>Try it on the live app</h2>
<p>This button runs the same locustfile against CardVault on the server, with 5 users for 20 seconds. A panel shows the totals as they grow, then the results table and the verdict. The run is kept small on purpose because the server is shared and small, so it shows how a load test works rather than how much CardVault can take.</p>
<p>${perfButton()}</p>

${keyIdea('<p>Use the web UI to explore and headless mode to repeat. Read failures first, then p95 per request, then check throughput against what the users and waits predict. Charts show whether the system stays steady over time.</p>')}

${testerEye('<p>Run the same load test twice before believing a difference. Response times vary from run to run, especially on a laptop or a shared machine, so a 10% change in one run is often noise.</p>')}

${interview({
  say: `<p>“I explore with Locust’s web UI and run repeatable tests headless: <code>--users</code>, <code>--spawn-rate</code> and <code>--run-time</code> on the command line, with an HTML report and CSV files saved. I read failures first, then the 95th percentile per request, and I sanity-check throughput against the user count and think time. On CardVault, login is the slow request by design, so the test logs in once per user.”</p>`,
  qa: [
    ['What does spawn rate mean in Locust?', '<p>How many new users start per second until the target is reached. It controls the ramp-up: 100 users at 10 per second reach full load after 10 seconds.</p>'],
    ['Your load test shows low throughput but few users seem busy. What is happening?', '<p>The users are probably waiting on slow responses. With known users and think time you can predict throughput; if the real figure is far lower, look at the response times and at the server for a bottleneck.</p>'],
    ['How would you run a load test in CI?', '<p>Headless, with fixed users, ramp-up and run time, an HTML report saved as an artifact, and a check that turns the result into pass or fail, such as a budget on p95 and the error rate.</p>'],
  ],
})}
`,
};
