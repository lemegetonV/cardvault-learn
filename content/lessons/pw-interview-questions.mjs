import { interview, keyIdea, testerEye, reveal } from '../../src/components.mjs';

const q = (question, answer, lesson, title) =>
  reveal(question, `${answer}<p class="muted">More in <a href="/learn/${lesson}/">${title}</a>.</p>`, 'answer');

export default {
  minutes: 12,
  lede: 'This last lesson collects the Playwright questions interviewers ask most, grouped by topic. Each answer is short enough to say in under a minute and points back to the lesson that explains it. Try answering out loud before opening each one; the gaps you find are the lessons to reread.',
  youWill: 'You will be able to answer the common Playwright interview questions briefly, with an example from CardVault for each.',
  body: `
<h2>Basics</h2>
${q('What is Playwright, and how is it different from Selenium?', '<p>A library and test runner from Microsoft that drives Chromium, Firefox and WebKit. It talks to browsers over a direct protocol, waits automatically before actions, has web-first assertions that retry, and includes fixtures, parallel runs, tracing and reports. Selenium uses the WebDriver standard and needs more of that built around it.</p>', 'pw-what-is-playwright', 'What Playwright is')}
${q('What are browser, context and page?', '<p>A browser is one running browser process. A context is a fresh, separate profile inside it, with its own cookies and storage, like an incognito window. A page is a tab in a context. Each test gets its own context, which is what keeps tests isolated.</p>', 'pw-hooks-isolation', 'Hooks and test isolation')}
${q('Why does almost every Playwright call need await?', '<p>Each call talks to the browser and takes time, so it returns a promise. <code>await</code> waits for it to finish before the next line. A missing <code>await</code> lets the test run ahead and fail in confusing ways.</p>', 'pw-async-await', 'async and await')}

<h2>Locators, actions and waiting</h2>
${q('Which locators do you prefer, and why?', '<p><code>getByRole</code>, then <code>getByLabel</code> and text, because they find things the way a user does and survive markup changes. <code>getByTestId</code> when nothing user-facing fits. CSS and XPath last. In CardVault, the Cards page’s list is found by its test id and each card by its text.</p>', 'pw-locators', 'Locators')}
${q('What is auto-waiting?', '<p>Before an action, Playwright waits until the element is attached, visible, stable, enabled and able to receive the click. So most tests need no waiting code. It cannot know the app’s own logic is ready, which is why some tests wait for data first.</p>', 'pw-actions', 'Actions and auto-waiting')}
${q('What is a web-first assertion?', '<p>An <code>expect</code> on a locator or page, such as <code>toHaveText</code> or <code>toBeVisible</code>, that retries until the page matches or a timeout passes. It replaces sleeps: the test moves on the moment the page is right.</p>', 'pw-assertions', 'Web-first assertions')}
${q('How do you wait for something that is not on the page?', '<p>For a network response, <code>page.waitForResponse</code>; for data behind an API, <code>expect.poll</code> on a function; for a URL, <code>toHaveURL</code>. Never <code>waitForTimeout</code> in a real test.</p>', 'pw-waiting', 'Waiting the right way')}

<h2>Structure and set-up</h2>
${q('What are fixtures, and how do you make your own?', '<p>Values Playwright builds for each test by name, such as <code>page</code> and <code>request</code>. <code>test.extend</code> adds your own: each lists what it needs, builds a value, passes it to <code>use()</code>, and cleans up after. CardVault’s <code>customer</code> fixture creates a customer with a purchase and signs them in.</p>', 'pw-custom-fixtures', 'Custom fixtures')}
${q('What is the Page Object Model?', '<p>One class per page holding its locators and actions, so tests call <code>loginPage.signIn(...)</code> instead of repeating locators. Assertions stay in the tests. Shared widgets get component classes.</p>', 'pw-page-objects', 'Page objects')}
${q('How do you avoid signing in through the UI in every test?', '<p>A setup project signs in once and saves <code>storageState</code> to a file; tests load it with <code>test.use({ storageState })</code>. Each test still gets a fresh context.</p>', 'pw-saved-login', 'Logging in once')}
${q('Why set up test data through the API?', '<p>It is faster and more reliable than clicking through screens, and keeps the test focused on what it checks. CardVault’s UI tests create a fresh customer and a purchase through the services before the browser opens a page.</p>', 'pw-api-setup', 'API set-up for UI tests')}

<h2>Browser features</h2>
${q('How do you work inside an iframe?', '<p><code>locator.contentFrame()</code> returns a frame locator; locators built from it search inside the frame. CardVault’s wallet terms are in one.</p>', 'pw-frames', 'Frames')}
${q('How do you handle a new tab, a dialog or a download?', '<p>Start waiting for the event, then trigger it: <code>waitForEvent(\'popup\')</code> for a tab, <code>waitForEvent(\'download\')</code> for a file, and <code>page.once(\'dialog\', ...)</code> to accept or dismiss a browser dialog.</p>', 'pw-tabs-dialogs-downloads', 'Tabs, dialogs and downloads')}
${q('How do you mock the network?', '<p><code>page.route(url, handler)</code> intercepts matching requests: <code>fulfill</code> returns a made-up answer, <code>fetch</code> gets the real one to change, <code>abort</code> fails it. Useful for empty and error states.</p>', 'pw-network-mocking', 'Mocking the network')}
${q('How do you test something that depends on time?', '<p><code>page.clock</code> installs a fake clock that the test can move forward, such as fifteen minutes to reach a session timeout, without waiting for real time.</p>', 'pw-time-devices', 'Time, places and devices')}

<h2>Running, debugging and CI</h2>
${q('How do you debug a failing test?', '<p>Open its trace with <code>npx playwright show-trace</code>: every action with before and after snapshots, network, console and source. Locally, UI mode or <code>--debug</code> to step through.</p>', 'pw-debugging', 'Debugging')}
${q('How do you deal with flaky tests?', '<p>Reproduce with <code>--repeat-each</code> and several workers, read the trace, fix the cause: wait for a real sign of readiness, or isolate the data. One retry on CI as a safety net, never as the fix.</p>', 'pw-flaky-tests', 'Flaky tests')}
${q('How do tests run in parallel, and what is sharding?', '<p>Workers run test files side by side, each with its own browser; parallel mode splits tests within a file. Sharding splits the suite across machines with <code>--shard</code>. All of it depends on independent tests.</p>', 'pw-parallel', 'Parallel runs and sharding')}
${q('How do you run Playwright in CI?', '<p>Fresh app, <code>npm ci</code>, <code>npx playwright install --with-deps</code>, <code>npx playwright test</code>, and upload the report and traces with <code>if: always()</code>.</p>', 'pw-ci', 'Running in CI')}
${q('How do you do visual testing, and why can it fail on CI only?', '<p><code>toHaveScreenshot</code> compares with a saved baseline. Fonts and rendering differ between machines, so CardVault takes and compares screenshots inside Playwright’s Docker image everywhere.</p>', 'pw-visual', 'Visual comparisons')}

${keyIdea('<p>Answer in three parts: what it is, how you use it, and a short CardVault example. A concrete example turns a textbook answer into experience.</p>')}

${testerEye('<p>Interviewers often follow an answer with “and when would you not do that?”. Prepare one limit for each topic: emulation is not a real phone, mocks can hide a broken API, retries can hide real bugs, visual tests fail on harmless changes.</p>')}

${interview({
  say: `<p>“Playwright gives me isolated contexts, auto-waiting and web-first assertions, so tests have no sleeps. I structure the suite with page objects, custom fixtures and API set-up, debug from traces, and run it in CI with reports and traces uploaded on failure.”</p>`,
  qa: [
    ['What has been the hardest part of UI automation for you?', '<p>Use a real story: in this suite, a Menu click that sometimes did nothing. The trace showed the page had drawn but its scripts had not started, so the fix was to wait for the page’s data before clicking, not to add time.</p>'],
    ['What would you never put in a UI test?', '<p>Fixed sleeps, CSS paths tied to layout, shared mutable data, and checks that belong at the API level, such as every validation rule.</p>'],
  ],
})}
`,
};
