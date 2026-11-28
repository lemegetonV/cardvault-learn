import { code, interview, table, keyIdea, testerEye } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'The second journey starts where a worried customer starts: on the wallet page, with a purchase they do not recognise. They find it in the transaction list, open it, dispute it, and expect the list to show the dispute from then on. This lesson builds that journey, adds the menu as a component, and looks at a business rule that deserves its own small test.',
  youWill: 'You will be able to write a journey that moves between pages through the navigation, and check a consequence on a different page from the action.',
  body: `
<h2>Moving through the app like a customer</h2>
<p>A customer reaches the transactions through the main menu, not by typing an address. The journey does the same, which also tests the navigation. On a wide screen the menu’s links are always visible; on a phone they hide behind a Menu button. One component handles both:</p>
${code({ lang: 'typescript', title: 'tests/ui/components/Menu.ts', src: `
  // Open one of the main pages by its link, for example 'Transactions'.
  // Call it once the page has shown its data: until then, the Menu button
  // may not respond to a click.
  async goTo(linkName: string) {
    // isVisible() answers straight away, without waiting: is the button on screen?
    if (await this.menuButton.isVisible()) {
      await this.menuButton.click();
    }
    await this.nav.getByRole('link', { name: linkName }).click();
  }
` })}
<p><code>isVisible()</code> is one of the few Playwright calls that does not wait: it looks once and answers <code>true</code> or <code>false</code>. That suits a question about the layout, which is already settled once the page has loaded. The comment’s warning comes from <a href="/learn/pw-flaky-tests/">flaky tests</a>.</p>

<h2>The journey</h2>
${code({ lang: 'typescript', title: 'tests/ui/tests/dispute-journey.spec.ts', src: `
test('dispute a purchase and see it marked in the list', { tag: '@phone' }, async ({ customer, walletPage, menu, transactionsPage, transactionPage, toast }) => {
  await test.step('go to the transactions from the menu', async () => {
    // Wait for the wallet's card first: the menu only responds once the page has loaded.
    await expect(walletPage.card(customer.last4)).toBeVisible();
    await menu.goTo('Transactions');
    await expect(transactionsPage.rows).toHaveCount(1);
  });

  await test.step('open the purchase and dispute it', async () => {
    await transactionsPage.openTransaction(PURCHASE.merchant);
    await expect(transactionPage.amount).toHaveText(PURCHASE.shownAs);
    await transactionPage.openDispute('Unrecognised');
    await expect(toast.message('Dispute opened')).toBeVisible();
    await expect(transactionPage.disputeOpenBadge).toHaveText('DISPUTE OPEN');
  });

  await test.step('the list shows the open dispute', async () => {
    await transactionsPage.open();
    await expect(transactionsPage.rows.first().getByTestId('txn-dispute-badge')).toHaveText('DISPUTE OPEN');
  });
});
` })}
<ul>
<li><code>customer</code> is the fixture from <a href="/learn/pw-api-setup/">API set-up</a>: a new customer with one $30.00 purchase at Northwind Books, signed in and on the wallet page.</li>
<li>Six fixtures in one test is normal for a journey: it is the list of everything the customer touches.</li>
<li>Before disputing, the test checks the amount on the details page. It confirms the test is on the right purchase, and the expected <code>$30.00</code> comes from the data the set-up chose.</li>
<li><code>openDispute('Unrecognised')</code> leaves out the note and the receipt: their defaults from <a href="/learn/pw-page-objects/">page objects</a> skip them.</li>
<li>The last step goes back to the list. The dispute was opened on one page; the customer must see its effect on another. Checks like this catch the bugs that single-page tests miss, such as a list that is not refreshed.</li>
</ul>

<h2>A rule, in its own test</h2>
${code({ lang: 'typescript', title: 'tests/ui/tests/dispute-journey.spec.ts', src: `
test('a purchase can only be disputed once', async ({ customer, transactionsPage, transactionPage, toast }) => {
  await transactionsPage.open();
  await transactionsPage.openTransaction(PURCHASE.merchant);
  await transactionPage.openDispute('Wrong amount');
  await expect(toast.message('Dispute opened')).toBeVisible();

  await expect(transactionPage.disputeButton).toBeHidden();
});
` })}
<p>“One open dispute per purchase” is a business rule, and a rule gets a test whose name states it. If it breaks, the failing test’s name says which rule, without reading the journey. This test skips the menu and goes straight to the list, because the route there is not what it checks. It proves the customer is no longer offered a second dispute; that the services refuse one is checked by an API test.</p>

${keyIdea('<p>Journeys move the way a customer does, through the menu, and check the outcome where the customer would look for it, often on another page. Business rules get small tests of their own, named after the rule.</p>')}

<h2>How many journeys?</h2>
${table(['Kind of test', 'How many', 'Example'], [
  ['Journey', 'A few, for the paths that matter most', 'Add a card to the wallet; dispute a purchase'],
  ['Feature test', 'One or more per behaviour', 'The Add card button waits for the terms'],
  ['Rule test', 'One per business rule', 'One open dispute at a time'],
  ['API test', 'Most of the rules and errors', 'The pytest suite'],
])}
<p>Rules that need no browser are cheaper to check through the API, as the pytest track does. The UI suite keeps what only a browser can show: what the customer sees and can do.</p>

${testerEye('<p>When a journey fails, its steps tell you where. A failure in “the list shows the open dispute” after a toast that said “Dispute opened” is a different bug from a failure in the form itself, and the report shows which before you open any code.</p>')}

${interview({
  say: `<p>“The dispute journey starts as a fresh customer with a purchase, made through the API. It goes to Transactions through the menu component, which works on desktop and phone, opens the purchase, checks the amount, disputes it, checks the toast and badge, and then checks the list shows the dispute, because the effect must be visible where the customer looks. Rules like one dispute per purchase get their own short tests.”</p>`,
  qa: [
    ['How many end-to-end journeys should a suite have?', '<p>Few: the critical paths. Most behaviour is covered by smaller UI tests and, below them, API and unit tests, which are faster and fail more precisely.</p>'],
    ['Why check the list after disputing on the details page?', '<p>Because the customer sees the result there, and bugs often live between pages: stale data, missing refresh, a badge not shown. An action is only proven by its visible effect.</p>'],
    ['When would you use isVisible() instead of expect(...).toBeVisible()?', '<p>When the test needs to choose what to do, such as clicking a Menu button only if it is shown. <code>isVisible()</code> answers once without waiting; for checking, use the waiting assertion.</p>'],
  ],
})}
`,
};
