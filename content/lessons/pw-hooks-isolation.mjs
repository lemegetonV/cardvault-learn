import { code, terminal, figure, interview, table, keyIdea, sequence, testerEye } from '../../src/components.mjs';
import { contexts } from '../diagrams/playwright.mjs';

export default {
  minutes: 10,
  lede: 'Most tests in a file start the same way: open the sign-in page, sign in, wait for the wallet. Hooks let you write those steps once and run them around every test. This lesson shows the four hooks, how to group tests with describe, and why each test still starts with a clean browser.',
  youWill: 'You will be able to choose the right hook for set-up and clean-up, and explain why Playwright tests are isolated from each other.',
  body: `
<h2>Four hooks</h2>
<p>You met <code>test.beforeEach</code> in <a href="/learn/pw-locators/">the locators lesson</a>: a function that runs before every test in its file. It has three relatives. A <strong>hook</strong> is any of these functions that Playwright calls around your tests, at fixed moments:</p>
${table(['Hook', 'Runs', 'Typical use'], [
  ['`test.beforeAll`', 'Once, before the first test in the file or group', 'A check or set-up shared by all the tests, with no browser page'],
  ['`test.beforeEach`', 'Before every test', 'Sign in, open the page under test'],
  ['`test.afterEach`', 'After every test, even a failed one', 'Clean up something the test made outside the browser'],
  ['`test.afterAll`', 'Once, after the last test', 'Clean up what beforeAll made'],
])}

<h2>The file: a group, a shared check, and a clean start</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/hooks.spec.ts', src: `
// beforeAll runs once, before the first test in this file. It gets no page,
// because pages belong to single tests. Here it checks that the app is up,
// so a stopped app gives one clear error instead of a failure in every test.
test.beforeAll(async ({ request }) => {
  const response = await request.get('/api/health');
  expect(response.ok()).toBe(true);
});
` })}
<p><code>beforeAll</code> can ask for <code>request</code>, which sends HTTP requests without a browser, but not for <code>page</code>. A page belongs to one test, and <code>beforeAll</code> runs before any test has started. <code>/api/health</code> is the web app’s “I am running” address; <code>response.ok()</code> is <code>true</code> for any status from 200 to 299.</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/hooks.spec.ts', src: `
// test.describe puts tests in a named group. The hook inside it runs only for
// the tests in the group.
test.describe('signed in as alice', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Username').fill('alice');
    await page.getByLabel('Password').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/wallet');
  });

  test('her wallet lists four cards', async ({ page }) => {
    await expect(page.getByTestId('wallet-cards').getByRole('listitem')).toHaveCount(4);
  });

  test('her profile shows her email address', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.getByTestId('profile-email')).toHaveValue('alice@example.com');
  });
});
` })}
<ul>
<li><code>test.describe(name, () =&gt; { ... })</code> makes a <strong>group</strong>. The name is added to each test’s name in the report: “signed in as alice › her wallet lists four cards”.</li>
<li>A hook inside a group runs only for that group’s tests. A hook at the top of the file runs for every test in the file.</li>
<li>The hook signs in, then each test does only its own part. The <code>page</code> in the hook and the <code>page</code> in the test are the same tab.</li>
</ul>

<h2>Every test starts clean</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/hooks.spec.ts', src: `
// This test is outside the group, so the sign-in hook does not run for it.
// It also proves that nothing is left over from the tests above: every test
// gets a fresh browser context, with no cookies, so it starts signed out.
test('every test starts signed out', async ({ page }) => {
  await page.goto('/wallet');

  // A signed-out visitor is sent to the sign-in page.
  await expect(page).toHaveURL(/\\/login/);
});
` })}
${figure({ svg: contexts(), caption: 'The picture from the first lesson, now in practice: two tests signed in as alice, and the third still starts signed out.' })}
<p>This is <strong>test isolation</strong>. Each test gets a new browser context: an empty browser profile with no cookies, no storage and no sign-in. So tests can run in any order, or at the same time, and one test’s leftovers can never make another pass or fail. The pattern <code>/\\/login/</code> means “the address contains /login”; the backslash makes the slash a plain character.</p>

<h2>The order of a run</h2>
${sequence({
  id: 'hooks-order',
  label: 'What Playwright runs for this file',
  actors: [
    { id: 'r', label: 'Test runner', kind: 'plain' },
    { id: 'h', label: 'Hooks', kind: 'plain' },
    { id: 't', label: 'Tests', kind: 'plain' },
  ],
  steps: [
    { from: 'r', to: 'h', label: 'beforeAll', note: 'Once: is the app up? If this fails, the tests in the file do not run.' },
    { from: 'r', to: 'h', label: 'beforeEach', note: 'A fresh context and page, then the group’s hook signs in.' },
    { from: 'r', to: 't', label: 'four cards', note: 'The first test in the group runs. Its context is then thrown away.' },
    { from: 'r', to: 'h', label: 'beforeEach', note: 'Another fresh context, signed in again.' },
    { from: 'r', to: 't', label: 'profile email', note: 'The second test in the group.' },
    { from: 'r', to: 't', label: 'signed out', note: 'Outside the group: a fresh context and no sign-in hook.' },
  ],
  caption: 'Contexts are created before each test and closed after it, so there is nothing to clean up in the browser.',
})}
<p>When <code>beforeAll</code> fails, Playwright reports the failure once and skips the rest. With the app stopped, the real output was:</p>
${terminal([['npx playwright test learn/hooks.spec.ts', `  ✘  1 [learn] › learn/hooks.spec.ts:23:3 › signed in as alice › her wallet lists four cards (0ms)
  -  2 [learn] › learn/hooks.spec.ts:27:3 › signed in as alice › her profile shows her email address
  -  3 [learn] › learn/hooks.spec.ts:36:1 › every test starts signed out

    Error: apiRequestContext.get: connect ECONNREFUSED 127.0.0.1:3999

  1 failed
  2 did not run`]], 'Real output, shortened, with BASE_URL pointing at a port where nothing runs')}

<h2>What about afterEach?</h2>
<p>Because each context is thrown away, you rarely need <code>afterEach</code> for the browser. You need it for things the test created <em>outside</em> the browser that would otherwise pile up, such as a record made through an API:</p>
${code({ lang: 'typescript', title: 'Example · clean up after every test', src: `
test.afterEach(async ({ request }) => {
  // Runs after every test, also when the test failed.
  await request.delete('/api/notes/' + noteId);
});
` })}
<p>CardVault’s suite avoids this. Tests that change data create a brand-new customer each time, as in <a href="/learn/pw-forms/">forms and uploads</a>, and the test environment can be reset as a whole, so nothing needs deleting.</p>

${keyIdea('<p>Put shared steps in <code>beforeEach</code>, group related tests with <code>describe</code>, and rely on a fresh context per test instead of cleaning the browser up. Use <code>afterEach</code> only for things made outside the browser.</p>')}

${testerEye('<p>A test that passes alone but fails in a full run, or the other way round, usually depends on another test: data it left behind, or an order it assumed. Isolation removes that for browser state. For server data, each test needs data of its own, or data that no test changes.</p>')}

${interview({
  say: `<p>“Playwright gives every test a fresh browser context, so tests are isolated: no cookies or sign-in carry over, and they can run in any order or in parallel. I use beforeEach for shared steps like signing in, describe to group tests with their own hooks, and beforeAll only for set-up that needs no page. afterEach is for cleaning up data created outside the browser; where I can, I avoid it by giving each test its own fresh data.”</p>`,
  qa: [
    ['What is the difference between beforeAll and beforeEach?', '<p><code>beforeEach</code> runs before every test and can use <code>page</code>. <code>beforeAll</code> runs once for the file or group, before any test, and cannot use <code>page</code> because a page belongs to a single test. It suits one-off checks or set-up through the API.</p>'],
    ['How does Playwright keep tests independent?', '<p>Each test gets a new browser context, like a fresh incognito profile, which is closed after the test. Cookies, storage and sign-in never leak between tests. Server-side data is the tester’s job: give each test its own data or use data nobody changes.</p>'],
    ['Does afterEach run if the test fails?', '<p>Yes. After hooks run whether the test passed or failed, which is why clean-up belongs there and not on the last line of the test.</p>'],
  ],
})}
`,
};
