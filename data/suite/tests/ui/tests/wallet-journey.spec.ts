import { test, expect } from '../fixtures';

// Journey: a customer adds a card to the checkout wallet, then removes it.
// customerWithCard is a new customer, signed in, with one card not in the wallet.

test('add a card to the wallet, then remove it', { tag: '@phone' }, async ({ customerWithCard, walletPage, consentDialog, toast }) => {
  const last4 = customerWithCard.last4;
  await expect(walletPage.status(last4)).toHaveText('NOT ADDED');

  await test.step('accept the terms and add the card', async () => {
    await walletPage.startAddingCard(last4);
    await consentDialog.acceptTerms();
    await consentDialog.addCardButton.click();
    await expect(toast.message(`Adding the card ending ${last4}`)).toBeVisible();
  });

  await test.step('the wallet company confirms the card', async () => {
    // The card is PENDING until the wallet company answers, usually within a few seconds.
    await expect(walletPage.status(last4)).toHaveText('ENROLLED', { timeout: 10_000 });
  });

  await test.step('remove the card again', async () => {
    await walletPage.removeCard(last4);
    await expect(toast.message(`Card ending ${last4} removed from the wallet`)).toBeVisible();
    await expect(walletPage.status(last4)).toHaveText('REMOVED');
    // A card the customer removed cannot simply be added back.
    await expect(walletPage.card(last4)).toContainText('Not eligible: Card removed by customer');
  });
});

test('Add card stays disabled until the terms are accepted', async ({ customerWithCard, walletPage, consentDialog }) => {
  await walletPage.startAddingCard(customerWithCard.last4);
  await expect(consentDialog.addCardButton).toBeDisabled();

  await consentDialog.acceptTerms();

  await expect(consentDialog.addCardButton).toBeEnabled();
});
