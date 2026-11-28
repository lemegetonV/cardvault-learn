import { code, interview, table, keyIdea, testerEye } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'Some things a page does happen outside the page itself: a link opens a new tab, the browser asks “Are you sure?”, a button saves a file. Playwright reports each of these as an event, and the trick is the same every time: get ready for the event before the click that causes it. This lesson covers all three on CardVault.',
  youWill: 'You will be able to handle new tabs, browser dialogs and downloads, and explain why you wait for them before the click.',
  body: `
<h2>One pattern for all three</h2>
<p>An <strong>event</strong> is something Playwright tells you has happened: a new tab opened, a dialog appeared, a download started. You met the pattern in <a href="/learn/pw-waiting/">waiting the right way</a> with <code>waitForResponse</code>: start waiting first, store the promise without <code>await</code>, do the click, then <code>await</code> the promise. If you clicked first, the event could happen before anyone was listening.</p>
<p>Every test here signs in with a small <code>signIn</code> function at the top of the file, like the one in <a href="/learn/pw-builtin-fixtures/">built-in fixtures</a>, but taking the password too, because one test uses a new customer.</p>

<h2>A link that opens a new tab</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/tabs-dialogs-downloads.spec.ts', src: `
test('Wallet help opens in a new tab', async ({ page }) => {
  await signIn(page, 'alice', DEMO_PASSWORD);

  // Start waiting for the new tab before the click that opens it.
  const newTab = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Wallet help' }).click();
  const help = await newTab;

  await expect(help.getByRole('heading', { name: 'Checkout wallet help' })).toBeVisible();
  // The first tab is still there, on the wallet page.
  await expect(page).toHaveURL('/wallet');
});
` })}
<p>The Wallet help link has <code>target="_blank"</code>, which tells the browser to open it in a new tab. <code>page.waitForEvent('popup')</code> waits for a tab opened by this page, and gives you that tab as a new <code>Page</code>. From then on, <code>help</code> is used exactly like <code>page</code>. The last line checks that the original tab did not move.</p>

<h2>The browser’s own confirm box</h2>
<p>Closing a card asks “Close the credit card ending 4417? This cannot be undone.” in the browser’s built-in confirm box, with OK and Cancel. That box is not part of the page, so no locator can find it. Instead you tell Playwright what to do when it appears:</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/tabs-dialogs-downloads.spec.ts', src: `
test('cancel the browser’s own confirm box: nothing changes', async ({ page }) => {
  await signIn(page, 'alice', DEMO_PASSWORD);
  await page.goto('/cards');
  const card = page.getByRole('listitem').filter({ hasText: '4417' });

  // Say what to do with the next dialog before the click that opens it.
  // The handler only notes the question and presses Cancel; the check comes after.
  let question = '';
  page.once('dialog', async (dialog) => {
    question = dialog.message();
    await dialog.dismiss(); // the Cancel button
  });
  await card.getByRole('button', { name: 'Close' }).click();

  expect(question).toBe('Close the credit card ending 4417? This cannot be undone.');

  await expect(card.getByRole('button', { name: 'Close' })).toBeVisible();
  await expect(card).toContainText('ACTIVE');
});
` })}
<ol>
<li><code>page.once('dialog', handler)</code> registers a <strong>handler</strong>: a function Playwright calls the next time a dialog appears, once only. (<code>page.on</code> would call it for every dialog.)</li>
<li>The handler receives the dialog. <code>dialog.message()</code> is its text; the handler keeps it in <code>question</code>, and the test checks it after the click, so the test proves the right question was asked. <code>dialog.dismiss()</code> presses Cancel; <code>dialog.accept()</code> presses OK.</li>
<li>Why not check inside the handler? A failed check there would stop the handler before it presses Cancel, and the click would hang until the test timed out, with a confusing error. Keep handlers small and check afterwards.</li>
<li>This test uses alice because cancelling must change nothing, and the last two lines check exactly that. Only <code>accept()</code> closes a card, and this test never calls it. (When no handler is registered at all, Playwright dismisses dialogs by itself.)</li>
</ol>
${code({ lang: 'typescript', title: 'tests/ui/learn/tabs-dialogs-downloads.spec.ts', src: `
test('accept the confirm box: the card is closed', async ({ page, request }) => {
  // Closing a card cannot be undone, so this test uses its own new customer.
  const customer = await newCustomerWithCard(request);
  await signIn(page, customer.username, customer.password);
  await page.goto('/cards');

  page.once('dialog', (dialog) => dialog.accept()); // the OK button
  await page.getByRole('button', { name: 'Close' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Card closed' })).toBeVisible();
  await expect(page.getByTestId('card-list')).toContainText('CLOSED');
});
` })}
<p>Accepting really closes the card, so this test gets a brand-new customer with one card. The confirmation toast and the CLOSED status show the business result.</p>

<p>Not every “dialog” is the browser’s. CardVault’s “Opt out of the wallet?” question is drawn by the page itself, so a test finds it with <code>getByRole('dialog')</code> and clicks its buttons like any element; the suite file has a test for it. Tell the two apart by looking: the browser’s box has the browser’s style and cannot be inspected in the developer tools.</p>

<h2>A download</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/tabs-dialogs-downloads.spec.ts', src: `
test('Export CSV downloads a file with every transaction', async ({ page }) => {
  await signIn(page, 'alice', DEMO_PASSWORD);
  await page.goto('/wallet/transactions');

  // Start waiting for the download before the click that starts it.
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloading;

  expect(download.suggestedFilename()).toBe('wallet-transactions-all-all.csv');

  // Read the downloaded file and split it into lines.
  const text = readFileSync(await download.path(), 'utf-8');
  const lines = text.trim().split('\\n');
  expect(lines[0]).toContain('merchant_name');
  expect(lines.length).toBe(1 + 55); // a header line, then alice's 55 transactions
});
` })}
<ul>
<li><code>download.suggestedFilename()</code> is the name the server gave the file. “all-all” means no date filter at either end.</li>
<li><code>await download.path()</code> waits until the file is saved to a temporary folder and gives its path.</li>
<li><code>readFileSync</code> comes from Node.js’s own <code>node:fs</code> module (file system). It reads the whole file as text. <code>trim()</code> removes the final line break, and <code>split('\\n')</code> cuts the text into lines.</li>
<li>The checks prove the file is the right export, not just that a file arrived: it has the expected header, and one line per transaction. The 55 comes from alice’s known data, the same number <a href="/learn/pw-waiting/">Load more</a> reached on screen.</li>
</ul>

${keyIdea('<p>For a new tab, a browser dialog or a download, prepare before the click: <code>waitForEvent(\'popup\')</code>, <code>page.once(\'dialog\', ...)</code> or <code>waitForEvent(\'download\')</code>. Then check the result: the new page, what the dialog asked and what changed, or what the file contains.</p>')}

${table(['Event', 'Get ready with', 'Then'], [
  ['A new tab', '`page.waitForEvent(\'popup\')`', 'Use the returned page like any page'],
  ['alert, confirm or prompt', '`page.once(\'dialog\', handler)`', '`dialog.accept()` or `dialog.dismiss()`'],
  ['A download', '`page.waitForEvent(\'download\')`', '`suggestedFilename()`, `path()`, read the file'],
])}

${testerEye('<p>A download test that stops at “a file arrived” proves very little. Open the file and check what matters to the customer: the right rows for the filters chosen, the header, the amounts. A filtered export is a good next test: apply a filter on the page, export, and check that every line matches it.</p>')}

${interview({
  say: `<p>“New tabs, dialogs and downloads are events, so I set up the wait before the click: waitForEvent popup for a new tab, page.once dialog with accept or dismiss for a native confirm, and waitForEvent download for files. For a download I read the file and assert on its content, not just its name. Custom modal dialogs are part of the DOM, so I test them with getByRole('dialog') like any element.”</p>`,
  qa: [
    ['How do you handle a JavaScript confirm dialog?', '<p>Register a handler before the action: <code>page.once(\'dialog\', d =&gt; d.accept())</code> or <code>d.dismiss()</code>. Check <code>d.message()</code> if the wording matters. Without a handler, Playwright dismisses dialogs automatically.</p>'],
    ['How do you test a link that opens a new tab?', '<p>Start <code>page.waitForEvent(\'popup\')</code>, click the link, then await the promise to get the new page. Assert on that page, and on the original page if it should stay where it was.</p>'],
    ['How do you verify a downloaded file?', '<p>Wait for the download event around the click, check <code>suggestedFilename()</code>, then read the file from <code>download.path()</code> and assert on its contents, such as the header and the number of rows for the known data.</p>'],
  ],
})}
`,
};
