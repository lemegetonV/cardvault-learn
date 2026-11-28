import { code, interview, sequence, keyIdea, testerEye } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'So far each framework test checked one thing on one page. A customer does more than that: they open the wallet, read the terms, add a card, wait for it to be confirmed, and maybe remove it later. A journey test follows one of those paths from start to finish, the way a customer would. This lesson builds the wallet journey from the framework’s pieces, including a new one for the consent dialog.',
  youWill: 'You will be able to write a journey test from page objects and components, wait for a status that changes in the background, and say what a journey proves that smaller tests do not.',
  body: `
<h2>The journey</h2>
<p>Adding a card to the checkout wallet is CardVault’s main feature, described in <a href="/learn/flow-add-to-wallet/">adding a card to the wallet</a>. In the browser it looks like this:</p>
${sequence({
  id: 'wallet-journey',
  label: 'Add a card, then remove it',
  actors: [
    { id: 'c', label: 'Customer', kind: 'plain' },
    { id: 'w', label: 'Wallet page', kind: 'bank' },
    { id: 'f', label: 'Terms frame', kind: 'mock' },
  ],
  steps: [
    { from: 'c', to: 'w', label: 'Add to wallet', note: 'The card shows NOT ADDED. The customer presses Add to wallet, and a dialog opens.' },
    { from: 'c', to: 'f', label: 'agree, Continue', note: 'The wallet company’s terms sit in a frame inside the dialog. The customer ticks I agree and presses Continue.' },
    { from: 'c', to: 'w', label: 'Add card', note: 'The dialog’s Add card button is enabled now. A toast says the card is being added.' },
    { from: 'w', to: 'w', label: 'PENDING → ENROLLED', note: 'The card waits for the wallet company to confirm it, then shows ENROLLED.' },
    { from: 'c', to: 'w', label: 'Remove from wallet', note: 'Removing it shows REMOVED. A removed card cannot simply be added again.' },
  ],
  caption: 'One customer path through three parts of the screen: the wallet list, the dialog and the frame inside it.',
})}

<h2>A component for the dialog</h2>
<p>The consent dialog is not a page. It opens on top of the wallet, and holds a frame from another company. The framework gives it a class of its own in <code>components/</code>, the folder for parts of the screen that are not whole pages:</p>
${code({ lang: 'typescript', title: 'tests/ui/components/ConsentDialog.ts', src: `
  constructor(page: Page) {
    this.page = page;
    this.terms = page.getByTestId('terms-iframe').contentFrame();
    this.agreeBox = this.terms.getByLabel('I agree');
    this.continueButton = this.terms.getByRole('button', { name: 'Continue' });
    this.thankYou = this.terms.getByText('Thank you.');
    this.addCardButton = page.getByRole('button', { name: 'Add card' });
  }

  // Accept the terms inside the frame. waitFor() waits until the frame says
  // "Thank you.", so the next step starts once the bank has heard about it.
  async acceptTerms() {
    await this.agreeBox.check();
    await this.continueButton.click();
    await this.thankYou.waitFor();
  }
` })}
<ul>
<li><code>contentFrame()</code> from <a href="/learn/pw-frames/">frames</a> returns a <code>FrameLocator</code>: locators built from it look inside the frame. The page object hides that detail, so tests never need to know there is a frame.</li>
<li><code>waitFor()</code> waits until a locator’s element is on screen, then returns. It is not an assertion and compares nothing, but if the element never appears it times out and the test fails. It makes <code>acceptTerms()</code> finish only when the terms are really accepted, so the next step does not race ahead.</li>
</ul>

<h2>The wallet page grows</h2>
${code({ lang: 'typescript', title: 'tests/ui/pages/WalletPage.ts', src: `
  // The card's wallet status label: NOT ADDED, PENDING, ENROLLED and so on.
  status(last4: string): Locator {
    return this.card(last4).getByTestId(/^enrollment-status-/);
  }
` })}
<p><code>getByTestId</code> also takes a pattern. <code>/^enrollment-status-/</code> means “a test id that starts with enrollment-status-”; the rest of the id is the card’s internal number, which the test does not know and does not need.</p>

<h2>The test</h2>
${code({ lang: 'typescript', title: 'tests/ui/tests/wallet-journey.spec.ts', src: `
test('add a card to the wallet, then remove it', { tag: '@phone' }, async ({ customerWithCard, walletPage, consentDialog, toast }) => {
  const last4 = customerWithCard.last4;
  await expect(walletPage.status(last4)).toHaveText('NOT ADDED');

  await test.step('accept the terms and add the card', async () => {
    await walletPage.startAddingCard(last4);
    await consentDialog.acceptTerms();
    await consentDialog.addCardButton.click();
    await expect(toast.message(\`Adding the card ending \${last4}\`)).toBeVisible();
  });

  await test.step('the wallet company confirms the card', async () => {
    // The card is PENDING until the wallet company answers, usually within a few seconds.
    await expect(walletPage.status(last4)).toHaveText('ENROLLED', { timeout: 10_000 });
  });

  await test.step('remove the card again', async () => {
    await walletPage.removeCard(last4);
    await expect(toast.message(\`Card ending \${last4} removed from the wallet\`)).toBeVisible();
    await expect(walletPage.status(last4)).toHaveText('REMOVED');
    // A card the customer removed cannot simply be added back.
    await expect(walletPage.card(last4)).toContainText('Not eligible: Card removed by customer');
  });
});
` })}
<ul>
<li><code>customerWithCard</code> is a fixture from <a href="/learn/pw-custom-fixtures/">custom fixtures</a>: a new customer, signed in, whose one card is not in the wallet yet. The test starts by checking that starting point, <code>NOT ADDED</code>, so a wrong set-up fails at once with a clear message.</li>
<li><code>test.step</code> from <a href="/learn/pw-debugging/">debugging</a> names the stages, so the report says which part of the journey broke.</li>
<li><code>toast</code> is another small component: <code>toast.message(text)</code> finds the pop-up message with that text.</li>
<li>Confirmation comes from the wallet company in the background, so the status changes on its own a few seconds later. A web-first assertion waits for it; <code>{ timeout: 10_000 }</code> gives this one check ten seconds instead of five, because the wait is part of the product, not a slow test.</li>
<li>The tag <code>@phone</code> also runs this journey on a phone, which <a href="/learn/pw-phones-browsers/">phones and other browsers</a> explains.</li>
</ul>

${keyIdea('<p>A journey test follows one customer path from start to finish, built from page objects and components. Check the starting state first, name the stages with <code>test.step</code>, and wait for background changes with a web-first assertion and a deliberate timeout.</p>')}

<h2>What a journey adds</h2>
<p>The small frame tests in Part 1 proved that the frame works. This journey proves that the pieces work <em>together</em>: the frame’s answer enables the dialog’s button, the button starts the enrolment, the confirmation arrives and updates the list, and removal is final. Journeys are slower and cover more at once, so a suite keeps a few for the main paths and many small tests for the details. The file’s second test is one of those: Add card stays disabled until the terms are accepted.</p>

${testerEye('<p>Write down the business result a journey must prove before writing the steps. Here it is “the card ends up in the wallet, and once removed it stays out”. Every assertion should serve that sentence; anything else belongs in a smaller test.</p>')}

${interview({
  say: `<p>“For the wallet I have a journey test: a fresh customer from a fixture, add the card through the consent dialog, whose terms are in an iframe, wait for the status to go from pending to enrolled, then remove it and check it is not eligible again. The dialog has its own component class, the stages are test.steps, and the background confirmation is a web-first assertion with a longer timeout. Smaller tests cover details like the disabled Add card button.”</p>`,
  qa: [
    ['What is the difference between a journey test and a regular UI test?', '<p>A journey follows a whole user path across several screens and checks the business outcome; a regular test checks one behaviour. Journeys catch integration problems but are slower, so you keep a few for critical paths.</p>'],
    ['How do you handle a status that changes asynchronously?', '<p>With a web-first assertion that retries, such as <code>toHaveText(\'ENROLLED\')</code>, and a timeout that matches the product’s expected delay. Never a fixed sleep.</p>'],
    ['Where do you put a dialog or a widget that appears on many pages?', '<p>In a component class, separate from page objects. Page objects or tests use it; it keeps its own locators and actions, such as accepting terms inside an iframe.</p>'],
  ],
})}
`,
};
