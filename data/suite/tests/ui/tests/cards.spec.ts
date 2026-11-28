import { test, expect } from '../fixtures';
import { ALICE_CARDS } from '../data/test-data';
import { ALICE_LOGIN } from '../config';

// These tests only read alice's cards, so they start with her saved login.
test.use({ storageState: ALICE_LOGIN });

test('alice has her four cards', async ({ cardsPage }) => {
  await cardsPage.open();

  await expect(cardsPage.cards).toHaveCount(4);
  for (const last4 of Object.values(ALICE_CARDS)) {
    await expect(cardsPage.card(last4)).toBeVisible();
  }
});

test('the credit card shows its limit', async ({ cardsPage }) => {
  await cardsPage.open();

  await expect(cardsPage.card(ALICE_CARDS.credit).getByTestId('card-limit')).toHaveText('$5,000.00');
});
