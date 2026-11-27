import { code, terminal, figure, interview, keyIdea, table, shot, testerEye } from '../../src/components.mjs';
import { locatorLadder } from '../diagrams/playwright.mjs';

export default {
  minutes: 12,
  lede: 'Before a test can click a button or check a heading, it has to find it on the page. A locator is how you tell Playwright what to find. This lesson shows the five main ways, all on CardVault’s Cards page, and which one to reach for first.',
  youWill: 'You will be able to choose a locator for any element on a page and explain why role-based locators come first.',
  body: `
<h2>What a locator is</h2>
<p>A <strong>locator</strong> is a description of how to find an element on the page, for example “the button called Sign in”. You saw two in <a href="/learn/pw-first-test/">your first test</a>: <code>page.getByLabel('Username')</code> and <code>page.getByRole('button', { name: 'Sign in' })</code>.</p>
<p>Two things about locators matter from the start:</p>
<ul>
<li>A locator is <strong>lazy</strong>. Creating one does not search the page. Playwright looks for the element only when you act on it or check it, and it looks again each time. So a locator never goes stale when the page changes; it simply finds the element as it is now.</li>
<li>A locator should match <strong>exactly one</strong> element when you act on it. If it matches several, Playwright refuses to guess. The next lesson, on <a href="/learn/pw-narrowing/">narrowing a match</a>, deals with that.</li>
</ul>

<h2>The page we will use</h2>
${shot({ src: 'cards.png', alt: 'The Cards screen listing alice’s four cards, each with its status, expiry, amounts and action buttons.', caption: 'alice’s Cards page: a heading, the navigation, four cards and their buttons.' })}
<p>Every test in this lesson’s file first signs in as alice and opens this page. That set-up lives in a <code>test.beforeEach</code> block, which runs before every test in the file; the lesson on <a href="/learn/pw-hooks-isolation/">hooks</a> explains it. The tests only read the page, so they can run in any order.</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/locators.spec.ts', src: `
test.beforeEach(async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Username').fill('alice');
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait until the sign-in has finished and the wallet page is open, then go to the cards.
  await expect(page).toHaveURL('/wallet');
  await page.goto('/cards');
});
` })}
<p><code>DEMO_PASSWORD</code> is a <strong>constant</strong> imported from the suite’s <code>config.ts</code>, so the password is written in one place only.</p>

<h2>By role: what the element is</h2>
<p>Every element on a web page has a <strong>role</strong> that says what kind of thing it is: a <code>button</code>, a <code>link</code>, a <code>heading</code>, a <code>textbox</code>, a <code>checkbox</code>, a <code>listitem</code>, a <code>navigation</code> area. Screen readers, the tools blind users rely on, read pages through these roles. Most elements also have an <strong>accessible name</strong>: the text on a button, the words of a link, the label of a field.</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/locators.spec.ts', src: `
test('by role: the heading and the navigation links', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Cards' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Transactions' })).toBeVisible();
});
` })}
<p><code>getByRole('heading', { name: 'Cards' })</code> means “the heading whose name is Cards”. Note that the navigation also has a <em>link</em> called Cards; asking for a heading keeps the two apart. This is the locator to try first, because it finds things the way a user does.</p>

<h2>By text: the words on the screen</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/locators.spec.ts', src: `
test('by text: a card by the last four digits of its number', async ({ page }) => {
  // Text matching ignores case and finds the text anywhere inside an element.
  await expect(page.getByText('•••• 4417')).toBeVisible();
});
` })}
<p><code>getByText</code> finds an element by the text it shows. By default the match ignores upper and lower case and accepts part of the text, so <code>'•••• 4417'</code> finds “CREDIT •••• 4417”. Add <code>{ exact: true }</code> when you need the whole text to match. Use it for things that are not buttons, links or fields, such as a message or a line of details.</p>

<h2>By label: form fields</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/locators.spec.ts', src: `
test('by label: the sign-in form fields', async ({ page }) => {
  // Sign out first, so the sign-in form is on the screen again.
  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page.getByLabel('Username')).toBeEmpty();
  await expect(page.getByLabel('Password')).toBeEmpty();
});
` })}
<p><code>getByLabel</code> finds a form field by the label text shown next to it, which is how a person finds a field. Its relative <code>getByPlaceholder</code> uses the grey hint text inside an empty field, for forms that have no label. <code>toBeEmpty()</code> checks that the field holds no text.</p>

<h2>By test id: an attribute for tests</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/locators.spec.ts', src: `
test('by test id: the list of cards', async ({ page }) => {
  // data-testid is an attribute the developers added for tests: <ul data-testid="card-list">.
  await expect(page.getByTestId('card-list')).toBeVisible();
});
` })}
<p>A <strong>test id</strong> is an attribute that developers add to an element only so that tests can find it. It is stable: it does not change when the text or the design changes. CardVault puts one on every element a test might use. The cost is that a test id says nothing about what the user sees, so a test that uses only test ids can pass even when a button has lost its label.</p>

<h2>Looking inside part of the page</h2>
<p>You can start from one locator and search inside it. That is called <strong>chaining</strong>.</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/locators.spec.ts', src: `
test('by role inside a part of the page: the main navigation', async ({ page }) => {
  // Find the navigation first, then look for links only inside it.
  const nav = page.getByRole('navigation', { name: 'Main' });

  await expect(nav.getByRole('link')).toHaveCount(4);
});
` })}
<p><code>const nav = ...</code> stores the locator under a name so the next line can use it. <code>nav.getByRole('link')</code> finds links only inside the navigation, and <code>toHaveCount(4)</code> checks there are four: Wallet, Transactions, Cards and Profile.</p>

<h2>Which locator first?</h2>
${figure({ svg: locatorLadder(), caption: 'Work down from the top and stop at the first locator that finds the element clearly.' })}
${table(['Locator', 'Finds', 'In CardVault'], [
  ['`getByRole(role, { name })`', 'Buttons, links, headings, fields, by what they are and their name', '`getByRole(\'button\', { name: \'Sign in\' })`'],
  ['`getByLabel(text)`', 'A form field by its label', '`getByLabel(\'Username\')`'],
  ['`getByText(text)`', 'Any element by the words it shows', '`getByText(\'•••• 4417\')`'],
  ['`getByPlaceholder(text)`', 'A field by its hint text', 'Not used: every CardVault field has a label'],
  ['`getByTestId(id)`', 'An element by its `data-testid`', '`getByTestId(\'card-list\')`'],
  ['`page.locator(css)`', 'By CSS or XPath, the page’s inner structure', 'Avoided in this suite'],
])}

${keyIdea('<p>Prefer locators that find elements the way a user does: by role and name, by label, by text. Use a test id when those cannot single the element out. Leave CSS and XPath as a last resort, because they break when the page’s structure changes.</p>')}

<h2>Let Playwright suggest one</h2>
<p>Playwright can write locators for you. Run the code generator against the app, point at any element, and it shows the locator it would use, picked by the same order as above:</p>
${terminal([['npx playwright codegen localhost:3000/login', '']], 'In tests/ui')}
<p>A browser window opens next to a panel that records what you do as test code. The same “pick locator” tool is in UI mode. Treat its suggestion as a starting point and check that it describes the element the way you would.</p>

${testerEye('<p>Role-based locators test two things at once. If a developer turns a real button into a clickable <code>&lt;div&gt;</code>, a mouse user notices nothing, but a screen reader no longer announces a button, and <code>getByRole(\'button\')</code> fails. That failure is a real accessibility bug, found for free.</p>')}

${interview({
  say: `<p>“A locator describes how to find an element, and it is lazy: Playwright resolves it at the moment of the action or check, so it never goes stale. I prefer user-facing locators: getByRole with the accessible name first, then getByLabel and getByText, and getByTestId when those can’t single the element out. I avoid CSS and XPath because they tie the test to the page structure.”</p>`,
  qa: [
    ['Why prefer getByRole over a CSS selector?', '<p>getByRole finds elements the way users and screen readers do, by what they are and their name, so it survives changes to classes and layout. It also fails when an element loses its proper role, which catches accessibility bugs. A CSS selector depends on the page’s inner structure and breaks when a developer restyles or reorganises it.</p>'],
    ['When would you use getByTestId?', '<p>When there is no clear user-facing way to single an element out, for example a container with no name, or text that changes all the time. Test ids are stable because they exist only for tests. The trade-off is that they do not check what the user sees.</p>'],
    ['What does it mean that locators are lazy?', '<p>Creating a locator does not search the page. Playwright finds the element each time you act on it or check it. So the same locator keeps working after the page re-renders, and you can define locators before the elements even exist.</p>'],
  ],
})}
`,
};
