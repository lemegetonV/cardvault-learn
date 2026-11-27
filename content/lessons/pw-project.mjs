import { code, terminal, interview, tree, keyIdea, testerEye } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'A Playwright test does not live on its own. It sits in a project folder with a few files that say which tools to install, where the app is, and how to run the tests. This lesson walks through that folder in CardVault’s UI suite: what each file is for, and the commands that set it up.',
  youWill: 'You will be able to explain every file in a small Playwright project and set one up from scratch.',
  body: `
<h2>Three tools underneath</h2>
<p>Three pieces of software sit under every Playwright project. It helps to keep them apart:</p>
<ul>
<li><strong>Node.js</strong> runs JavaScript and TypeScript on your computer, outside a browser. Playwright itself is a Node.js program.</li>
<li><strong>npm</strong> (the Node package manager) comes with Node.js. It downloads <strong>packages</strong>, code other people published, such as Playwright, into your project. It does the job <code>pip</code> does in Python.</li>
<li><strong>Playwright</strong> is the package you install with npm. It brings the test runner, the library, and a command to download the browsers it drives.</li>
</ul>

<h2>The folder</h2>
<p>This is CardVault’s UI suite as it stands in this part of the track. The framework folders arrive in the second part, in <a href="/learn/pw-framework-map/">the framework map</a>.</p>
${tree([
  ['tests/ui/', 0, 'The Playwright project'],
  ['package.json', 1, 'Which tools to install, and short names for common commands'],
  ['package-lock.json', 1, 'The exact version of every package, so every computer installs the same'],
  ['playwright.config.ts', 1, 'The settings Playwright reads before every run'],
  ['tsconfig.json', 1, 'Settings for the TypeScript checker'],
  ['config.ts', 1, 'Where the app is, and the demo password'],
  ['README.md', 1, 'How to run it, for the next person'],
  ['learn/', 1, 'One small test file per lesson'],
  ['first-test.spec.ts', 2, 'A test file: the name ends in .spec.ts'],
  ['helpers/', 2, 'Set-up code that tests share'],
  ['files/', 2, 'A receipt picture the upload test sends'],
  ['typescript/', 2, 'Small programs for the TypeScript lessons'],
  ['node_modules/', 1, 'The installed packages; made by npm, never committed'],
  ['playwright-report/', 1, 'The HTML report of the last run; never committed'],
  ['test-results/', 1, 'Screenshots and recordings of failed tests; never committed'],
], 'tests/ui')}
<p>The last three folders are made by tools on your computer. The <code>.gitignore</code> file keeps them out of the repository, because anyone can make them again.</p>

<h2>package.json: the tools</h2>
${code({ lang: 'json', title: 'tests/ui/package.json', src: `
{
  "name": "cardvault-ui-tests",
  "private": true,
  "description": "Playwright tests for the CardVault web app",
  "scripts": {
    "test": "playwright test",
    "learn": "playwright test --project=learn",
    "report": "playwright show-report",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@playwright/test": "1.65.1",
    "@types/node": "22.20.7",
    "typescript": "5.9.3"
  }
}
` })}
<ul>
<li><code>devDependencies</code> lists the packages and their exact versions: Playwright Test, TypeScript (for the checker), and type labels for Node.js’s own functions. “Dev” means they are needed to work on the project, not to run a product.</li>
<li><code>scripts</code> gives commands short names. <code>npm test</code> runs <code>playwright test</code>; <code>npm run typecheck</code> runs the TypeScript checker without running any test (<code>--noEmit</code> means “check only, write no files”).</li>
<li><code>"private": true</code> stops anyone publishing this folder to npm by mistake.</li>
</ul>

<h2>Setting it up</h2>
${terminal([
  ['cd tests/ui', ''],
  ['npm install', ''],
  ['npx playwright install chromium', ''],
  ['npx playwright --version', 'Version 1.65.1'],
], 'Once, on a new computer')}
<ol>
<li><code>npm install</code> reads <code>package.json</code> and <code>package-lock.json</code> and downloads the packages into <code>node_modules/</code>. On CI, <code>npm ci</code> does the same but refuses to change the lock file, so a CI run always uses exactly the committed versions.</li>
<li><code>npx</code> runs a command from a package installed in this project. <code>npx playwright install chromium</code> downloads the browser Playwright drives. Browsers are big, so they are downloaded separately from the package, into a shared folder on your computer.</li>
<li><code>npx playwright --version</code> confirms which Playwright is installed.</li>
</ol>
<p>To start a brand-new project elsewhere, <code>npm init playwright@latest</code> asks a few questions and creates a <code>package.json</code>, a config file and an example test for you. The CardVault suite was set up by hand so that every file is small enough to explain.</p>

<h2>playwright.config.ts: the settings</h2>
<p>Playwright reads this file before every run. It says how long a test may take, which reporters to use, the base address for <code>page.goto</code>, when to keep screenshots and recordings, and which <strong>projects</strong> to run: groups of tests with their own settings, such as the <code>learn</code> project, which runs <code>learn/</code> in a desktop Chrome window. The lesson on <a href="/learn/pw-config/">the config file and projects</a> reads it line by line.</p>

<h2>config.ts: where the app is</h2>
${code({ lang: 'typescript', title: 'tests/ui/config.ts', src: `
// The web app's address. Tests open pages with short paths such as "/login".
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

// The password shared by the demo customers (alice, bob, charlie and dana).
export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'CardVault-Demo-1';
` })}
<p><code>process.env.BASE_URL</code> reads an <strong>environment variable</strong>: a setting given to a program when it starts. <code>??</code> means “if there is none, use the value on the right”. So by default the tests use CardVault on your own computer, and another copy of the app needs no code change:</p>
${terminal([['BASE_URL=https://cardvault.example.com npx playwright test', '']], 'Testing another copy of the app')}
<p><code>export</code> lets other files import the name, as the test files do with <code>import { DEMO_PASSWORD } from '../config'</code>.</p>

${keyIdea('<p>package.json says which tools to install, playwright.config.ts says how to run the tests, and config.ts says where the app is. Generated folders (node_modules, reports, results) stay out of the repository.</p>')}

<h2>Running the tests</h2>
${terminal([
  ['npx playwright test', '  25 passed (16.9s)'],
  ['npx playwright test learn/locators.spec.ts', ''],
  ['npm run typecheck', ''],
], 'The everyday commands, in tests/ui')}
<p>The first runs every test file the config finds. Give a file name to run only that file. Playwright runs files in parallel by default, a few at a time; the lesson on <a href="/learn/pw-running-tests/">running what you want</a> covers the rest of the command line.</p>

${testerEye('<p>Pinning exact versions in the lock file is what makes “it passes on my machine” mean something. When CI and your laptop run the same Playwright and the same browser build, a difference in results points at the app or the test, not at the tools.</p>')}

${interview({
  say: `<p>“The UI suite is a small Node.js project. package.json pins Playwright and TypeScript, the lock file pins every dependency, and CI installs with npm ci. playwright.config.ts holds the run settings: base URL, timeouts, reporters, traces and projects. Environment details like the app’s address live in a config file that reads environment variables with local defaults, so the same tests run against any environment.”</p>`,
  qa: [
    ['What is the difference between npm install and npm ci?', '<p><code>npm install</code> installs what package.json asks for and may update the lock file. <code>npm ci</code> installs exactly what the lock file says, from a clean <code>node_modules</code>, and fails if the two disagree. CI uses <code>npm ci</code> so every run is reproducible.</p>'],
    ['Why do you run npx playwright install separately?', '<p>The npm package holds Playwright’s code but not the browsers, which are large. <code>npx playwright install</code> downloads the browser builds that match the installed Playwright version. On CI, <code>--with-deps</code> also installs the operating-system libraries the browsers need.</p>'],
    ['How do you point the same tests at a different environment?', '<p>The base URL and other environment details come from environment variables, with local defaults in a config file. Setting <code>BASE_URL</code> when running the tests switches environment without changing any test.</p>'],
  ],
})}
`,
};
