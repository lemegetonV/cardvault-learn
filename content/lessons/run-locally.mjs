import { interview, keyIdea, shot, table, terminal, testerEye } from '../../src/components.mjs';

export default {
  minutes: 8,
  lede: 'Everything on this site can run on your own computer: the web app, the five services, the two simulators, the database and Kafka. This lesson takes you from an empty folder to signing in as alice on your own copy of CardVault.',
  youWill: 'You will be able to start CardVault locally, find every part of it, and put it back to its starting data.',
  body: `
<h2>What you need</h2>
<p>CardVault runs in <strong>Docker</strong>. Docker runs each part of the app in its own <strong>container</strong>: a small, sealed box with the program and everything it needs. <strong>Docker Compose</strong> starts all the containers together from one file, <code>docker-compose.yml</code>. You do not install Python, Postgres or Kafka yourself.</p>
${table(['Tool', 'Why'], [
  ['Docker Desktop (or Docker Engine with Compose v2)', 'Runs the containers'],
  ['git', 'Downloads the code'],
  ['make', 'Short commands for long ones (on a Mac it comes with the Xcode command line tools)'],
  ['curl and python3', 'Used by the start-up and seed scripts'],
])}
<p>Give Docker at least 4 GB of memory. The whole stack is about a dozen containers.</p>

<h2>Start it</h2>
${terminal([
  ['git clone https://github.com/lemegetonV/cardvault.git', ''],
  ['cd cardvault', ''],
  ['make up', 'builds the images, starts every container and waits until each one reports healthy'],
  ['make seed', 'seeded auth\n…\nseeded wallet-operator-mock'],
], 'From an empty folder to a running app')}
<p><code>make up</code> takes a few minutes the first time, while Docker builds the images, and seconds after that. It also creates a <code>.env</code> file from <code>.env.example</code>: the settings for your local copy, with simple local passwords. <code>make seed</code> loads the demo customers alice, bob, charlie and dana with their cards, wallets and purchases.</p>

<h2>Where everything is</h2>
${table(['Open', 'What you get'], [
  ['`http://localhost:3000`', 'The web app. Sign in as `alice` with `CardVault-Demo-1`.'],
  ['`http://localhost:8001/docs` to `8005/docs`', 'Interactive API pages for Login, Cards, Wallet, Transactions and Profile, in that order'],
  ['`http://localhost:8101/docs`, `8102/docs`', 'The wallet company and card network simulators'],
  ['`http://localhost:8080`', 'Redpanda Console: every Kafka topic and event'],
  ['`localhost:19092`', 'Kafka itself, for test code'],
  ['`localhost:5432`', 'Postgres, with the read-only logins listed in `.env.example`'],
])}
${shot({ src: 'swagger-wallet.png', alt: 'Swagger UI for the CardVault enrollment-service, listing GET /v1/wallet, GET, POST and DELETE /v1/wallet/cards/{card_id}, and POST opt-out and opt-in.', caption: 'The Wallet service’s API page at localhost:8003/docs. Each request opens to show its inputs, answers and error codes.' })}
<p>The API pages are generated from the code, so they are always up to date. Press <strong>Authorize</strong>, paste an access token from a login, and <strong>Try it out</strong> sends real requests to your local copy.</p>

<h2>Everyday commands</h2>
${table(['Command', 'What it does'], [
  ['`make reset`', 'Puts every service back to the starting data. Use it after a test session.'],
  ['`make down`', 'Stops the stack and keeps the data'],
  ['`make clean`', 'Stops the stack and deletes the data too'],
  ['`make logs`', 'Follows every container’s log; stop with Ctrl+C'],
  ['`docker compose ps`', 'Lists the containers and whether each is healthy'],
])}

${keyIdea('<p>Your local copy behaves exactly as designed: no known bugs are switched on. When a test fails locally, the test or your change is the first suspect.</p>')}

<h2>Running the test suites against it</h2>
<p>Both suites live in the same repository and point at <code>localhost</code> by default, so they run against your copy with no extra set-up:</p>
${terminal([
  ['cd tests/api && python3 -m venv .venv && source .venv/bin/activate', ''],
  ['pip install -r requirements.txt && pytest', ''],
  ['cd ../ui && npm install && npx playwright install chromium', ''],
  ['npx playwright test', ''],
], 'API suite, then UI suite')}
<p>The two tracks of this site explain every file in those folders, starting with <a href="/learn/py-framework-map/">the pytest framework map</a> and <a href="/learn/pw-framework-map/">the Playwright framework map</a>.</p>

${testerEye(`<ul>
<li>Run <code>make reset</code> before a test run you want to trust, so the data is the known starting set.</li>
<li>If a container is not healthy, <code>docker compose logs &lt;service&gt;</code> shows why. A port already used by another program is the usual cause.</li>
<li>The local copy is where you reproduce a bug found on stage, with the logs, database and Kafka all in reach.</li>
</ul>`)}

${interview({
  say: `<p>“The whole system runs locally with Docker Compose: the Next.js app, five FastAPI services, the two partner simulators, Postgres and Redpanda for Kafka. One command builds and starts it and waits for every health check, another loads deterministic seed data, and a reset command puts it back between runs. CI starts the same stack inside the GitHub Actions runner, so local runs and CI runs test the same thing.”</p>`,
  qa: [
    ['Why Docker Compose for a test environment?', '<p>Every developer and every CI run gets the same versions of everything, started the same way, in minutes. Nothing depends on what is installed on the machine, and the environment can be thrown away and rebuilt.</p>'],
    ['Why deterministic seed data?', '<p>Tests can rely on known customers, cards and purchases, with the same IDs every time. A test that needs a lost card or an unverified phone finds one ready, and results can be compared run to run.</p>'],
    ['A test passes locally and fails on stage. What do you check?', '<p>The differences: the data (has stage been reset?), configuration such as URLs and keys, timing (stage may be slower, so waits matter), and whether stage has known bugs switched on. Then reproduce the failing steps locally with logs open.</p>'],
  ],
})}
`,
};
