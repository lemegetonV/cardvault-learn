import { code, interview, keyIdea, sequence, shot, testerEye } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'Some parts of a page are really another web page, shown in a window called an iframe: a payment form, a map, a video, a set of terms from a partner. Locators on the main page cannot see inside one. This lesson shows how Playwright reaches into a frame, using the wallet terms a customer must accept before adding a card.',
  youWill: 'You will be able to find and use elements inside an iframe and check how the frame and the page work together.',
  body: `
<h2>The page: wallet terms from the wallet operator</h2>
${shot({ src: 'pw-consent-frame.png', alt: 'A dialog titled Add the card ending 4786. Inside a bordered box: the checkout wallet terms, an I agree checkbox and a Continue button. Below the box: a note, a Cancel button and a disabled Add card button.', caption: 'The bordered box is an iframe: a page served by the wallet operator, not by CardVault. Add card stays disabled until the terms are accepted inside it.' })}
<p>Before a card goes into the wallet, the customer must accept the wallet operator’s terms. CardVault does not write those terms; the operator serves them as its own small web page, and CardVault shows that page in an <strong>iframe</strong> (inline frame): a box on one page that displays another page. The “I agree” box and the Continue button live inside the operator’s page. When the customer presses Continue, the frame sends a message to CardVault’s page, which then enables <strong>Add card</strong>.</p>

<h2>Why a normal locator fails</h2>
<p>Each frame has its own document. <code>page.getByLabel('I agree')</code> searches only CardVault’s page, so it finds nothing, and an action on it waits until the test times out. You first have to step into the frame.</p>

<h2>The test</h2>
<p>Adding a card changes data, so each test gets a brand-new customer with one card that is not in the wallet yet. The <code>beforeEach</code> signs in and presses <strong>Add to wallet</strong>, which opens the dialog. The helper that creates the customer is <code>newCustomerWithCard</code>, a sibling of the one from <a href="/learn/pw-forms/">forms and uploads</a>.</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/frames.spec.ts', src: `
test('agree to the terms inside the frame, then add the card', async ({ page }) => {
  // The terms are a separate web page, shown in an <iframe>.
  // contentFrame() gives a locator for the page inside it.
  const terms = page.getByTestId('terms-iframe').contentFrame();
  const addCard = page.getByRole('button', { name: 'Add card' });

  await expect(addCard).toBeDisabled();

  // Inside the frame: the same locators and actions as on any page.
  await terms.getByLabel('I agree').check();
  await terms.getByRole('button', { name: 'Continue' }).click();
  await expect(terms.getByText('Thank you.')).toBeVisible();

  // Back on the main page: the frame told it the terms were accepted.
  await expect(page.getByTestId('consent-status')).toContainText('accepted');
  await expect(addCard).toBeEnabled();
  await addCard.click();

  // The card shows as pending, then the wallet confirms it a moment later.
  const card = page.getByTestId('wallet-cards').getByRole('listitem');
  await expect(card).toContainText('ENROLLED', { timeout: 10_000 });
});
` })}
<ol>
<li><code>page.getByTestId('terms-iframe')</code> finds the <code>&lt;iframe&gt;</code> element on CardVault’s page. <code>.contentFrame()</code> turns it into a <strong>frame locator</strong>: a starting point for locators <em>inside</em> the frame. It does not wait or fail by itself; like every locator, it is only a description until you act on it.</li>
<li><code>terms.getByLabel('I agree')</code> and <code>terms.getByRole('button', ...)</code> work exactly like their page versions. Auto-waiting and web-first assertions work inside frames too, including waiting for the frame’s page to load.</li>
<li>The checks go back and forth on purpose. “Thank you.” inside the frame shows the frame did its part. The status line and the enabled button on the main page show that CardVault received the frame’s message. A bug in either half fails a different line.</li>
<li>The last check allows 10 seconds instead of 5. After Add card, the wallet operator confirms the card a moment later, and the page changes the badge from PENDING to ENROLLED without a reload. The operator’s delay is part of the product, so a longer limit for this one check is justified.</li>
</ol>

<h2>What happens between the frame and the page</h2>
${sequence({
  id: 'frame-message',
  label: 'Accepting the terms',
  actors: [
    { id: 't', label: 'Test', kind: 'plain' },
    { id: 'f', label: 'Terms frame', kind: 'mock' },
    { id: 'p', label: 'CardVault page', kind: 'bank' },
  ],
  steps: [
    { from: 't', to: 'f', label: 'check, Continue', note: 'The test acts inside the frame, through the frame locator.' },
    { from: 'f', to: 'p', label: 'terms accepted', kind: 'event', note: 'The operator’s page sends a message to its parent page, saying which version of the terms was accepted.' },
    { from: 'p', to: 'p', label: 'enable Add card', note: 'CardVault accepts messages only from the operator’s address, then enables the button.' },
    { from: 't', to: 'p', label: 'Add card', note: 'The test acts on the main page again, through page.' },
  ],
  caption: 'The test never sends the message itself. It acts like the customer and checks that each side reacted.',
})}

<h2>A smaller check: Continue waits for the box</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/frames.spec.ts', src: `
test('Continue stays disabled until the box is ticked', async ({ page }) => {
  const terms = page.getByTestId('terms-iframe').contentFrame();

  await expect(terms.getByRole('heading', { name: /Checkout wallet terms/ })).toBeVisible();
  await expect(terms.getByRole('button', { name: 'Continue' })).toBeDisabled();

  await terms.getByLabel('I agree').check();
  await expect(terms.getByRole('button', { name: 'Continue' })).toBeEnabled();
});
` })}
<p>The heading has a pattern because it ends with the terms version, which can change: “Checkout wallet terms (version 2026-01)”.</p>
<p>You may also see the older form <code>page.frameLocator('[data-testid="terms-iframe"]')</code>. It does the same job with a CSS selector. <code>contentFrame()</code> lets you find the iframe with any locator, such as a test id or its title.</p>

${keyIdea('<p>Elements inside an iframe need a frame locator: find the iframe, call <code>contentFrame()</code>, then use the usual locators from there. Check both sides when the frame and the page talk to each other.</p>')}

${testerEye('<p>The frame here comes from another address, the wallet operator’s, which browsers treat as a separate site. Playwright handles that for you, but it is worth testing that the main page ignores messages from anywhere else. That kind of rule is often easier to cover with a focused check by developers than through the UI.</p>')}

${interview({
  say: `<p>“For iframes I locate the iframe element and call contentFrame() to get a frame locator, then use getByRole and getByLabel inside it as usual; auto-waiting still applies. On CardVault the wallet terms come from the operator in a cross-origin iframe, which posts a message to the parent page. I act inside the frame, then assert on both sides: the frame’s confirmation and the parent page enabling the Add card button.”</p>`,
  qa: [
    ['What is the difference between page.frame() and a frame locator?', '<p><code>page.frame(...)</code> returns a <code>Frame</code> object for a frame that exists right now, found by name or address. A frame locator, from <code>locator.contentFrame()</code> or <code>page.frameLocator()</code>, is lazy like any locator: it finds the frame when you act, and waits for it. Prefer the frame locator in tests.</p>'],
    ['How do you interact with an element inside an iframe?', '<p>Get a frame locator, for example <code>page.getByTestId(\'terms-iframe\').contentFrame()</code> or <code>page.frameLocator(selector)</code>, then call locator methods on it. Page-level locators cannot see inside the frame.</p>'],
    ['Does Playwright wait for the frame to load?', '<p>Yes. Actions and assertions on a frame locator wait for the frame and its elements, just as on the main page, so no extra wait is needed.</p>'],
    ['Does a cross-origin iframe need special handling?', '<p>Not in Playwright: frame locators work the same for frames from other sites. What changes is the app’s behaviour, such as checking the sender of messages, which is worth testing.</p>'],
  ],
})}
`,
};
