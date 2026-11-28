import { code, interview, table, keyIdea, sequence, shot, testerEye } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'Once a locator has found an element, an action does something with it: click it, type into it, tick it, choose an option. This lesson covers the actions tests use most, on the filters of CardVault’s transactions page, and the checks Playwright makes before every action so that tests do not need waits.',
  youWill: 'You will be able to use the common actions and explain auto-waiting and actionability checks.',
  body: `
<h2>The page: transaction filters</h2>
${shot({ src: 'transactions.png', alt: 'The Wallet transactions page with card checkboxes, a status select box, From and To date fields, Clear and Apply buttons, and a list of transactions.', caption: 'The filters use most kinds of form control. Filtering only reads data, so alice’s account is never changed.' })}
<p>Every test in the file signs in and opens this page first:</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/actions.spec.ts', src: `
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  // press() types one key. Enter in a form field sends the form.
  await page.getByLabel('Password').press('Enter');
  // The wallet page has two Transactions links; use the one in the main navigation.
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Transactions' }).click();
});
` })}
<p>Two actions are new here. <code>press('Enter')</code> presses one key in the field, which sends the form just as a person pressing Enter would. Then the test clicks a link in the navigation, which exists only after the sign-in has finished. The test does not wait for the wallet page: <code>click()</code> waits for the link by itself. That is the subject of this lesson.</p>

<h2>Choosing from a select box</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/actions.spec.ts', src: `
test('choose a status from the select box', async ({ page }) => {
  await page.getByLabel('Status').selectOption('SETTLED');
  await page.getByRole('button', { name: 'Apply' }).click();

  // The filters go into the page address, so a filtered list can be shared.
  await expect(page).toHaveURL(/status=SETTLED/);
});
` })}
<p><code>selectOption('SETTLED')</code> chooses the option whose value is <code>SETTLED</code>. You can also choose by the text shown, with <code>selectOption({ label: 'Settled' })</code>. <code>/status=SETTLED/</code> is a <strong>regular expression</strong>: a text pattern between slashes. Here it simply means “the address contains <code>status=SETTLED</code>”.</p>

<h2>Ticking a checkbox</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/actions.spec.ts', src: `
test('tick and untick a card', async ({ page }) => {
  const credit = page.getByRole('checkbox', { name: 'CREDIT •••• 4417' });

  await credit.check();
  await expect(credit).toBeChecked();

  await credit.uncheck();
  await expect(credit).not.toBeChecked();
});
` })}
<p><code>check()</code> ticks a checkbox and <code>uncheck()</code> clears it. Prefer them to <code>click()</code>: a click flips the box whatever state it was in, while <code>check()</code> makes sure it ends up ticked and fails if it does not.</p>

<h2>Typing into fields</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/actions.spec.ts', src: `
test('type dates into date fields', async ({ page }) => {
  // A date field takes its value as year-month-day, whatever it shows on screen.
  await page.getByLabel('From').fill('2026-02-01');
  await page.getByLabel('To').fill('2026-01-01');
  await page.getByRole('button', { name: 'Apply' }).click();

  await expect(page.getByText('The From date must not be after the To date.')).toBeVisible();
});
` })}
<p><code>fill()</code> clears a field and sets its whole value at once. It works for text, password and date fields. The test also checks the page’s rule: a From date after the To date is refused with a message.</p>

<h2>What Playwright checks before an action</h2>
<p>Before <code>click()</code> clicks, Playwright makes sure a person could really click the element. These are the <strong>actionability checks</strong>, and the waiting they cause is called <strong>auto-waiting</strong>:</p>
${sequence({
  id: 'actionability',
  label: 'What one click() does',
  actors: [
    { id: 't', label: 'Your test', kind: 'plain' },
    { id: 'p', label: 'Playwright', kind: 'plain' },
    { id: 'b', label: 'Page', kind: 'plain' },
  ],
  steps: [
    { from: 't', to: 'p', label: 'click Apply', note: 'The test asks for a click and awaits it.' },
    { from: 'p', to: 'b', label: 'find exactly one', note: 'Playwright resolves the locator. Not there yet? It keeps looking. More than one match? It fails at once (strict mode).' },
    { from: 'p', to: 'b', label: 'visible? stable?', note: 'The element must be visible, and not moving, for example in the middle of an animation.' },
    { from: 'p', to: 'b', label: 'enabled? not covered?', note: 'It must be enabled, and no other element, such as a dialog or a banner, may sit on top of it and catch the click.' },
    { from: 'p', to: 'b', label: 'click', note: 'Only now does Playwright scroll it into view and click it, like a mouse would.' },
    { from: 'p', to: 't', label: 'done', kind: 'reply', note: 'The promise is fulfilled and the test goes on. If the checks never pass, the action keeps trying until the test timeout.' },
  ],
  caption: 'Every check is retried until it passes, so a button that becomes enabled half a second later is simply clicked half a second later.',
})}
<p>Different actions need different checks. <code>fill()</code> needs a visible, enabled and editable field; <code>check()</code> needs the same as a click. If a check never passes, the action keeps trying until the test runs out of time, and the call log in the error says which check was failing, such as “element is disabled”.</p>

${keyIdea('<p>Every action waits until its element is ready: found, visible, stable, enabled and not covered. That is why Playwright tests have no sleeps before clicks.</p>')}

<h2>The common actions</h2>
${table(['Action', 'Does', 'Notes'], [
  ['`click()`', 'Clicks the element', '`dblclick()` double-clicks'],
  ['`fill(text)`', 'Clears the field and sets its value', 'Text, password, date, text areas'],
  ['`press(key)`', 'Presses one key, such as `\'Enter\'` or `\'Tab\'`', 'For keyboard behaviour'],
  ['`pressSequentially(text)`', 'Types one character at a time', 'Only when the page reacts to each key'],
  ['`check()`, `uncheck()`', 'Ticks or clears a checkbox (`check()` also selects a radio button)', 'Fails if the box does not end up in that state'],
  ['`selectOption(value)`', 'Chooses from a select box', 'By value or `{ label }`'],
  ['`setInputFiles(path)`', 'Puts a file in a file field', 'Covered in the forms lesson'],
  ['`hover()`', 'Moves the mouse over the element', 'For menus that open on hover'],
])}

${testerEye('<p>Auto-waiting does not wait for everything. It waits for the element you act on, not for data the page loads afterwards. After clicking Apply, the list reloads in the background; checking it needs an assertion that waits, which is the next lesson, <a href="/learn/pw-assertions/">web-first assertions</a>.</p>')}

${interview({
  say: `<p>“Before every action Playwright runs actionability checks: the locator must resolve to one element that is visible, stable, enabled and able to receive the click. It retries those checks until they pass, which is auto-waiting, so I never put sleeps before actions. I prefer intent-revealing actions like check() and selectOption() over raw clicks, and fill() over typing key by key.”</p>`,
  qa: [
    ['What is auto-waiting?', '<p>Before an action, Playwright waits until the target element is ready: visible, stable, enabled and not covered by another element. It keeps retrying those checks, so the test does not need manual waits before clicking or typing.</p>'],
    ['What is the difference between fill() and pressSequentially()?', '<p><code>fill()</code> sets the whole value at once, which is fast and what most tests need. <code>pressSequentially()</code> types character by character, for fields that react to each key, such as a search box that suggests results as you type.</p>'],
    ['Why use check() instead of click() on a checkbox?', '<p><code>click()</code> toggles, so the result depends on the starting state. <code>check()</code> ensures the box ends up ticked: it does nothing if it already is, and fails if the box cannot be ticked. That makes the intent clear.</p>'],
  ],
})}
`,
};
