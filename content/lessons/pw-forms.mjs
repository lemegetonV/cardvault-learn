import { code, interview, table, keyIdea, shot, testerEye } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'Forms are where customers give an app information, so they are where many bugs live. CardVault’s dispute form has a select box, a text area and a file upload, and it changes data when it is sent. This lesson tests it end to end, including uploading a receipt, and shows how a test that changes data gets its own customer.',
  youWill: 'You will be able to test a form with a file upload and explain why tests that change data need their own customer.',
  body: `
<h2>The dispute form</h2>
${shot({ src: 'dispute.png', alt: 'A transaction detail page with the dispute form: a Reason select box, a Note text area with a character count, a Receipt file field and an Open dispute button.', caption: 'A customer who does not recognise a purchase opens a dispute from the transaction’s page.' })}
<p>A customer opens a purchase, presses <strong>Dispute</strong>, chooses a reason, may add a note of up to 500 characters and a receipt (a PDF, PNG or JPEG up to 5 MB), and presses <strong>Open dispute</strong>. A short message confirms it, and the transaction is marked “Dispute open”. Only one dispute can be open per transaction.</p>

<h2>A test that changes data needs its own customer</h2>
<p>Every test so far only read alice’s data, so they could share her. Opening a dispute changes data, and CardVault refuses a second open dispute on the same purchase. If tests opened disputes on alice’s purchases, the second run would fail, and two tests running at once could trip over each other.</p>
<p>So each test in this file starts with a <strong>brand-new customer</strong> who has one purchase, made just for that test. Test environments like CardVault’s offer a way to create one; the suite wraps it in a small helper, <code>newCustomerWithPurchase</code>, which you will read in <a href="/learn/pw-api-setup/">API set-up for UI tests</a>. For now, what it returns is enough: a username and a password.</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/forms.spec.ts', src: `
test.beforeEach(async ({ page, request }) => {
  const customer = await newCustomerWithPurchase(request);

  await page.goto('/login');
  await page.getByLabel('Username').fill(customer.username);
  await page.getByLabel('Password').fill(customer.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/wallet');

  // Open the purchase, then the dispute form under it.
  await page.goto('/wallet/transactions');
  await page.getByRole('link', { name: /Northwind Books/ }).click();
  await page.getByRole('button', { name: 'Dispute' }).click();
});
` })}
<ul>
<li><code>{ page, request }</code> asks Playwright for two fixtures: the browser page, and <code>request</code>, which sends HTTP requests straight to services without a browser. The helper uses it to create the customer and the purchase. The lesson on <a href="/learn/pw-api-requests/">API requests</a> covers it.</li>
<li><code>customer.username</code> reads a value from the object the helper returned.</li>
<li>The purchase was made at “Northwind Books”, so the test finds its row by that name. <code>/Northwind Books/</code> is a pattern (a regular expression), which matches the name anywhere inside the link’s longer name with the date and the card. The plain string <code>'Northwind Books'</code> would also work, because names match part of the text by default; the pattern just makes “part of” visible to the reader.</li>
</ul>

<h2>Filling the form and uploading a file</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/forms.spec.ts', src: `
test('open a dispute with a reason, a note and a receipt', async ({ page }) => {
  await page.getByLabel('Reason').selectOption({ label: 'Wrong amount' });
  await page.getByLabel('Note (optional)').fill('I was charged twice');
  // setInputFiles puts a file in a file field, as if the customer had picked it.
  await page.getByLabel(/Receipt/).setInputFiles('learn/files/receipt.png');
  await page.getByRole('button', { name: 'Open dispute' }).click();

  // A short message confirms it, and the transaction is marked as disputed.
  await expect(page.getByRole('status').filter({ hasText: 'Dispute opened' })).toBeVisible();
  await expect(page.getByTestId('dispute-open-badge')).toHaveText('DISPUTE OPEN');
  await expect(page.getByRole('button', { name: 'Dispute' })).toBeHidden();
});
` })}
<ol>
<li><code>selectOption({ label: 'Wrong amount' })</code> chooses by the text the customer sees, which reads better here than the hidden value.</li>
<li><code>getByLabel(/Receipt/)</code> matches the start of the long label “Receipt (optional: PDF, PNG or JPEG, up to 5 MB)”. As with the link, <code>'Receipt'</code> would work too.</li>
<li><code>setInputFiles('learn/files/receipt.png')</code> puts a file into the file field without opening the computer’s file picker, which a test cannot click. The path is relative to the folder you run the tests from, <code>tests/ui</code>. The file is a small picture kept in the suite for this purpose.</li>
<li>Three checks prove the business result, not just that a button was pressed: the confirmation message (a <strong>toast</strong>: a short message with <code>role="status"</code> that disappears after 4 seconds), the “Dispute open” badge, and the Dispute button gone, because a second dispute is not allowed.</li>
</ol>
<p>The toast check comes straight after the click for a reason. It is visible for only 4 seconds, and the web-first assertion catches it while it is there.</p>

<h2>Smaller checks on the same form</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/forms.spec.ts', src: `
test('the note counts its characters', async ({ page }) => {
  const note = page.getByLabel('Note (optional)');

  await note.fill('Not my purchase');

  await expect(note).toHaveValue('Not my purchase');
  await expect(page.getByTestId('dispute-note-count')).toHaveText('15/500');
});

test('pick a receipt, then change your mind', async ({ page }) => {
  const receipt = page.getByLabel(/Receipt/);

  await receipt.setInputFiles('learn/files/receipt.png');
  await expect(receipt).toHaveValue(/receipt\\.png/);

  // An empty list takes the file out again.
  await receipt.setInputFiles([]);
  await expect(receipt).toHaveValue('');
});
` })}
<p>“Not my purchase” is 15 characters, so the counter must say <code>15/500</code>. For the file field, <code>toHaveValue</code> checks the name of the chosen file, and <code>setInputFiles([])</code>, with an empty list, clears it. In the pattern <code>/receipt\\.png/</code>, the backslash makes the dot mean a real dot.</p>

${keyIdea('<p>Fill a form the way a customer would, upload files with <code>setInputFiles</code>, and check the business result: the confirmation, the new status, and what the customer can no longer do. A test that changes data gets its own fresh customer.</p>')}

<h2>Form actions at a glance</h2>
${table(['To', 'Use'], [
  ['Type into a text field or text area', '`fill(text)`'],
  ['Choose from a select box', '`selectOption(value)` or `selectOption({ label })`'],
  ['Tick a checkbox or radio button', '`check()`'],
  ['Attach a file', '`setInputFiles(path)`, or a list of paths for several files'],
  ['Remove the chosen file', '`setInputFiles([])`'],
  ['Check what a field holds', '`expect(field).toHaveValue(value)`'],
])}

${testerEye('<p>A form has many more cases than the happy one: a missing reason, a note at exactly 500 characters, a file that is too big or the wrong type, a double click on the submit button. Many of those rules are faster and steadier to check through the API, as the <a href="/learn/py-negative-tests/">API track</a> does. Keep the UI tests for what only the screen can show: the fields, the messages and the result the customer sees.</p>')}

${interview({
  say: `<p>“For forms I use fill, selectOption and check, and setInputFiles for uploads, since a test can’t drive the operating system’s file picker. I assert the business outcome, such as the confirmation toast, the new status badge and the action that is no longer offered, not just that the submit was clicked. Tests that change data create their own customer through the API first, so they are independent and repeatable.”</p>`,
  qa: [
    ['How do you upload a file in Playwright?', '<p>Call <code>setInputFiles(path)</code> on the file input, or on its locator found by label. It sets the file directly without opening the system dialog. A list of paths uploads several files, and an empty list clears the field.</p>'],
    ['Why not use a shared demo user for every test?', '<p>Tests that change data would affect each other: a second run or a parallel test could find a dispute already open. A fresh customer per test gives a known starting state, so the test is repeatable and can run in parallel.</p>'],
    ['How do you test a message that disappears after a few seconds?', '<p>Assert it straight after the action with a web-first assertion, which catches it while it is visible. Do not add a pause first, and do not assert it after slower steps.</p>'],
  ],
})}
`,
};
