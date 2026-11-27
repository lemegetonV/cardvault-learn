import { code, terminal, interview, keyIdea, testerEye } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'Every test needs to know where the services are. If each test wrote the addresses itself, moving the suite to another environment would mean editing every file. config.py keeps them in one place, and lets you change them without touching the code.',
  youWill: 'You will be able to explain what config.py holds, how environment variables change it, and how one TEST_ENV switch runs the suite against another environment.',
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
  ['pytest', '(the same tests, now using that Cards address)'],
], 'Terminal')}
<p><code>export</code> sets a variable for this terminal session. That is fine for one value, but an environment has a dozen addresses and ports. Typing them all each time is slow and easy to get wrong.</p>

<h2>One switch for a whole environment</h2>
<p>So the suite keeps each environment’s settings in a small file in <code>envs/</code>, and one variable, <code>TEST_ENV</code>, picks the file:</p>
${code({ title: 'tests/api/envs/stage.env', lang: 'ini', src: `
AUTH_URL=http://localhost:18001
CARD_URL=http://localhost:18002
WALLET_URL=http://localhost:18003
...
` })}
${code({ title: 'tests/api/config.py', src: `
from dotenv import load_dotenv

# python-dotenv copies each NAME=value line of the file into the environment
# variables. override=False keeps any variable that is already set.
TEST_ENV = os.getenv("TEST_ENV", "local")
if TEST_ENV != "local":
    env_file = Path(__file__).parent / "envs" / f"{TEST_ENV}.env"
    if not env_file.exists():
        raise SystemExit(f"TEST_ENV={TEST_ENV}, but there is no file {env_file}")
    load_dotenv(env_file, override=False)
` })}
<ul>
<li>A <strong>.env file</strong> is a plain text file of <code>NAME=value</code> lines. <strong>python-dotenv</strong> is a small library whose <code>load_dotenv</code> reads one and sets each line as an environment variable, as if you had typed <code>export</code> for each.</li>
<li>This runs at the top of <code>config.py</code>, before the <code>os.getenv</code> lines, so they read the values from the file.</li>
<li><code>override=False</code> means a variable you set yourself wins over the file. You can use the stage file but point one service somewhere else.</li>
<li><code>Path(__file__).parent</code> is the folder <code>config.py</code> is in, and <code>/</code> joins parts of a path, so the line finds <code>envs/stage.env</code> next to it. <code>Path</code> comes from <code>pathlib</code>, Python’s module for file paths.</li>
<li>With <code>TEST_ENV</code> unset, nothing is loaded and the local defaults apply, so a laptop run needs no set-up.</li>
<li><code>raise SystemExit(...)</code> stops the run at once with a clear message if the name has no file, instead of quietly testing your laptop when you meant stage.</li>
</ul>
${terminal([['TEST_ENV=stage pytest', '(every test, against the stage addresses)']], 'Terminal')}
<p>Writing a variable in front of a command, as here, sets it for that one command only. The stage file holds no passwords or keys. Those are set separately, from a password manager on your computer or from the CI system’s secret store, so a secret is never committed to the repository.</p>

${keyIdea('<p>Settings that change between environments live in one config file, read from environment variables with sensible defaults. Tests never contain addresses or passwords.</p>')}

${testerEye('<p>Keep secrets out of the repository. A default such as the public demo password is fine for a local practice app. Real passwords and keys come from environment variables or the CI secret store, and are never committed.</p>')}

<h2>Other ways teams do this</h2>
<p>Some teams use a settings class that checks each value’s type, or a YAML file with a section per environment. Others pass the environment as a pytest option, such as <code>pytest --env stage</code>, defined in <code>conftest.py</code>. The idea is always the same: one place, chosen from outside the code.</p>

${interview({
  say: `<p>“All environment-specific settings live in one config module: the base URL of each service, the demo password and the request timeout. Each value is read from an environment variable with a local default, so the suite runs on a laptop with no set-up. For another environment I set <code>TEST_ENV=stage</code>, which loads that environment’s .env file. Secrets come from the CI secret store, never from the files or the code.”</p>`,
  qa: [
    ['How would you run the same tests against QA and staging?', '<p>Keep the addresses in configuration, not in tests, and choose them from outside. My suite has one .env file per environment and a <code>TEST_ENV</code> switch: <code>TEST_ENV=stage pytest</code>. Variables set by hand or by CI still win, and secrets never go in the files.</p>'],
    ['Why set a timeout on every request?', '<p>So a service that hangs makes the test fail after a known time with a clear error, instead of blocking the whole run.</p>'],
    ['Where would you keep passwords and API keys?', '<p>In environment variables or the CI system’s secrets, injected at run time. Never in the repository, where anyone with access, and the git history, would keep them forever.</p>'],
  ],
})}
`,
};
