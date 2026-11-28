import { figure, interview, keyIdea, table, testerEye } from '../../src/components.mjs';
import { howItDrives, contexts } from '../diagrams/playwright.mjs';

export default {
  minutes: 10,
  lede: 'The API track tested CardVault by sending requests straight to its services. This track tests it the way a customer uses it: in a browser, by clicking and typing. Playwright is the tool that drives that browser. This lesson explains what it is, how it works, and why teams choose it.',
  youWill: 'You will be able to explain what Playwright is, draw how a test reaches the app, and say how it differs from Selenium.',
  body: `
<h2>Two ways to test the same app</h2>
<p>An <strong>API test</strong> talks to a service directly. It is fast and precise, but it never sees a screen. A <strong>UI test</strong> (user interface test) opens the real web app in a real browser, clicks buttons, fills in fields and checks what appears, exactly as a customer would. It is slower, but it is the only kind of test that proves the screens actually work.</p>
<p>Teams use both. Most checks go in API tests, because they are fast and stable. UI tests cover the journeys a customer cares about: signing in, adding a card to the wallet, opening a dispute. In CardVault, the <a href="/learn/py-first-test/">API track</a> tested the services; this track tests the web app on top of them.</p>

<h2>What Playwright is</h2>
<p><strong>Playwright</strong> is a free, open-source tool from Microsoft for automating web browsers. It comes in two parts that you install as one package, <code>@playwright/test</code>:</p>
<ul>
<li>A <strong>library</strong> that controls a browser: open a page, click, type, read text.</li>
<li>A <strong>test runner</strong>, called Playwright Test, that finds your test files, runs them (several at once), retries failures if you ask, and writes a report. In the API track, pytest was the runner; here Playwright brings its own.</li>
</ul>
<p>It drives the three browser engines people actually use: <strong>Chromium</strong> (Chrome and Edge), <strong>Firefox</strong>, and <strong>WebKit</strong> (the engine inside Safari). It can be used from TypeScript, JavaScript, Python, Java and C#. This track uses TypeScript, because Playwright’s own test runner is built for it.</p>

<h2>How a test reaches the app</h2>
${figure({ svg: howItDrives(), caption: 'Your test gives commands. Playwright passes them to a real browser. The page inside it loads CardVault, and Playwright reports back what the page shows.' })}
<p>Follow one line of a test, “click the Sign in button”:</p>
<ol>
<li>Your test file asks Playwright to click the button.</li>
<li>Playwright finds the button in the page, waits until it can really be clicked, and tells the browser to click it.</li>
<li>The browser does what a person’s click would do: the web app sends the sign-in request to CardVault and shows the wallet page.</li>
<li>Your next line asks what the page shows now, and checks it.</li>
</ol>

<h2>Browser, context and page</h2>
<p>Three words come up in every Playwright conversation:</p>
${table(['Word', 'What it is', 'Think of it as'], [
  ['Browser', 'One running copy of Chromium, Firefox or WebKit', 'The browser program'],
  ['Context', 'A fresh, empty browser profile inside it: no cookies, no history, no saved sign-in', 'A brand-new private window'],
  ['Page', 'One tab inside a context', 'A tab'],
])}
${figure({ svg: contexts(), caption: 'Playwright gives every test its own context, so one test can never see another test’s cookies or sign-in. Data stored by the app itself is shared; <a href="/learn/pw-forms/">forms and uploads</a> shows how tests deal with that.' })}
<p>Starting a browser is slow; creating a context takes a few milliseconds. So Playwright starts the browser once and gives <strong>every test a new context</strong>. That is why one test can sign in as alice while the next starts signed out, with nothing leaking between them. The lesson on <a href="/learn/pw-hooks-isolation/">test isolation</a> goes deeper.</p>

${keyIdea('<p>Playwright is a browser-automation library plus a test runner. Each test gets a fresh browser context, like a new private window, so nothing one test leaves in the browser can affect another.</p>')}

<h2>Why teams choose Playwright</h2>
<p>For years the standard tool was <strong>Selenium</strong>, and you will be asked to compare the two. These are the differences that matter in practice:</p>
${table(['', 'Selenium', 'Playwright'], [
  ['Waiting', 'You add waits yourself; missing ones cause random failures', 'Waits automatically before every action and in every web-first check'],
  ['Test runner', 'Bring your own (JUnit, TestNG, pytest)', 'Built in, with parallel runs, retries and reports'],
  ['Isolation', 'A new browser per test is slow, so tests often share one', 'A new context per test is cheap, so every test starts clean'],
  ['Debugging', 'Logs and screenshots you set up yourself', 'Trace viewer: a recording of every step, with the page at each moment'],
  ['Extras', 'Mostly add-on libraries', 'Network mocking, API requests, phone emulation, fake time, built in'],
])}
<p>Selenium is still widely used and supports more languages and older browsers. Many companies run both. A fair answer in an interview names the trade-off instead of declaring a winner.</p>

${testerEye('<p>The biggest daily difference is waiting. A web app changes a moment after you click: data loads, a badge updates, a message appears. Playwright waits for those changes by itself, which removes the most common cause of flaky UI tests: a check that ran a moment too early.</p>')}

<h2>What this track covers</h2>
<p>The first part teaches Playwright itself, one concept at a time, each shown with a short test against the real CardVault web app: finding things on the page, acting on them, checking them, the test runner, frames, tabs, network mocking, fake time, phones, API calls, saved sign-ins, debugging and reports. The second part puts those pieces together into a small test framework for CardVault, runs it in CI, and practises explaining it.</p>

${interview({
  say: `<p>“Playwright is an open-source browser-automation tool from Microsoft with its own test runner. It drives Chromium, Firefox and WebKit. Each test gets a fresh browser context, like a private window, so tests are isolated and can run in parallel. Compared with Selenium, its biggest advantages are automatic waiting, which cuts flakiness, a built-in runner, and the trace viewer for debugging.”</p>`,
  qa: [
    ['What is the difference between a browser, a context and a page?', '<p>The browser is one running copy of Chromium, Firefox or WebKit. A context is an isolated profile inside it, with its own cookies and storage, like a private window. A page is a tab inside a context. Playwright creates a new context for every test.</p>'],
    ['Why would you choose Playwright over Selenium?', '<p>Automatic waiting before actions and in assertions, which removes most timing problems; a built-in runner with parallel runs, retries and reports; cheap isolation through contexts; the trace viewer; and built-in network mocking and API testing. Selenium still wins on language and legacy-browser coverage, and has a large existing ecosystem.</p>'],
    ['When would you write a UI test instead of an API test?', '<p>When the thing at risk is what the customer sees or does: a journey through several screens, a form, a message that must appear. Rules and data checks are faster and more stable as API tests, so I keep the UI suite small and focused on key journeys.</p>'],
  ],
})}
`,
};
