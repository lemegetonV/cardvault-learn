import { code, terminal, interview, table, keyIdea, shot, testerEye } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'Real pages repeat themselves. alice’s Cards page has four cards, and every card has the same three buttons. A locator like “the Reissue button” matches four elements, and Playwright will not guess which one you mean. This lesson shows how to point at exactly one.',
  youWill: 'You will be able to explain strict mode and narrow a locator with filter, chaining and position.',
  body: `
<h2>One name, four buttons</h2>
${shot({ src: 'cards.png', alt: 'alice’s Cards page with four cards, each with Report lost, Reissue and Close card buttons.', caption: 'Four cards, and a Reissue button on every one.' })}
<p>Ask Playwright to click “the button called Reissue” on this page, and it stops. This is the real error:</p>
${code({ lang: 'typescript', title: 'Example · a click that is too vague', src: `
await page.getByRole('button', { name: 'Reissue' }).click();
` })}
${terminal([['npx playwright test', `    Error: locator.click: Error: strict mode violation: getByRole('button', { name: 'Reissue' }) resolved to 4 elements:
        1) <button class="btn" type="button" data-testid="reissue-ca4d0000-a11c-4000-8000-000000000004">Reissue</button> aka getByTestId('reissue-ca4d0000-a11c-4000-8000-000000000004')
        2) <button class="btn" type="button" data-testid="reissue-ca4d0000-a11c-4000-8000-000000000003">Reissue</button> aka getByTestId('reissue-ca4d0000-a11c-4000-8000-000000000003')
        3) <button class="btn" type="button" data-testid="reissue-ca4d0000-a11c-4000-8000-000000000002">Reissue</button> aka getByTestId('reissue-ca4d0000-a11c-4000-8000-000000000002')
        4) <button class="btn" type="button" data-testid="reissue-ca4d0000-a11c-4000-8000-000000000001">Reissue</button> aka getByTestId('reissue-ca4d0000-a11c-4000-8000-000000000001')`]], 'Real output')}
<p>This is <strong>strict mode</strong>: an action such as <code>click()</code> or <code>fill()</code> must match exactly one element. Older tools quietly clicked the first match, which made tests click the wrong thing without anyone noticing. Playwright fails instead, lists every match, and even suggests a locator for each.</p>
<p>Strict mode applies to actions and to checks about one element, such as <code>toBeVisible()</code>. Checks about a group, such as <code>toHaveCount()</code>, are happy with many matches:</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/narrowing.spec.ts', src: `
test('one locator can match many elements', async ({ page }) => {
  // Every card has a Reissue button, so this locator matches four buttons.
  // Clicking it would fail: Playwright refuses to guess which one you meant.
  const reissueButtons = page.getByRole('button', { name: 'Reissue' });

  await expect(reissueButtons).toHaveCount(4);
});
` })}

<h2>Filter by text: the card ending 4417</h2>
<p>The fix is to first find the right card, then look for the button inside it.</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/narrowing.spec.ts', src: `
test('filter by text: the card ending 4417', async ({ page }) => {
  const cards = page.getByTestId('card-list').getByRole('listitem');
  const creditCard = cards.filter({ hasText: '4417' });

  await expect(creditCard).toHaveCount(1);
  await expect(creditCard.getByRole('button', { name: 'Reissue' })).toBeVisible();
});
` })}
<ol>
<li><code>page.getByTestId('card-list').getByRole('listitem')</code> finds every item in the card list: four cards. This is <strong>chaining</strong>, which you met in <a href="/learn/pw-locators/">locators</a>: search inside the result of another locator.</li>
<li><code>.filter({ hasText: '4417' })</code> keeps only the items whose text contains “4417”. Now one card is left. Like other locators, a filter is lazy: nothing is searched until the next check.</li>
<li><code>creditCard.getByRole('button', { name: 'Reissue' })</code> looks for the button only inside that card, so it matches exactly one.</li>
</ol>
<p>The <code>toHaveCount(1)</code> line is worth copying: it proves the filter really narrowed to one card before the test relies on it.</p>

<h2>Filter by what is inside</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/narrowing.spec.ts', src: `
test('filter by what is inside: the prepaid card', async ({ page }) => {
  const cards = page.getByTestId('card-list').getByRole('listitem');
  const prepaidCard = cards.filter({ has: page.getByText('PREPAID') });

  await expect(prepaidCard).toContainText('5521');
});
` })}
<p><code>has</code> takes another locator instead of text: keep the cards that contain an element matching it. It is useful when the thing that tells items apart is a badge, a button or a label rather than plain text. Its opposites are <code>hasNotText</code> and <code>hasNot</code>.</p>

<h2>By position, as a last resort</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/narrowing.spec.ts', src: `
test('first, last and nth: by position', async ({ page }) => {
  const cards = page.getByTestId('card-list').getByRole('listitem');

  // Positions are counted from 0, so nth(1) is the second card.
  await expect(cards.first()).toBeVisible();
  await expect(cards.nth(1)).toBeVisible();
  await expect(cards.last()).toBeVisible();
});
` })}
<p><code>first()</code>, <code>last()</code> and <code>nth()</code> pick by position. They always work, which is exactly the danger: if the order of the cards changes, the test silently picks another card. Use them only when the position itself is what you are testing, such as “the newest transaction is at the top”.</p>

${keyIdea('<p>Actions need a locator that matches exactly one element. Narrow by meaning first: find the right container with <code>filter</code>, then the element inside it. Pick by position only when the position is the point of the test.</p>')}

<h2>The narrowing tools</h2>
${table(['Tool', 'Keeps', 'Example'], [
  ['`.filter({ hasText })`', 'Items whose text contains this', '`cards.filter({ hasText: \'4417\' })`'],
  ['`.filter({ has })`', 'Items that contain an element matching another locator', '`cards.filter({ has: page.getByText(\'PREPAID\') })`'],
  ['chaining', 'Matches inside an earlier match', '`creditCard.getByRole(\'button\', ...)`'],
  ['`{ exact: true }`', 'Only a whole, case-sensitive match of the name or text', '`page.getByText(\'Cards\', { exact: true })`'],
  ['`.first()`, `.last()`, `.nth(i)`', 'One item by position', '`cards.nth(1)`'],
])}

${testerEye('<p>A strict mode error is often good news. It means the page has more matches than you thought: a second Transactions link, a hidden copy of a button for phones, a dialog behind the page. Narrow the locator to the one a user would really use, rather than reaching for <code>first()</code> to make the error go away.</p>')}

${interview({
  say: `<p>“Playwright locators are strict: an action fails if the locator matches more than one element, instead of silently clicking the first. When a page repeats elements, like a list of cards each with the same buttons, I find the right container with filter, by text or by a child locator, and then chain to the element inside it. I avoid nth and first unless the order is what I am testing.”</p>`,
  qa: [
    ['What is strict mode in Playwright?', '<p>Actions and single-element checks require the locator to resolve to exactly one element. If it matches several, Playwright throws a strict mode violation that lists the matches. It prevents tests from acting on the wrong element by accident.</p>'],
    ['How do you click a button in one row of a list?', '<p>Locate the rows, filter to the right row by its text or by an element it contains, then chain to the button inside it, for example <code>rows.filter({ hasText: \'4417\' }).getByRole(\'button\', { name: \'Reissue\' })</code>.</p>'],
    ['Why is nth() risky?', '<p>It depends on the order of elements. If the order changes, for a new item, a different sort or a hidden element, the test acts on a different element and may still pass. Filtering by content keeps the test tied to meaning.</p>'],
  ],
})}
`,
};
