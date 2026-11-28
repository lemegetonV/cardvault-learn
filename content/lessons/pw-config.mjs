import { code, interview, table, keyIdea, testerEye } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'Some decisions apply to every test: how long a test may run, where the app is, what evidence to keep when something fails. Writing them in each test would be repetitive and easy to get wrong. Playwright reads them from one file, playwright.config.ts. This lesson reads CardVault’s config line by line, then shows how one test file can change a setting for itself.',
  youWill: 'You will be able to explain each part of a Playwright config, including projects, and override a setting for one file.',
  body: `
<h2>One file, read before every run</h2>
<p>When you type <code>npx playwright test</code>, Playwright first looks for <code>playwright.config.ts</code> in the current folder and loads it. Everything else, which files to run, in which browser and with which settings, follows from it. <a href="/learn/pw-project/">A Playwright project</a> named this file; here is what is inside.</p>

<h2>The top: time, retries and reporters</h2>
${code({ lang: 'typescript', title: 'tests/ui/playwright.config.ts', src: `
import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './config';

// The one settings file Playwright reads before every run.
export default defineConfig({
  // Run every test for at most 30 seconds.
  timeout: 30_000,

  // Retry a failed test once on CI only. Locally, a failure stays a failure.
  retries: process.env.CI ? 1 : 0,

  // What to print while tests run, and the HTML report to open afterwards.
  reporter: [['list'], ['html', { open: 'never' }]],
` })}
<ul>
<li><code>defineConfig({ ... })</code> wraps the settings object. It changes nothing at run time; it lets the TypeScript checker and your editor know which settings exist, so a misspelt one is flagged.</li>
<li><code>export default</code> makes the object the file’s main export, which is what Playwright looks for.</li>
<li><code>timeout: 30_000</code> is the limit for one whole test, including its <code>beforeEach</code> and <code>afterEach</code> hooks, in milliseconds. The underscore only makes the number easier to read. It is a different limit from the 5 seconds a single <a href="/learn/pw-assertions/">web-first assertion</a> keeps trying.</li>
<li><code>process.env.CI ? 1 : 0</code> reads “if the CI variable is set, 1, otherwise 0”. GitHub Actions sets <code>CI</code> on every run. The <code>? :</code> form is called a <strong>conditional expression</strong>: a short if-else that gives a value.</li>
<li><code>reporter</code> lists two reporters: <code>list</code> prints one line per test as it finishes; <code>html</code> writes the report you open with <code>npx playwright show-report</code>, without opening it by itself.</li>
</ul>

<h2>use: settings every test gets</h2>
${code({ lang: 'typescript', title: 'tests/ui/playwright.config.ts', src: `
  // Settings every test gets.
  use: {
    baseURL: BASE_URL, // page.goto('/login') opens BASE_URL + '/login'
    trace: 'retain-on-failure', // keep a full recording of each failed test
    screenshot: 'only-on-failure',
  },
` })}
<p>The <code>use</code> block sets <strong>options</strong>: settings for the browser, the context and the fixtures. <code>baseURL</code> comes from <code>config.ts</code>, so the address can change through an environment variable. A <strong>trace</strong> is a recording of everything the test did; <code>retain-on-failure</code> records every test but keeps the file only when the test fails. <a href="/learn/pw-debugging/">Debugging</a> opens one.</p>

<h2>projects: groups of tests with their own settings</h2>
${code({ lang: 'typescript', title: 'tests/ui/playwright.config.ts', src: `
  // A project is one group of tests with its own settings.
  projects: [
    {
      // Runs first: signs in once and saves the login to a file (lesson: Logging in once).
      name: 'setup',
      testDir: './learn',
      testMatch: '*.setup.ts',
    },
    {
      // The small tests in learn/, one file per lesson, in a desktop Chrome window.
      name: 'learn',
      testDir: './learn',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'], // run the setup project before this one
    },
    ...
  ],
` })}
<p>A <strong>project</strong> is a named group of tests with its own settings. Each one says where its files are (<code>testDir</code>) and, optionally, which file names count (<code>testMatch</code>). By default Playwright treats files ending in <code>.spec.ts</code> or <code>.test.ts</code> as tests.</p>
<ul>
<li>The <code>setup</code> project runs only files ending in <code>.setup.ts</code>. It signs in once and saves the login; <a href="/learn/pw-saved-login/">logging in once</a> explains why.</li>
<li>The <code>learn</code> project runs the lesson tests. <code>dependencies: ['setup']</code> makes Playwright finish the setup project first.</li>
<li><code>devices['Desktop Chrome']</code> is a ready-made set of options: window size, user agent and browser. The three dots are the <strong>spread</strong> syntax: they copy every setting from that object into this one.</li>
</ul>
<p>A project’s <code>use</code> is added on top of the top-level <code>use</code>, so the <code>learn</code> tests get <code>baseURL</code> and the trace settings too. The <code>...</code> stands for two more projects in the same file, <code>framework</code> and <code>phone</code>, which Part 2 uses (<a href="/learn/pw-phones-browsers/">phones and other browsers</a>). <code>npx playwright test --project=learn</code> runs a single project, plus the <code>setup</code> project it depends on.</p>
<p>Two meanings of “project” meet here. The <em>project folder</em> from <a href="/learn/pw-project/">a Playwright project</a> is the whole <code>tests/ui</code> folder; a <em>config project</em> is one of these named groups inside it.</p>

<h2>Changing a setting for one file</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/config.spec.ts', src: `
// test.use changes settings from playwright.config.ts for the tests in this
// file only. Here: a narrow window, the width of a phone.
test.use({ viewport: { width: 390, height: 844 } });
` })}
<p><code>test.use</code> takes the same options as the config’s <code>use</code> block and applies them to the tests in this file, or in one <code>describe</code> group if you put it there. The <strong>viewport</strong> is the visible area of the page, in pixels.</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/config.spec.ts', src: `
test('on a narrow screen the links hide behind a Menu button', async ({ page }) => {
  const menu = page.getByRole('button', { name: 'Menu' });
  const cardsLink = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Cards' });

  await expect(menu).toBeVisible();
  await expect(cardsLink).toBeHidden();

  await menu.click();
  await expect(cardsLink).toBeVisible();
});
` })}
<p>CardVault folds its navigation into a Menu button below 768 pixels. At 390 the links start hidden, and the button shows them. The file’s <code>beforeEach</code> signs in and waits until alice’s four cards are listed, because until the page has finished starting up, the Menu button may not respond to a click yet.</p>

${keyIdea('<p>playwright.config.ts holds the settings for every run: time limits, retries, reporters, the <code>use</code> options and the projects. <code>test.use</code> changes options for one file or group, without touching the others.</p>')}

<h2>Other settings you will meet</h2>
${table(['Setting', 'What it does'], [
  ['`expect: { timeout: 5_000 }`', 'How long web-first assertions keep trying (5 seconds is the default)'],
  ['`workers`', 'How many tests run at once'],
  ['`fullyParallel`', 'Also run the tests inside one file in parallel'],
  ['`outputDir`', 'Where traces and screenshots go (default `test-results`)'],
  ['`use: { locale, timezoneId }`', 'The browser’s language and time zone'],
  ['`use: { video }`', 'Record a video of each test'],
])}

${testerEye('<p>Retrying only on CI is a deliberate choice. A retry hides a test that fails one time in ten, so locally every failure stays visible. On CI one retry keeps a rare hiccup from blocking a merge, and the report still marks the test as flaky so it gets looked at.</p>')}

${interview({
  say: `<p>“playwright.config.ts defines the run: the test timeout, retries (only on CI for us), reporters, and a use block with the base URL and evidence settings, traces and screenshots on failure. Projects group tests with their own settings and can depend on each other; we have a setup project that saves the login and a learn project that depends on it. For one file I override options with test.use, for example a phone-sized viewport.”</p>`,
  qa: [
    ['What is a project in Playwright?', '<p>A named group of tests with its own settings: test folder, file pattern, browser or device, and options. Projects let the same tests run in several browsers or devices, and a project can depend on another, such as a setup project that runs first.</p>'],
    ['What is the difference between timeout and expect timeout?', '<p><code>timeout</code> limits one whole test, including its beforeEach and afterEach hooks (30 seconds by default). <code>expect.timeout</code> limits how long a single web-first assertion keeps retrying (5 seconds by default).</p>'],
    ['How do you change a setting for only some tests?', '<p>Call <code>test.use({ ... })</code> at the top of a file or inside a <code>describe</code> group. It overrides the config’s <code>use</code> options for those tests only.</p>'],
  ],
})}
`,
};
