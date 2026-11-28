import { shot, interview, keyIdea, table, terminal, testerEye, realWorld } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'Every test in this site needs a running copy of CardVault. There are two: the stage copy on a server, which anyone can open, and a copy you start on your own computer. This lesson shows what is on each, and how to start your own.',
  youWill: 'You will know every page of the stage server, be able to run CardVault on your computer, and explain why a team tests in more than one environment.',
  body: `
<h2>What an environment is</h2>
<p>An <strong>environment</strong> is one complete, running copy of an application: its screens, its services, its database and its message bus, at one set of addresses. Real teams have several. Developers run one on their own computers, the CI pipeline starts a fresh one for every change, and a shared <strong>stage</strong> environment sits close to production so the whole team can try a new version before customers see it.</p>
<p>CardVault has the same three. The code is identical in all of them; only the addresses and the data differ.</p>
${table(['Environment', 'Where it runs', 'Who uses it'], [
  ['Local', 'Docker on your own computer', 'You, while writing and debugging tests'],
  ['CI', 'A fresh copy inside each GitHub Actions run', 'The pipeline, for every change'],
  ['Stage', 'A server on the internet', 'Anyone with the link, the Live lab on this site, and test runs against a shared copy'],
])}

<h2>The stage server and its pages</h2>
<p>Stage is the copy behind every Try it panel and Run button on this site. It has the same demo customers, and its data can be put back to the starting state at any time. Its public pages:</p>
${table(['Page', 'Address', 'What it is for'], [
  ['The web app', { html: '<a href="https://cardvault.140-245-206-220.sslip.io">cardvault.140-245-206-220.sslip.io</a>' }, 'The screens from the tour. Sign in as `alice` with `CardVault-Demo-1`.'],
  ['API docs', { html: '<a href="https://docs.140-245-206-220.sslip.io">docs.140-245-206-220.sslip.io</a>' }, 'A page linking to every service’s API documentation, as Swagger UI and ReDoc. Read-only: you can read every endpoint, but “Try it out” is refused.'],
  ['The wallet company', { html: '<a href="https://operator.140-245-206-220.sslip.io/help">operator.140-245-206-220.sslip.io/help</a>' }, 'The simulated wallet company’s help page. Its consent frame is the box that opens inside the app when you add a card.'],
  ['The Live lab', { html: '<a href="/lab/">On this site</a>' }, 'Send your own requests to stage, run tests from both suites, and put the data back to the start.'],
])}
${shot({ src: 'swagger-auth.png', alt: 'Swagger UI for the CardVault auth-service, listing login, refresh, logout and me endpoints.', caption: 'The Login service’s API documentation. Each service describes its own endpoints this way, generated from its code, so it is never out of date.' })}
<p>Behind these, stage also has a password-protected tools page for the people who look after it, with buttons to reset the data and a view of the Kafka topics. The services’ own ports, the database and Kafka are not open to the internet at all. A tester who needs them from a laptop opens an encrypted <strong>SSH tunnel</strong> to the server first, and then runs the API suite with <code>TEST_ENV=stage</code>.</p>
<p>The stage copy can switch on a set of known defects for bug-hunting practice. While you work through these lessons they are off, so stage behaves exactly like your own copy.</p>

<h2>Running CardVault on your computer</h2>
<p>You need four tools: <strong>Docker</strong> with Compose (on a Mac or Windows, Docker Desktop includes both), <strong>git</strong>, <strong>make</strong> and <strong>Python 3</strong>. Then four commands start everything:</p>
${terminal([
  ['git clone https://github.com/lemegetonV/cardvault.git', ''],
  ['cd cardvault', ''],
  ['make up', '(builds every part the first time, which takes several minutes, then waits until each one is healthy)'],
  ['make seed', `./scripts/seed.sh
seeded auth
seeded card
seeded profile
seeded enrollment
seeded wallet-txn
seeded network-mock
seeded wallet-operator-mock`],
], 'Terminal · starting CardVault')}
<ul>
<li><code>make</code> runs a named recipe from the project’s <code>Makefile</code>, so one short word stands for a longer command.</li>
<li><code>make up</code> builds a Docker image for each part and starts them all with Docker Compose, the tool that starts a set of containers together. It also creates the settings file <code>.env</code> the first time.</li>
<li><code>make seed</code> loads the demo customers, their cards and their purchases.</li>
</ul>
<p>Once it is up, these addresses work on your computer:</p>
${table(['Address', 'What it is'], [
  ['`http://localhost:3000`', 'The web app. Sign in as `alice`.'],
  ['`http://localhost:8001/docs` to `8005/docs`', 'The five services’ API docs, in the order Login, Cards, Wallet, Transactions, Profile. Here “Try it out” works.'],
  ['`http://localhost:8101/docs`, `8102/docs`', 'The two simulators: the wallet company and the card network.'],
  ['`http://localhost:8080`', 'The Kafka console, with every topic and message.'],
  ['`localhost:5432`', 'Postgres, for a database tool or the API suite’s database tests.'],
])}
<p>Three more commands look after it:</p>
${table(['Command', 'What it does'], [
  ['`make reset`', 'Puts every service back to the starting data. Run it when your experiments have changed too much.'],
  ['`make logs`', 'Shows what every service is writing to its log, as it happens.'],
  ['`make down`', 'Stops everything. Your data stays for next time; `make clean` deletes it too.'],
])}
${keyIdea('<p>Same code, different addresses. A test suite that reads its addresses from settings, instead of having them written into the tests, can run against any environment without changing a line.</p>')}

<h2>Which copy to test against</h2>
<p>Each copy answers a different question. Your local copy is yours alone: fast, free to break, and you can read its logs and database directly, so it is where you write and debug tests. CI proves that a change works on a fresh copy with nothing left over from before. Stage proves the app works when it is deployed on a real server, behind real HTTPS, at real distances.</p>
${testerEye(`<ul>
<li>A test that passes locally and fails on stage points at the environment: an address, a setting, a slower network or different data. Compare the two before suspecting the code.</li>
<li>Shared environments have shared data. On stage, other people may be using alice at the same time, which is why tests that change data create their own new customer.</li>
</ul>`)}
${realWorld('<p>A real bank has more environments, often development, test, staging, pre-production and production, with stricter rules at each step. Production data never comes down to test environments, because it holds real customers’ details.</p>')}

${interview({
  say: `<p>“We had three environments. Locally the whole system ran in Docker Compose, started with one command and seeded with demo customers. CI started a fresh copy for every pull request and ran the suites against it. And a stage server ran the same code behind HTTPS, with read-only API docs and the database and Kafka reachable only through an SSH tunnel.</p>
<p>The suite read its addresses from an environment file, so switching from local to stage was one variable. Tests that changed data created their own customer, so runs on the shared stage copy did not interfere with each other.”</p>`,
  qa: [
    ['How did you run the application locally?', '<p>With Docker Compose: one command builds and starts the web app, the five services, the two simulators, Postgres and Kafka, and waits until each is healthy. A second command loads the demo data, and another resets it.</p>'],
    ['A test passes locally but fails on stage. What do you do?', '<p>Look for what differs between the two: the addresses and settings, the data, timing over a real network, and the version deployed. I compare the request and response from both runs, check the stage logs, and only then suspect the code.</p>'],
    ['Why not run all tests against production?', '<p>Tests create and change data, and production holds real customers and real money. In production you run only safe checks, such as smoke tests and monitoring, with dedicated test accounts.</p>'],
  ],
})}
`,
};
