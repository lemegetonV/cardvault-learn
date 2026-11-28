import { code, terminal, interview, keyIdea, sequence, testerEye } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'Almost every test so far starts by signing in through the form: four steps and about half a second, every time. Across hundreds of tests, that adds up, and it tests the sign-in page hundreds of times for no reason. Playwright can sign in once, save the result to a file, and start other tests already signed in. This lesson shows how, with a setup project.',
  youWill: 'You will be able to save a login with storageState and reuse it through a setup project.',
  body: `
<h2>What “signed in” really is</h2>
<p>After you sign in, the browser holds a few <strong>cookies</strong>: small pieces of data the web app set, which the browser sends back with every request. In CardVault, one of them carries the access token. Being signed in is nothing more than having those cookies. So if a test can start with them already in place, it starts signed in.</p>
<p>Playwright calls the cookies and local storage of a context its <strong>storage state</strong>. It can write them to a JSON file and load them into a new context.</p>

<h2>Step 1: a setup test that saves the login</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/saved-login.setup.ts', src: `
// \`test as setup\` only renames test, so the report reads "setup".
setup('sign in as alice and save the login', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');

  // storageState writes the context's cookies and local storage to a file.
  await page.context().storageState({ path: ALICE_LOGIN });
});
` })}
<ul>
<li>The file starts with <code>import { test as setup, expect } from '@playwright/test'</code>. <code>as</code> gives an import another name; nothing else changes.</li>
<li>The sign-in is the one you know. Waiting for <code>/wallet</code> matters even more here: the cookie is set by the sign-in response, so saving earlier would save a signed-out state.</li>
<li><code>page.context()</code> is the page’s context. <code>storageState({ path })</code> writes its cookies and storage to that file.</li>
<li><code>ALICE_LOGIN</code> comes from <code>config.ts</code>: <code>'.auth/alice.json'</code>. The <code>.auth/</code> folder is in <code>.gitignore</code>, because while it is valid, a saved login is as good as a password.</li>
</ul>

<h2>Step 2: run it first</h2>
<p>The file name ends in <code>.setup.ts</code>, not <code>.spec.ts</code>, so the normal tests do not pick it up. The config gives it a project of its own and makes the lesson tests depend on it, as you read in <a href="/learn/pw-config/">the config file and projects</a>:</p>
${code({ lang: 'typescript', title: 'tests/ui/playwright.config.ts', src: `
    {
      // Runs first: signs in once and saves the login to a file (lesson: Logging in once).
      name: 'setup',
      testDir: './learn',
      testMatch: '*.setup.ts',
    },
` })}
<p>With <code>dependencies: ['setup']</code> on the <code>learn</code> project, every run does the setup first. If setup fails, the tests that depend on it do not run, which gives one clear failure instead of many confusing ones.</p>

<h2>Step 3: start a test already signed in</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/saved-login.spec.ts', src: `
// Every test in this file starts with alice's saved login, so it begins
// signed in, without opening the sign-in page at all.
test.use({ storageState: ALICE_LOGIN });

test('open the Cards page straight away, already signed in', async ({ page }) => {
  await page.goto('/cards');

  await expect(page).toHaveURL('/cards');
  await expect(page.getByRole('heading', { name: 'Cards' })).toBeVisible();
});

test('the saved login belongs to alice', async ({ page }) => {
  await page.goto('/profile');

  await expect(page.getByTestId('profile-email')).toHaveValue('alice@example.com');
});
` })}
<p><code>test.use({ storageState })</code> tells Playwright to load the file into each new context in this file. Each test still gets its own fresh context, so isolation holds; the context simply starts with alice’s cookies. The first test checks that <code>/cards</code> opens without being sent to the sign-in page. The second checks that the login is alice’s, not just anyone’s.</p>

<h2>The run, in order</h2>
${sequence({
  id: 'saved-login-run',
  label: 'One run with a setup project',
  actors: [
    { id: 's', label: 'setup project', kind: 'plain' },
    { id: 'f', label: '.auth/alice.json', kind: 'plain' },
    { id: 't', label: 'learn tests', kind: 'plain' },
  ],
  steps: [
    { from: 's', to: 's', label: 'sign in once', note: 'The setup test signs in through the form, like a customer.' },
    { from: 's', to: 'f', label: 'save cookies', note: '`storageState({ path })` writes the cookies to the file.' },
    { from: 'f', to: 't', label: 'load cookies', note: 'Each test with `test.use({ storageState })` gets a fresh context with those cookies.' },
    { from: 't', to: 't', label: 'goto /cards', note: 'The test opens the page it needs, already signed in.' },
  ],
  caption: 'One sign-in through the form per run, then every test that wants it starts signed in.',
})}
${terminal([['npx playwright test learn/saved-login.spec.ts', `Running 3 tests using 1 worker

  ✓  1 [setup] › learn/saved-login.setup.ts:5:1 › sign in as alice and save the login (639ms)
  ✓  2 [learn] › learn/saved-login.spec.ts:8:1 › open the Cards page straight away, already signed in (402ms)
  ✓  3 [learn] › learn/saved-login.spec.ts:15:1 › the saved login belongs to alice (296ms)

  3 passed (2.6s)`]], 'Real output: asking for one file still runs its setup first')}

${keyIdea('<p>Sign in once in a setup project, save the context with <code>storageState({ path })</code>, and load it with <code>test.use({ storageState })</code>. Tests stay isolated, because each still gets a fresh context, just one that starts signed in.</p>')}

<h2>Things to keep in mind</h2>
<ul>
<li><strong>A saved login expires.</strong> CardVault’s session lasts 15 minutes. Because the setup runs at the start of every run, each run gets a fresh one.</li>
<li><strong>Tests that change data still need their own customer.</strong> A saved login shares one account. It suits tests that only read, like these. Tests that change data use a new customer each, as in <a href="/learn/pw-forms/">forms and uploads</a>.</li>
<li><strong>Keep at least one real sign-in test.</strong> Skipping the form everywhere means only the setup step exercises it. The sign-in page deserves tests of its own, like <a href="/learn/pw-first-test/">your first test</a>.</li>
</ul>

${testerEye('<p>Signing in through the UI once per run, and reusing the result, is the standard way to keep a large suite fast. An even faster version signs in through the API in the setup step, and saves that. The framework part of this track builds on the same idea in <a href="/learn/pw-custom-fixtures/">custom fixtures</a>.</p>')}

${interview({
  say: `<p>“To avoid logging in through the UI in every test, a setup project signs in once and saves the context’s cookies and storage with storageState to a gitignored file. The test projects depend on setup and load that file with test.use storageState, so each test gets a fresh, isolated context that is already signed in. I keep dedicated tests for the login page itself, and data-changing tests still get their own user.”</p>`,
  qa: [
    ['How do you avoid logging in before every test?', '<p>Log in once in a setup project, save the state with <code>context.storageState({ path })</code>, make the other projects depend on setup, and load the file with <code>storageState</code> in <code>use</code>. Each test starts signed in.</p>'],
    ['Does reusing storage state break test isolation?', '<p>No. Each test still gets a new context; it is created with the saved cookies. What tests share is the account on the server, so tests that change data should use their own users.</p>'],
    ['What is in a storage state file, and why keep it out of Git?', '<p>The cookies and local storage of a context, as JSON, including the session cookie. While it is valid, anyone holding it is signed in as that user, so it belongs in a gitignored folder.</p>'],
  ],
})}
`,
};
