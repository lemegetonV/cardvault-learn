import { figure, interview, keyIdea, table, testerEye } from '../../src/components.mjs';
import { system, twoWays } from '../diagrams/app.mjs';

export default {
  minutes: 9,
  lede: 'You have seen the screens. Now look behind them: what parts make up CardVault, what each part is responsible for, and how they talk to each other. This is the picture interviewers ask you to draw.',
  youWill: 'You will be able to draw the architecture on a whiteboard and explain each box in one sentence.',
  body: `
<h2>The whole system in one picture</h2>
${figure({ svg: system(), caption: 'Everything inside the dotted line is CardVault Bank. The two companies on the right are outside it.' })}
<p>Read it from left to right, the way a customer’s click travels.</p>
<ol>
<li>The customer uses a <strong>browser</strong>.</li>
<li>The browser loads the <strong>web app</strong>: the screens you saw in the tour.</li>
<li>When a screen needs data, the web app calls one of five <strong>backend services</strong>.</li>
<li>Each service keeps its own data in the <strong>database</strong>, and announces important changes on the <strong>message bus</strong>.</li>
<li>Two services also talk to the <strong>outside companies</strong>: the card network and the wallet company.</li>
</ol>

<h2>The web app</h2>
<p>The web app is built with Next.js, a popular framework for React websites. It has two jobs. It draws the screens in the browser, and it has a small server part called a <strong>BFF</strong>, short for <em>backend for frontend</em>. The browser only ever talks to the BFF. The BFF keeps the customer’s sign-in safe in a cookie and passes each request on to the right service.</p>
<p>The BFF holds no business rules. Whether a card may join the wallet, or whether a purchase is approved, is decided by the services. That is why most testing of business rules happens at the API level, against the services directly.</p>

<h2>The five services</h2>
<p>A <strong>service</strong> is a small, separate program with one area of responsibility and its own API (a set of web addresses that other programs call). Splitting an app into services like this is called a <strong>microservice architecture</strong>. Each CardVault service is written in Python with FastAPI.</p>
${table(['Service', 'What it is responsible for', 'Screens it serves'], [
  ['Login (`auth-service`)', 'Checks usernames and passwords, locks accounts after repeated failures, and issues the tokens that prove who the customer is.', 'Sign in'],
  ['Cards (`card-service`)', 'The cards themselves: status, limit, available amount. It also approves or declines each purchase the card network sends.', 'Cards'],
  ['Profile (`profile-service`)', 'Email and phone number, and verifying them with one-time codes.', 'Profile'],
  ['Wallet (`enrollment-service`)', 'Which cards are in the wallet. It decides eligibility and asks the wallet company to add, pause or remove cards.', 'Wallet'],
  ['Transactions (`wallet-txn-service`)', 'The customer’s record of wallet purchases, the CSV export and disputes.', 'Transactions'],
])}
<p>Each service owns its own database. No service reads another service’s tables. If Wallet needs to know about a card, it asks Cards or listens for news from it.</p>

${keyIdea('<p>One service, one job, its own data. When something goes wrong on a screen, this tells you which service to look at first.</p>')}

<h2>Two ways the services talk</h2>
${figure({ svg: twoWays(), caption: 'Top: a direct call. Bottom: an event on the message bus.' })}
<p>A <strong>direct call</strong> is a normal HTTP request: ask a question, wait for the answer. The web app uses direct calls, because a screen needs its data now.</p>
<p>An <strong>event</strong> is an announcement. When Cards approves a purchase, it does not call Transactions and wait. It puts a short message on the <strong>message bus</strong> (CardVault uses Kafka) saying “this purchase was approved”. Transactions listens to the bus and adds the purchase to the customer’s list a moment later. Likewise, when a card is reported lost, Cards announces it and Wallet reacts by pausing the card in the wallet.</p>
<p>Events keep services independent: Cards does not need Transactions to be running to approve a purchase. The cost is that the result appears a moment later instead of instantly.</p>

${testerEye('<p>Because events arrive a moment later, a test that checks the transactions list straight after a purchase can fail even when nothing is wrong. Good tests wait for the result to appear, with a time limit, instead of checking once. You will write exactly this kind of test in the API track.</p>')}

<h2>The outside companies</h2>
<p>The <strong>card network</strong> sends each purchase to Cards for approval, and later sends the final settled amount. The <strong>wallet company</strong> receives requests from Wallet to add, pause or remove cards, and calls Wallet back to confirm each change. Calls in both directions carry a signature, so each side can tell the message really came from the other.</p>
<p>In our environments both companies are simulators that tests can control.</p>

<h2>How it is run</h2>
<p>Every part runs in its own Docker container, and Docker Compose starts them all together with one command: the web app, the five services, the two simulators, one Postgres database server (with a separate database per service) and Kafka. GitHub Actions starts the same set for every change to the code and checks it works.</p>

${interview({
  say: `<p>“It is a microservice system. A Next.js web app sits in front, with a backend-for-frontend layer that holds the customer’s session and forwards requests. Behind it are five Python services, each with its own database: login, cards, profile, wallet enrolment and transactions.</p>
<p>The front end calls services directly over REST. Services tell each other about changes through events on Kafka: for example, when a purchase is approved, the cards service publishes an event and the transactions service builds the customer’s history from it. Two external partners, the card network and the wallet company, integrate with signed HTTP calls. Everything runs in Docker.”</p>`,
  qa: [
    ['Why microservices instead of one application?', '<p>Each area can change and be deployed on its own, and a problem in one, say transactions, does not stop another, say purchase approval. The cost is more moving parts: more network calls, data spread across databases, and results that appear a moment later through events. Those costs are exactly what testing has to cover.</p>'],
    ['What happens if the transactions service is down when a purchase is approved?', '<p>The purchase is still approved, because Cards does not wait for Transactions. The event stays on the message bus, and Transactions picks it up when it comes back, so the purchase appears in the list late but is not lost. A tester would check exactly that: stop the service, make a purchase, restart it, and wait for the purchase to show up.</p>'],
    ['Where would you test business rules: in the UI or the API?', '<p>Mostly at the API level, against each service. The rules live in the services, API tests are faster and more stable than browser tests, and they can cover many cases quickly. UI tests then cover the main customer journeys and what only the screen can show, such as error messages and buttons appearing at the right time.</p>'],
  ],
})}
`,
};
