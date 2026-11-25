import { figure, keyIdea, testerEye, realWorld, terms, check, recap, code, terminal } from '../../src/components.mjs';
import { settingsOrder } from '../diagrams/suite.mjs';

export default {
  minutes: 9,
  lede: 'The same tests must run against your laptop, against CI and against stage. Each has different addresses and different secret keys. This lesson shows how the suite learns where it is pointing without a single address written into a test.',
  youWill: 'You will learn how `TEST_ENV` picks an environment, the four places a setting can come from, and why secrets never sit in the committed files.',
  body: `
<h2>The problem: one suite, several targets</h2>
<p>On your machine the card service answers at <code>http://localhost:8002</code>. On stage, reached through an SSH tunnel, it answers at <code>http://127.0.0.1:18002</code>. If a test wrote either address into its code, it could only ever run in one place. The same goes for the keys that open the test controls: local ones are harmless, stage ones are secret.</p>
<p>So the tests never mention an address or a key. They ask one object, the <strong>settings</strong>, and the settings are filled in from outside.</p>

<h2>TEST_ENV picks the environment</h2>
<p>An <strong>environment variable</strong> is a named value the shell hands to a program. The suite reads one called <code>TEST_ENV</code>. It is <code>local</code> unless you say otherwise:</p>
${terminal([
  ['uv run pytest', 'TEST_ENV is local: envs/local.env'],
  ['TEST_ENV=stage uv run pytest -n 2', 'envs/stage.env, plus the secrets in .env.stage'],
])}
<p>Each environment has a committed file in <code>tests/api/envs/</code> with its addresses and other non-secret values:</p>
${code({ title: 'tests/api/envs/stage.env (part)', lang: 'ini', src: `
AUTH_URL=http://127.0.0.1:18001
CARD_URL=http://127.0.0.1:18002
ENROLLMENT_URL=http://127.0.0.1:18003
WALLET_TXN_URL=http://127.0.0.1:18004
PROFILE_URL=http://127.0.0.1:18005
OPERATOR_URL=http://127.0.0.1:18101
NETWORK_URL=http://127.0.0.1:18102

DB_PORT=15432
KAFKA_BOOTSTRAP=127.0.0.1:29092
# The VM is small; give slow calls more room.
HTTP_TIMEOUT_SECONDS=20
` })}

<h2>Four places, first match wins</h2>
${figure({ svg: settingsOrder(), caption: 'Each setting is looked up from the top. The red box is the one file that is never committed.' })}
<p>Secrets for stage go in <code>tests/api/.env.stage</code>. Git is told to ignore it, so it can never be pushed by accident. A committed template, <code>.env.stage.example</code>, lists the names to fill in, with empty values. An environment variable beats both files, which is how CI passes values in without any file at all.</p>

<h2>The Settings class</h2>
<p>The settings are a Python class built with <strong>pydantic-settings</strong>, a companion to pydantic that fills a class from environment variables and <code>.env</code> files. Each field is a name, a type and sometimes a default:</p>
${code({ title: 'tests/api/src/cardvault_tests/settings.py (part)', src: `
class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")

    test_env: str = "local"

    # Base URLs of the five bank services and the two mocks
    auth_url: str
    card_url: str
    ...
    # Keys the suite presents
    test_key: str = ""  # X-Test-Key for /test/* controls
    service_key_tests: str = ""  # X-Service-Key of the "tests" caller

    # Run behaviour
    http_timeout_seconds: float = 10.0
    reset_at_start: bool = True
` })}
<p>A field with no default, such as <code>auth_url</code>, must be found somewhere, or the run stops at once with a clear error. A field with a type is converted on the way in: the text <code>20</code> in a file becomes the number 20.0 for <code>http_timeout_seconds</code>. Names match without regard to case, so <code>AUTH_URL</code> in a file fills <code>auth_url</code>.</p>
<p>A function, <code>get_settings()</code>, reads <code>TEST_ENV</code>, finds the two files and builds the object once. Everything else in the suite asks it for values.</p>
${keyIdea(`<p>Tests never contain an address or a key. They read the settings, and <code>TEST_ENV</code> decides which files fill them, so the same test runs unchanged on a laptop, in CI and against stage.</p>`)}
${testerEye(`<p>When a run points at the wrong place, the first line of pytest’s output tells you: the suite prints <code>CardVault environment: stage (auth at http://127.0.0.1:18001)</code> before any test runs. Check it whenever results look surprising.</p>`)}
${realWorld(`<p>Teams usually keep secrets in a vault service and inject them into CI as environment variables. The shape is the same as here: committed configuration for what is safe to share, and secrets that arrive from outside and never touch the repository.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Environment variable', 'A named value the shell passes to a program, such as `TEST_ENV=stage`.'],
  ['`TEST_ENV`', 'Picks the environment: `local` (the default) or `stage`.'],
  ['Settings', 'The one object that holds every address, key and option for the run.'],
  ['`.env.stage`', 'The untracked file that holds stage’s secrets.'],
])}

<h2>Check yourself</h2>
${check({
  q: '`envs/stage.env` says `HTTP_TIMEOUT_SECONDS=20`. You run `HTTP_TIMEOUT_SECONDS=60 TEST_ENV=stage uv run pytest`. Which timeout does the run use?',
  options: ['10, the default', '20, from the committed file', '60, from the environment variable', 'The run fails because the value is set twice'],
  answer: 2,
  why: '<p>An environment variable is the first place looked at, so it wins over both files. That is useful for a one-off change without editing anything.</p>',
})}
${check({
  q: 'Why is there a committed `.env.stage.example` with empty values?',
  options: ['pytest reads it as a fallback', 'It tells a new person which secret names to fill in, without sharing the secrets', 'Git needs it to ignore `.env.stage`', 'CI copies it at start'],
  answer: 1,
  why: '<p>The real file is never committed, so without a template nobody would know which names it needs. The example shares the names and nothing else.</p>',
})}

<h2>Recap</h2>
${recap([
  'Tests read addresses and keys from one settings object, never from their own code.',
  '`TEST_ENV` picks `envs/<env>.env`; secrets go in the untracked `.env.<env>`.',
  'First match wins: environment variable, secrets file, committed file, default.',
  'The first line of output names the environment, so a wrong target is easy to spot.',
])}
`,
};
