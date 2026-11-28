import { figure, interview, keyIdea, realWorld, shot, table, testerEye } from '../../src/components.mjs';
import { stageMap } from '../diagrams/app.mjs';

export default {
  minutes: 7,
  lede: 'Besides your local copy, CardVault runs on a server on the internet: the stage environment. It is the copy this site’s Try it panels and Run buttons talk to. This lesson shows its pages, what each is for, and how it differs from your local copy.',
  youWill: 'You will be able to find your way around the stage environment and explain why a team has one.',
  body: `
<h2>What a stage environment is</h2>
<p>Teams rarely test only on their laptops. They also deploy the app to a shared server that looks like production but holds only test data. It goes by many names: <strong>stage</strong>, staging, QA or pre-production. Everyone tests the same build there, and it is the last stop before real customers.</p>
<p>CardVault’s stage is one Linux server that runs the same Docker containers as your local copy. A web server called <strong>Caddy</strong> sits in front of them. It gives every page an HTTPS address and lets through only the parts that are meant to be public.</p>

${figure({ svg: stageMap(), caption: 'Only Caddy can be reached from the internet. It passes each address on to one part of CardVault and refuses everything else.' })}

<h2>The pages</h2>
${table(['Address', 'What it is'], [
  ['[cardvault.140-245-206-220.sslip.io](https://cardvault.140-245-206-220.sslip.io)', 'The web app. Sign in as any demo customer with `CardVault-Demo-1`.'],
  ['[docs.140-245-206-220.sslip.io](https://docs.140-245-206-220.sslip.io)', 'A list of every service’s API pages: Swagger UI, ReDoc and the raw OpenAPI file'],
  ['[operator.140-245-206-220.sslip.io/help](https://operator.140-245-206-220.sslip.io/help)', 'The wallet company’s help page, which the app links to from the wallet screen'],
  ['This site’s [Live lab](/lab/)', 'Send requests, run the API and UI tests, run the load test, and reset the data, all against stage'],
])}
${shot({ src: 'stage-docs-hub.png', alt: 'The CardVault API docs page listing auth, card, enrollment, wallet-txn, profile, wallet-operator-mock and network-mock, each with Swagger UI, ReDoc and openapi.json links.', caption: 'The docs page on stage. The API pages there are for reading: “Try it out” is switched off.' })}
<p>The odd-looking addresses come from <strong>sslip.io</strong>, a free service that turns any name ending in <code>140-245-206-220.sslip.io</code> into the server’s IP address. It saves buying a domain name for a test server.</p>

<h2>What is not public</h2>
<p>A stage server is on the internet, so it is locked down. Only the web app, the docs and the help page answer. The services’ own ports, the database and Kafka are not reachable from outside, and the routes tests use to reset data or control the simulators are refused on the public addresses. The people who maintain stage reach those through a password-protected tools page.</p>

<h2>How the Try it panels reach stage</h2>
<p>When you press <strong>Send</strong> in a Try it panel, your browser does not call stage directly. The request goes to this site, which signs in to a small helper program on the stage server. The helper forwards customer requests (only paths under <code>/v1/</code>) to the right service and sends the answer back. The same helper runs the pytest and Playwright suites when you press a Run button, and streams their output to your screen.</p>

${keyIdea('<p>Stage runs the same build as your local copy, but it is shared and it can have known bugs switched on on purpose. Your local copy never does.</p>')}

<h2>Stage versus local</h2>
${table(['', 'Local copy', 'Stage'], [
  ['Who uses it', 'Only you', 'Everyone, including this site'],
  ['Known bugs', 'Never switched on', 'Can be switched on, so tests have real bugs to find'],
  ['Data', 'Reset whenever you like with `make reset`', 'Shared; reset from the Live lab when a demo has changed it'],
  ['Inside access', 'Logs, database and Kafka all on `localhost`', 'Locked down; only the public pages'],
  ['Speed', 'Your computer', 'A small cloud server, so allow for slower answers'],
])}

${testerEye(`<ul>
<li>Expect other people’s changes: a shared environment’s data is not always the starting set. Create or reset what your test needs.</li>
<li>When a test fails on stage, check whether it is a known bug before reporting it, then reproduce it locally.</li>
<li>Waits that pass locally may be too short on a slower server, which is one more reason to wait for a condition rather than for a fixed time.</li>
</ul>`)}

${realWorld('<p>A bank usually has several environments: development, test, stage and production, each with its own data and access rules. Stage is kept as close to production as possible, with masked or invented data, never real customers’ details.</p>')}

${interview({
  say: `<p>“We had a local Docker environment for development and a shared stage server running the same containers behind a reverse proxy that exposes only the web app and read-only API docs. Test-only routes, the database and Kafka are not public. Our suites run against local and stage with the same code; only the configuration changes. Stage can have known defects enabled, which made it useful for checking that our tests really catch bugs.”</p>`,
  qa: [
    ['What is the difference between a stage environment and production?', '<p>Stage runs the same build but with test data and test partners, and it is open to testers rather than customers. It is where a release is checked before it reaches production.</p>'],
    ['How do your tests know which environment to use?', '<p>Through configuration: a setting such as <code>TEST_ENV</code> or <code>BASE_URL</code> chooses the addresses and credentials, and secrets come from environment variables, never from the code.</p>'],
    ['Why should test-only routes never be public?', '<p>They can reset data, change the clock or make the simulators misbehave. Anyone reaching them could wipe the environment or fake results, so they are blocked at the edge and also need a secret key.</p>'],
  ],
})}
`,
};
