import { code, terminal, interview, table, keyIdea, testerEye } from '../../src/components.mjs';

export default {
  minutes: 9,
  lede: 'Customers use CardVault on phones as much as on computers, and in more than one browser. In <a href="/learn/pw-time-devices/">time, places and devices</a> one test file pretended to be a phone. A framework does it more simply: it runs the same tests again with different settings, through projects in the config. This lesson adds a phone project for the journeys and shows how other browsers would be added.',
  youWill: 'You will be able to run chosen tests on a phone with a project and a tag, and explain how to add other browsers and what each costs.',
  body: `
<h2>One more project</h2>
${code({ lang: 'typescript', title: 'tests/ui/playwright.config.ts', src: `
    {
      // The journeys tagged @phone, again on a Pixel 7 phone (lesson: Phones and other browsers).
      name: 'phone',
      testDir: './tests',
      grep: /@phone/,
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup'],
    },
` })}
<ul>
<li>A <strong>project</strong>, from <a href="/learn/pw-config/">the config file and projects</a>, is a group of tests with its own settings. This one points at the same <code>tests/</code> folder as the <code>framework</code> project.</li>
<li><code>grep: /@phone/</code> keeps only the tests whose title or tags contain <code>@phone</code>: the two journeys. Running every test twice would double the time for little gain; the journeys are where a phone layout matters.</li>
<li><code>devices['Pixel 7']</code> sets the screen size, touch, the pixel density and the browser’s description of itself. <code>...</code> copies all of those settings into <code>use</code>.</li>
</ul>
${terminal([['npx playwright test --project=phone', `Running 3 tests using 2 workers
  ✓  1 [setup] › learn/saved-login.setup.ts:5:1 › sign in as alice and save the login (539ms)
  ✓  2 [phone] › tests/dispute-journey.spec.ts:7:1 › dispute a purchase and see it marked in the list @phone (1.9s)
  ✓  3 [phone] › tests/wallet-journey.spec.ts:6:1 › add a card to the wallet, then remove it @phone (5.9s)
  3 passed (7.5s)`]], 'Real output, blank lines removed')}
<p>The plain <code>npx playwright test</code> runs every project, so each journey runs once as <code>[framework]</code> and once as <code>[phone]</code>. The report shows them side by side, and a failure says which project it happened in.</p>

<h2>Tests that work on both</h2>
<p>The same test code runs on a wide screen and a narrow one because the framework hides the difference. The dispute journey opens Transactions with <code>menu.goTo('Transactions')</code>; on a phone, <a href="/learn/pw-journey-disputes/">the Menu component</a> presses the Menu button first, and on a computer it does not. The wallet journey needs no change at all, because every element it uses is on screen at both sizes.</p>
<p>When a layout differs more, for example a table that becomes cards, the page object can offer one method that works on both, or the test can check <code>testInfo.project.name</code>. Keep that rare: two tests that say clearly what each checks are easier to read than one test full of branches.</p>

${keyIdea('<p>Run the same tests on a phone by adding a project with <code>devices[...]</code>, and pick which tests with <code>grep</code> and a tag. Page objects and components absorb layout differences, so the tests stay the same.</p>')}

<h2>Other browsers</h2>
<p>Playwright drives three browser engines: Chromium (the engine of Chrome and Edge), Firefox, and WebKit (the engine of Safari). CardVault’s suite uses Chromium only. Adding the others is one project each:</p>
${code({ lang: 'typescript', title: 'Example · playwright.config.ts (not in CardVault’s suite)', src: `
    { name: 'firefox', testDir: './tests', use: { ...devices['Desktop Firefox'] }, dependencies: ['setup'] },
    { name: 'webkit', testDir: './tests', use: { ...devices['Desktop Safari'] }, dependencies: ['setup'] },
    { name: 'iphone', testDir: './tests', grep: /@phone/, use: { ...devices['iPhone 15'] }, dependencies: ['setup'] },
` })}
<p>Each engine must also be installed, with <code>npx playwright install firefox webkit</code>, locally and on CI. The <code>iPhone</code> devices use WebKit, so a phone project with an iPhone tests Safari’s engine as well as the small screen.</p>
${table(['Choice', 'Gain', 'Cost'], [
  ['Chromium only', 'Fast, simple, covers most users', 'Misses engine-specific bugs'],
  ['Chromium + a phone project', 'Catches layout and touch problems', 'The chosen tests run twice'],
  ['All three engines', 'Catches Safari and Firefox bugs', 'Three times as many tests to run, and more to install'],
])}
<p>Many teams run Chromium on every pull request and all engines once a night. That decision belongs to the team, based on where its customers are; CardVault’s suite chose Chromium and a phone.</p>

${testerEye('<p>Device emulation is not a real phone. It gets the screen size, touch and browser identity right, but not the phone’s real browser build, its speed or its keyboard. For a release, teams add a short check on real devices, often through a cloud device service; emulation covers the everyday runs.</p>')}

${interview({
  say: `<p>“Cross-device and cross-browser runs are projects in the Playwright config. We have a phone project with the Pixel 7 device that runs only the journeys tagged @phone, so it adds little time. Our page objects and components, such as the menu, handle the narrow layout, so tests are unchanged. We use Chromium on every run; Firefox and WebKit would be extra projects, typically in a nightly run, and real devices for release checks.”</p>`,
  qa: [
    ['How do you run tests on mobile with Playwright?', '<p>With device emulation: a project or <code>test.use</code> with <code>devices[\'Pixel 7\']</code> or an iPhone, which sets viewport, touch, scale and user agent. It is emulation, not a real device.</p>'],
    ['How do you run tests in several browsers?', '<p>One project per browser with the matching device settings, after installing each browser. Then <code>npx playwright test</code> runs all projects, or <code>--project</code> picks some.</p>'],
    ['How do you avoid doubling the suite time?', '<p>Choose what runs where: tag the tests that matter on phones and filter the project with <code>grep</code>, run extra browsers on a schedule rather than every pull request, and shard when needed.</p>'],
  ],
})}
`,
};
