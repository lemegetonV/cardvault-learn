import { figure, interview, table, keyIdea } from '../../src/components.mjs';
import { system } from '../diagrams/app.mjs';

export default {
  minutes: 8,
  lede: '“Walk me through the architecture of the application you tested” is one of the most common SDET interview questions. This lesson turns the last five lessons into one answer you can say in about two minutes and draw on a whiteboard.',
  youWill: 'You will have a two-minute architecture answer, a picture to draw, and answers to the usual follow-up questions.',
  body: `
<h2>The shape of a good answer</h2>
<p>Interviewers are not checking that you can recite every detail. They want to see that you understand how the parts fit together and what that means for testing. A good answer goes from the outside in, then ends with your part:</p>
<ol>
<li><strong>The business</strong>: what the app does and for whom. One or two sentences.</li>
<li><strong>The front end</strong>: what the customer uses.</li>
<li><strong>The services</strong>: the main backend parts and what each owns.</li>
<li><strong>How they talk</strong>: direct calls and events.</li>
<li><strong>Data and outside systems</strong>: databases and partners.</li>
<li><strong>How it runs</strong>: containers and CI.</li>
<li><strong>Your part</strong>: how you tested it.</li>
</ol>

<h2>The two-minute answer</h2>
<p>Read it out loud a few times, then say it in your own words. Each paragraph matches one step above.</p>
<blockquote class="script">
<p>1. “It is a bank’s card and wallet application. Customers manage their cards, add them to a checkout wallet for online payments, and see and dispute their wallet transactions.</p>
<p>2. The front end is a Next.js web app. It has a thin backend-for-frontend layer that holds the session in secure cookies and forwards calls to the services.</p>
<p>3. Behind it are five Python microservices: authentication, cards, which also approves purchases, profile, wallet enrolment, and transactions.</p>
<p>4. The front end calls them over REST. Between themselves, services publish events on Kafka. For example, an approved purchase becomes an event that the transactions service uses to build the customer’s history.</p>
<p>5. Each service owns its own Postgres database. Two external partners, the card network and the wallet operator, integrate over signed HTTP calls, and the wallet operator confirms changes asynchronously with callbacks.</p>
<p>6. Everything runs in Docker, and GitHub Actions starts the whole stack for every change.</p>
<p>7. I built the API tests in Python with pytest and requests, and the UI tests in TypeScript with Playwright, both running in CI.”</p>
</blockquote>

<h2>What to draw</h2>
${figure({ svg: system(), caption: 'Draw it in this order: browser, web app, the five services, the database and message bus underneath, then the two partners on the right.' })}
<p>Draw while you talk, in the same order as the answer. Keep the labels short. If you are short of time, the browser, web app, a column of services and the two partners are enough.</p>

${keyIdea('<p>Always finish by connecting the architecture to testing. “Because purchases reach the history through events, our tests wait for them” shows far more understanding than another box on the diagram.</p>')}

<h2>Follow-up questions to expect</h2>
${table(['They ask', 'The idea to get across'], [
  ['What happens if a service goes down?', 'Others keep working. Events wait on the bus and are processed when it comes back.'],
  ['How do services trust each other?', 'Customer calls carry a signed token that each service checks. Calls between machines use keys or signatures.'],
  ['Why events instead of direct calls?', 'Services stay independent and a slow one does not block the others. The cost: results arrive a moment later.'],
  ['How did you test the outside partners?', 'With simulators that act like them and can be told to be slow, fail, or answer twice.'],
  ['Where were most of your tests?', 'API level for business rules, a smaller set of UI tests for key journeys.'],
])}
<p>Each of these has a longer model answer in the interview corners of the earlier lessons.</p>

<h2>Being honest about the project</h2>
<p>If you are asked where the app comes from, say plainly that CardVault is a realistic demo banking application that you built a test framework for, to practise on something close to production. The depth of your answers is what convinces an interviewer, and you will have that depth.</p>

${interview({
  say: `<p>The two-minute answer above is this lesson’s answer. Practise it until you can say it without notes, and draw the picture as you go.</p>`,
  qa: [
    ['Which part of the system was hardest to test, and why?', '<p>The asynchronous parts, such as adding a card to the wallet, because the final result arrives later through a callback and an event. We handled it with polling helpers that wait for the expected status with a timeout, instead of fixed sleeps.</p>'],
    ['If you had to pick one service to test most, which would it be?', '<p>Cards, because it approves purchases and moves money: holds, settlements and available balances. Mistakes there cost real money. Then the wallet service, because its eligibility rules are the core business logic.</p>'],
    ['How would you scale this system?', '<p>Each service can run several copies behind a load balancer because they are separate. Kafka lets several consumers share the work. As a tester, I would then add performance tests and check behaviour while copies start and stop.</p>'],
  ],
})}
`,
};
