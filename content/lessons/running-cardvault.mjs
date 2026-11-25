import { figure, keyIdea, testerEye, terms, check, recap, table, terminal, code } from '../../src/components.mjs';
import { startup } from '../diagrams/basics.mjs';
import { site } from '../site.mjs';

export default {
  minutes: 10,
  lede: 'Reading about a system only goes so far. This lesson gets CardVault running on your own computer with three commands, shows what starts and in which order, and sends your first real request.',
  youWill: 'You will start the stack, open its pages and log in as alice.',
  body: `
<h2>What you need</h2>
<p>CardVault runs in <strong>Docker</strong>, a tool that runs each program in its own isolated box called a <strong>container</strong>. You do not need Python, Node.js or a database installed. You need:</p>
<ul>
<li>Docker with Compose version 2</li>
<li>GNU Make, to run the short commands below</li>
<li><code>curl</code> and <code>python3</code>, which the helper scripts use</li>
</ul>
<p>Clone the <a href="${site.cardvaultRepo}">cardvault repository</a> and open a terminal in its folder.</p>

<h2>Three commands</h2>
${terminal([
  ['make up', '# builds the images, starts every container, waits until all are healthy'],
  ['make seed', '# loads alice, bob, charlie, dana and their cards and purchases'],
  ['make smoke', '# runs an end-to-end check that the main flows work'],
])}
<p>The first <code>make up</code> takes a few minutes because Docker builds the images. Later runs reuse them and start in well under a minute. When <code>make smoke</code> finishes without a <code>FAIL</code> line, everything is working.</p>
<p><code>make up</code> also copies <code>.env.example</code> to <code>.env</code> the first time. That file holds the local settings: the test keys, the database passwords and the seed customers’ password. All of them are made-up values for your own computer.</p>

<h2>What starts, and in which order</h2>
<p>A file called <code>docker-compose.yml</code> describes every container and which ones must be healthy before another may start. Docker Compose follows those rules, so the stack always comes up in the same order.</p>
${figure({ svg: startup(), caption: 'Each column waits for the one before it. A Python service that starts before its database is ready would fail, so Compose holds it back until Postgres reports healthy.' })}
<p>Each Python service does three things when its container starts. It brings its database tables up to date (these updates are called <strong>migrations</strong>), starts its web server, and then answers <code>GET /ready</code> with <code>200</code> once the things it depends on respond: its database, and Redpanda if it uses events. Compose watches <code>/ready</code> to decide when a container is healthy.</p>

<h2>What you can open</h2>
${table(['Address', 'What it is'], [
  ['`localhost:3000`', 'The web app. Log in as `alice`.'],
  ['`localhost:8001/docs` to `8005/docs`', 'Each bank service’s API reference, where Try it out works.'],
  ['`localhost:8101/docs`, `8102/docs`', 'The two mocks’ API references.'],
  ['`localhost:8080`', 'Redpanda Console, to watch events arrive on each topic.'],
  ['`127.0.0.1:5432`', 'Postgres. Tests use read-only logins listed in `.env.example`.'],
])}
<p>Every port is bound to <code>127.0.0.1</code>, so only your own computer can reach them.</p>

<h2>Your first request</h2>
<p>Log in as alice by sending her username and password to the auth service. The seed password is <code>CardVault-Demo-1</code>, the same for all four customers.</p>
${terminal([
  [`curl -s localhost:8001/v1/auth/login -H 'content-type: application/json' -d '{"username":"alice","password":"CardVault-Demo-1"}'`],
])}
<p>The response is JSON with these fields. The two tokens are long, so they are shortened here.</p>
${code({ lang: 'json', title: 'Response (shortened)', src: `{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 900,
  "refresh_token": "rt_...",
  "refresh_expires_in": 604800,
  "customer_id": "a11ce000-0000-4000-8000-000000000001"
}` })}
<ul>
<li><code>access_token</code> is what you send with every later call, in an <code>Authorization: Bearer …</code> header. It lasts 900 seconds, which is 15 minutes.</li>
<li><code>refresh_token</code> lets the app get a new access token without asking for the password again. It lasts 7 days.</li>
<li><code>customer_id</code> is alice’s fixed ID. It is the same after every reset, which is what makes tests repeatable.</li>
</ul>
<p>Try it with a wrong password and you get <code>401</code> with an error body instead. <a href="/learn/journey-of-a-request/">The journey of one request</a> looks at that error shape.</p>

<h2>Starting again from a clean state</h2>
${terminal([
  ['make reset', '# empties every service, sets the clock back to real time, loads the seed again'],
  ['make down', '# stops the containers and keeps the data'],
  ['make clean', '# stops the containers and deletes the data'],
])}
${keyIdea(`<p><code>make reset</code> is how every test run gets a known starting point. After it, alice has the same cards, the same purchases and the same IDs as on every other reset. Tests can trust the starting state instead of discovering it.</p>`)}

<h2>Local and stage</h2>
<p>There are two places CardVault runs, and they are deliberately different.</p>
${table(['', 'Local', 'Stage'], [
  ['Where', 'Your computer', 'A hosted server, linked below'],
  ['Behaviour', 'Exactly as designed', 'Some known bugs switched on, on purpose'],
  ['API docs', 'Try it out works', 'Read-only'],
  ['Use it to', 'Learn and build your tests', 'Practise finding real defects'],
])}
<p>The stage copy is at <a href="${site.stageApp}">${site.stageApp.replace('https://', '')}</a> and its API docs at <a href="${site.stageDocs}">${site.stageDocs.replace('https://', '')}</a>.</p>
${testerEye(`<p>A test suite that passes locally and fails on stage has found something. That is the point of stage: the same tests, run against a copy with defects in it, show whether your checks are sharp enough to notice.</p>`)}

<h2>Words from this lesson</h2>
${terms([
  ['Container', 'An isolated box that runs one program with everything it needs. Docker runs CardVault as a set of containers.'],
  ['Docker Compose', 'The tool that starts all of CardVault’s containers together, in the right order, from `docker-compose.yml`.'],
  ['Migration', 'A small, numbered change to a database’s tables, applied in order when a service starts.'],
  ['Readiness check', '`GET /ready`: returns 200 only when the service can reach its database (and Redpanda, if it uses it).'],
  ['Stage', 'The hosted copy of CardVault, with some known bugs switched on for practice.'],
])}

<h2>Check yourself</h2>
${check({
  q: 'You run `make up` and the card service’s container keeps waiting to start. Postgres and Redpanda are healthy. Which container should you look at next?',
  options: ['web', 'auth', 'network-mock', 'wallet-txn'],
  answer: 1,
  why: '<p>The card service waits for Postgres, Redpanda and auth to be healthy. With the first two fine, auth is the one holding it back. web and network-mock start after card, not before it.</p>',
})}
${check({
  q: 'A test logs in as alice and stores her `customer_id`. After `make reset`, will her `customer_id` be the same?',
  options: ['Yes, the seed uses fixed IDs', 'No, a reset creates new IDs', 'Only if the clock was not moved', 'Only on stage'],
  answer: 0,
  why: '<p>Every seed customer, card and enrolment has a fixed ID, shared by every service. That is why a test can rely on alice being <code>a11ce000-…-000000000001</code> after any reset.</p>',
})}

<h2>Recap</h2>
${recap([
  '`make up`, `make seed` and `make smoke` start CardVault, load its data and check it works.',
  'Docker Compose starts containers in a fixed order from the dependencies in `docker-compose.yml`.',
  'Each Python service runs its migrations, starts its server and reports healthy through `/ready`.',
  'Logging in returns a 15-minute access token and a 7-day refresh token.',
  '`make reset` gives every test the same starting point. Stage is a hosted copy with known bugs on purpose.',
])}
`,
};
