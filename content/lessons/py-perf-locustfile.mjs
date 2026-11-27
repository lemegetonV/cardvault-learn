import { code, interview, keyIdea, testerEye, sequence, tree } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'Locust describes a load test as ordinary Python: a class says what one simulated customer does, and Locust runs as many of them as you ask for. This lesson reads the suite’s locustfile line by line, so you can explain every part of it and write your own.',
  youWill: 'You will be able to read and write a locustfile: users, tasks with weights, waits between tasks, logging in once per user, and naming requests.',
  body: `
<h2>Where it lives</h2>
<p>The load test sits next to the API suite, in its own folder with its own requirements, so installing the API suite does not pull in Locust:</p>
${tree([
  ['tests/perf/', 0, ''],
  ['requirements.txt', 1, 'One library: `locust`'],
  ['locustfile.py', 1, 'Who the users are, what they do, and the budgets a run must meet'],
  ['README.md', 1, 'How to run it'],
], 'tests/perf')}
<p><code>locustfile.py</code> is the name Locust looks for by default, the way pytest looks for files starting with <code>test_</code>.</p>

<h2>How Locust thinks</h2>
${sequence({
  id: 'locust-user',
  label: 'The life of one simulated user',
  actors: [
    { id: 'l', label: 'Locust', kind: 'plain' },
    { id: 'u', label: 'one user', kind: 'plain' },
    { id: 'a', label: 'Auth', kind: 'bank' },
    { id: 'c', label: 'Cards', kind: 'bank' },
  ],
  steps: [
    { from: 'l', to: 'u', label: 'start a user', note: 'Locust creates one object from the user class. With 20 users, it creates 20 of them.' },
    { from: 'u', to: 'a', label: 'on_start: log in', note: 'Each user logs in once, when it starts, and keeps its own token.' },
    { from: 'u', to: 'c', label: 'a task: list cards', note: 'Then it picks a task, weighted at random, and runs it. Locust times the request.' },
    { from: 'u', to: 'u', label: 'wait 1 to 3 s', kind: 'self', note: 'It pauses like a person reading the screen.' },
    { from: 'u', to: 'c', label: 'another task…', note: 'Pick, run, wait, again and again, until the test ends.' },
  ],
  caption: 'Every user loops on its own. Twenty users looping at once is the load.',
})}

<h2>The settings at the top</h2>
${code({ title: 'tests/perf/locustfile.py', src: `
import os
import random

from locust import HttpUser, between, events, task

# Where the services are. The same settings as the API suite's config.py.
AUTH_URL = os.getenv("AUTH_URL", "http://localhost:8001")
CARD_URL = os.getenv("CARD_URL", "http://localhost:8002")
TRANSACTIONS_URL = os.getenv("TRANSACTIONS_URL", "http://localhost:8004")
PROFILE_URL = os.getenv("PROFILE_URL", "http://localhost:8005")
...
# The demo customers all share this password. A load test only reads their data.
DEMO_USERS = ["alice", "bob", "charlie", "dana"]
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "CardVault-Demo-1")
` })}
<p>The addresses work exactly like <a href="/learn/py-config/">config.py</a>: environment variables with local defaults. The users are the four demo customers, and the load test only reads, so it changes nobody’s data. <code>random</code> is Python’s module for random choices.</p>

<h2>The user class</h2>
${code({ title: 'tests/perf/locustfile.py', src: `
class CardVaultCustomer(HttpUser):
    # Locust needs one default address. Each request below gives its full address,
    # because CardVault's services each have their own.
    host = AUTH_URL

    # After each task, a user waits between 1 and 3 seconds, like a person reading.
    wait_time = between(1, 3)

    def on_start(self):
        """Runs once when each user starts: log in as one of the demo customers."""
        username = random.choice(DEMO_USERS)
        response = self.client.post(
            f"{AUTH_URL}/v1/auth/login",
            json={"username": username, "password": DEMO_PASSWORD},
            name="log in",
        )
        token = response.json()["access_token"]
        # Every later request from this user sends the token.
        self.client.headers["Authorization"] = f"Bearer {token}"
` })}
<ul>
<li><code>class CardVaultCustomer(HttpUser):</code> makes a class that <strong>inherits</strong> from Locust’s <code>HttpUser</code>: it gets everything <code>HttpUser</code> can do, and adds its own parts. The brackets after a class name name the class it builds on.</li>
<li><code>host</code> is the default address. Locust insists on one, even though every request here gives a full URL.</li>
<li><code>between(1, 3)</code> makes each user wait a random 1 to 3 seconds after each task. This <strong>think time</strong> matters: without it, 20 users would fire requests as fast as possible, which is not how people behave and gives misleading numbers.</li>
<li><code>on_start</code> is a method Locust calls once per user, when that user starts. Logging in here, rather than in every task, matches a real customer, who logs in once and then browses.</li>
<li><code>self.client</code> is the user’s HTTP client. It works like the requests <code>Session</code> from <a href="/learn/py-logging/">Logging every request and response</a>: same <code>get</code> and <code>post</code>, plus timing every request for the results.</li>
<li><code>name="log in"</code> sets the name the request has in the results table. Without it, the table would list the URL.</li>
<li><code>self.client.headers[...] = ...</code> sets a header on the client, so every later request from this user carries its token.</li>
</ul>

<h2>The tasks</h2>
${code({ title: 'tests/perf/locustfile.py', src: `
    # @task marks what a user does. The number is a weight: listing cards (3)
    # happens three times as often as opening the profile (1).
    @task(3)
    def list_cards(self):
        self.client.get(f"{CARD_URL}/v1/cards", name="list cards")

    @task(2)
    def list_transactions(self):
        self.client.get(
            f"{TRANSACTIONS_URL}/v1/wallet/transactions?limit=10", name="list transactions"
        )

    @task(1)
    def view_profile(self):
        self.client.get(f"{PROFILE_URL}/v1/profile", name="view profile")
` })}
<ul>
<li><code>@task</code> is a <strong>decorator</strong>: a line starting with <code>@</code> that adds behaviour to the function below it, like <code>@pytest.fixture</code>. Here it tells Locust the method is something a user does.</li>
<li>The number is a <strong>weight</strong>. Out of every six tasks, on average three list cards, two list transactions and one opens the profile. Weights come from how real customers use the app, often read from production analytics.</li>
<li>No task has an <code>assert</code>. Locust counts a request as failed when its status is 400 or above, or it raises a connection error. A team that needs to check the body can mark a response failed by hand, but status and time are usually enough for a load test.</li>
</ul>

${keyIdea('<p>A locustfile is a user class. <code>on_start</code> runs once per user, <code>@task</code> methods are what the user does, weighted by how often real customers do them, and <code>wait_time</code> adds the pauses people make. Locust runs many users at once and times every request.</p>')}

${testerEye('<p>A load test is only as realistic as its user model. Before trusting the numbers, ask: do real customers do these things, in this mix, with these pauses? A test that only hammers one endpoint answers a narrower question.</p>')}

${interview({
  say: `<p>“My locustfile models a CardVault customer. Each simulated user logs in once in <code>on_start</code> as one of the demo customers and keeps its token. Then it loops over weighted tasks: listing cards most often, then transactions, then the profile, with a one-to-three-second wait between them to act like a person. Every request has a name, so the results group by action rather than URL. It only reads data, so it is safe to run repeatedly.”</p>`,
  qa: [
    ['What is on_start for in Locust?', '<p>It runs once for each simulated user when it starts, before any task. It is the place for per-user set-up such as logging in, so tasks measure only the actions you care about.</p>'],
    ['What do task weights do?', '<p>They set how often each task is picked relative to the others. Weights 3, 2 and 1 mean about half the actions are the first task, a third the second and a sixth the third. They should mirror real usage.</p>'],
    ['Why add wait time between tasks?', '<p>Real users pause to read. Without waits, each simulated user sends requests as fast as possible, so a handful of users produce unrealistic load and the numbers do not match what real traffic would do.</p>'],
  ],
})}
`,
};
