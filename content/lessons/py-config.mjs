import { code, terminal, interview, keyIdea, testerEye } from '../../src/components.mjs';

export default {
  minutes: 9,
  lede: 'Every test needs to know where the services are. If each test wrote the addresses itself, moving the suite to another environment would mean editing every file. config.py keeps them in one place, and lets you change them without touching the code.',
  youWill: 'You will be able to explain what config.py holds, how environment variables change it, and how the suite runs against different environments.',
  body: `
<h2>The problem it solves</h2>
<p>In <a href="/learn/py-first-test/">your first test</a> the address <code>http://localhost:8001</code> was typed straight into the test. That works on your computer. But a team runs the same tests in several places: on a laptop, in CI, and against a shared test environment. Each place has different addresses.</p>
<p>The answer is to keep every setting that depends on <em>where</em> the tests run in one file, and to let each environment override it from outside.</p>

<h2>The file</h2>
${code({ title: 'tests/api/config.py', src: `
import os

# One address per backend service. Each service runs on its own port.
AUTH_URL = os.getenv("AUTH_URL", "http://localhost:8001")
CARD_URL = os.getenv("CARD_URL", "http://localhost:8002")
WALLET_URL = os.getenv("WALLET_URL", "http://localhost:8003")
TRANSACTIONS_URL = os.getenv("TRANSACTIONS_URL", "http://localhost:8004")
PROFILE_URL = os.getenv("PROFILE_URL", "http://localhost:8005")
...
# The password shared by the demo customers (alice, bob, charlie and dana).
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "CardVault-Demo-1")

# How many seconds to wait for a response before giving up.
TIMEOUT = 10
` })}
<ul>
<li><code>import os</code> brings in Python’s built-in module for talking to the operating system.</li>
<li>An <strong>environment variable</strong> is a named value that lives in your terminal session, outside any program. Any program started from that terminal can read it.</li>
<li><code>os.getenv("CARD_URL", "http://localhost:8002")</code> reads the variable <code>CARD_URL</code>. If it is not set, it returns the second value, the <strong>default</strong>. So with nothing set, the tests point at CardVault on your own computer.</li>
<li>Names in capitals, such as <code>CARD_URL</code>, are a Python habit for values that never change while the program runs. They are called <strong>constants</strong>.</li>
<li><code>TIMEOUT = 10</code> is used by every request. Without a timeout, a service that never answers would make a test hang forever.</li>
</ul>

<h2>How the rest of the suite uses it</h2>
<p>Other files import the module and read its values. The Cards client, for example, starts like this:</p>
${code({ title: 'tests/api/api/cards_api.py', src: `
import config


class CardsApi:
    def __init__(self, token):
        self.base_url = config.CARD_URL
` })}
<p>No test file contains an address. If the Cards service moves, one line changes.</p>

<h2>Running against another environment</h2>
<p>To point the suite somewhere else, set the variables before running pytest. Nothing in the code changes.</p>
${terminal([
  ['export CARD_URL=https://cards.test.example.com', ''],
  ['export AUTH_URL=https://auth.test.example.com', ''],
  ['pytest', '(the same tests, now against the test environment)'],
], 'Terminal')}
<p><code>export</code> sets a variable for this terminal session. In CI, the pipeline file sets the same variables, often from the CI system’s store of secrets, so passwords never sit in the code.</p>

${keyIdea('<p>Settings that change between environments live in one config file, read from environment variables with sensible defaults. Tests never contain addresses or passwords.</p>')}

${testerEye('<p>Keep secrets out of the repository. A default such as the public demo password is fine for a local practice app. Real passwords and keys come from environment variables or the CI secret store, and are never committed.</p>')}

<h2>Other ways teams do this</h2>
<p>config.py is the simplest form. Larger suites often add a <code>.env</code> file per environment, read with a library such as python-dotenv, or a settings class that checks each value’s type. Some add a single switch, such as <code>TEST_ENV=staging</code>, that picks a whole set of addresses. The idea is the same: one place, chosen from outside the code.</p>

${interview({
  say: `<p>“All environment-specific settings live in one config module: the base URL of each service, the demo password and the request timeout. Each value is read from an environment variable with a local default, so the suite runs on a laptop with no set-up, and CI or a shared test environment just sets different variables. Secrets come from the CI secret store, never from the code.”</p>`,
  qa: [
    ['How would you run the same tests against QA and staging?', '<p>Keep the addresses in configuration, not in tests, and choose them from outside: environment variables, a .env file per environment, or one <code>TEST_ENV</code> switch that selects a set. The test code stays identical.</p>'],
    ['Why set a timeout on every request?', '<p>So a service that hangs makes the test fail after a known time with a clear error, instead of blocking the whole run.</p>'],
    ['Where would you keep passwords and API keys?', '<p>In environment variables or the CI system’s secrets, injected at run time. Never in the repository, where anyone with access, and the git history, would keep them forever.</p>'],
  ],
})}
`,
};
