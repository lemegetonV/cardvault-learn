import { interview, keyIdea, testerEye, table, figure } from '../../src/components.mjs';
import { frameworkLayers } from '../diagrams/playwright.mjs';

export default {
  minutes: 9,
  lede: '“Tell me about your UI framework” comes up in almost every SDET interview with Playwright on the job description. The interviewer wants two minutes that show you know why each part exists. This lesson gives a structure, a model answer built from this track, and the follow-up questions it usually leads to.',
  youWill: 'You will be able to give a clear two-minute walk-through of the CardVault Playwright framework and handle the follow-ups.',
  body: `
<h2>What the interviewer listens for</h2>
<p>Not file names. They listen for <em>decisions</em> and their reasons: how tests stay independent, how waiting works, how a failure is investigated, how the suite runs without you. A short answer in a fixed order leaves them openings to dig into the parts you know best.</p>

<h2>The structure: six beats</h2>
${table(['Beat', 'Say', 'Time'], [
  ['1. What and why', 'The app, what the suite covers, the tools', '15 s'],
  ['2. Layers', 'Tests, fixtures, page objects and components, API client, data', '25 s'],
  ['3. Data and isolation', 'Read-only demo user with a saved login; a fresh customer per changing test', '20 s'],
  ['4. Reliability', 'Locators by role, web-first assertions, no sleeps, flaky tests found and fixed', '20 s'],
  ['5. Evidence and CI', 'Steps, traces, reports, GitHub Actions', '20 s'],
  ['6. Breadth', 'Phone project, visual tests, what you would add next', '20 s'],
])}
${figure({ svg: frameworkLayers(), caption: 'The picture from the framework map, quick to draw on a whiteboard while you talk through beat 2.' })}

<h2>The model answer</h2>
<p>Read it aloud a few times, then say it in your own words. Knowing the six beats lets you adapt to the interviewer; reciting sounds rehearsed.</p>
<blockquote class="script">
<p><strong>1.</strong> “CardVault is a bank’s card and checkout-wallet web app. My UI suite tests it the way a customer uses it, with Playwright Test and TypeScript, in Chromium and on an emulated phone. It covers sign-in, cards, the wallet with its consent frame, transactions with filters and export, and disputes with file upload.</p>
<p><strong>2.</strong> The framework has four parts around the tests. Page objects hold each page’s locators and actions, and small components cover shared parts such as the menu, toasts and the consent dialog. An API client creates test data through the services. Custom fixtures, made with test.extend, hand tests their page objects and a fresh signed-in customer. Test data lives in one file. Assertions stay in the tests.</p>
<p><strong>3.</strong> Read-only tests use a demo customer whose login a setup project saves once per run with storageState. Any test that changes data gets a brand-new customer created through the API, often with a purchase already made, so tests are independent and run in parallel.</p>
<p><strong>4.</strong> Locators are by role, label or test id, and every check is a web-first assertion, so there are no fixed sleeps. Background changes, like a card being confirmed by the wallet company, are awaited with a deliberate timeout, and API data with expect.poll. I found flaky tests by repeating them under load and fixed their causes, for example clicking before the page had started.</p>
<p><strong>5.</strong> Long tests are split into test.steps. Traces are kept for failed tests. GitHub Actions starts a fresh copy of the app on every pull request, runs the suite with one retry, and uploads the HTML report and traces even when tests fail.</p>
<p><strong>6.</strong> The two main journeys run again on a Pixel 7 project. A couple of visual tests run inside Playwright’s Docker image so their baselines match everywhere. Next I would add Firefox and WebKit in a nightly run.”</p>
</blockquote>
<p>That is about 330 words, a little over two minutes. Every sentence has a lesson behind it in this track, so you can go deeper wherever the interviewer leads.</p>

<h2>Handling follow-ups</h2>
<ul>
<li><strong>Answer, then give an example.</strong> “We never sleep. For example, after adding a card the test waits up to ten seconds for the status to say ENROLLED, and moves on the moment it does.”</li>
<li><strong>Name the trade-off.</strong> “A fresh customer per test costs a few API calls, but it makes parallel runs safe.”</li>
<li><strong>Say what you would change at scale.</strong> “With a thousand tests I would shard in CI and keep journeys to the critical paths.”</li>
<li><strong>Be honest about limits.</strong> “Our phone runs are emulation; for a release I would add real devices.”</li>
</ul>

${keyIdea('<p>Six beats: what and why, layers, data and isolation, reliability, evidence and CI, breadth. Two minutes of decisions with reasons, each one a door to a deeper answer.</p>')}

${testerEye('<p>Practise with a timer, out loud. Most people spend a minute on beat 1 and never reach reliability or CI, which are the parts that show experience.</p>')}

${interview({
  say: `<p>Use the model answer above, in your own words.</p>`,
  qa: [
    ['Why Playwright rather than Selenium?', '<p>Auto-waiting and web-first assertions remove most timing code, the test runner, fixtures, tracing, parallelism and reports come built in, and browser contexts make isolation cheap. Selenium is still common and works well, but needs more framework code around it.</p>'],
    ['Why TypeScript?', '<p>The types catch mistakes before a run, editors suggest page-object methods as you type, and it is Playwright’s main language. The suite type-checks in CI in seconds.</p>'],
    ['How do you keep tests independent?', '<p>Each test gets a new browser context. Shared demo data is only read. Tests that change data create their own customer through the API, and values the app remembers are made unique.</p>'],
    ['How do you sign in quickly?', '<p>A setup project signs the demo user in once and saves the storage state; read-only tests load it. New customers are signed in by the fixture that creates them.</p>'],
    ['How do you deal with flaky tests?', '<p>Find them with <code>--repeat-each</code> under load, read the trace, and fix the cause: wait for a real sign the page is ready, or give the test its own data. One retry on CI is a safety net, and flaky results are reviewed.</p>'],
    ['What goes in a page object, and what does not?', '<p>Locators and user actions go in; assertions stay in the tests. Lists get a method that returns a filtered locator. Shared widgets go in component classes.</p>'],
    ['How do you debug a failure that happens only in CI?', '<p>Download the run’s artifact and open the trace: it shows each action, the page before and after, network calls and console errors. Then compare with a local run.</p>'],
    ['What would you add next?', '<p>Firefox and WebKit projects on a nightly schedule, accessibility checks on the main pages, and a few real-device checks before releases.</p>'],
  ],
})}
`,
};
