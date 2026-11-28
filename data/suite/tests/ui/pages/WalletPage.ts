import { Page, Locator } from '@playwright/test';

// The Checkout wallet page: the customer's cards and whether each is in the wallet.
export class WalletPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly cards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Checkout wallet' });
    this.cards = page.getByTestId('wallet-cards').getByRole('listitem');
  }

  async open() {
    await this.page.goto('/wallet');
  }

  // One card in the list, found by the last four digits of its number.
  card(last4: string): Locator {
    return this.cards.filter({ hasText: `•••• ${last4}` });
  }

  // The card's wallet status label: NOT ADDED, PENDING, ENROLLED and so on.
  status(last4: string): Locator {
    return this.card(last4).getByTestId(/^enrollment-status-/);
  }

  // Start adding a card. The consent dialog opens next (components/ConsentDialog.ts).
  async startAddingCard(last4: string) {
    await this.card(last4).getByRole('button', { name: 'Add to wallet' }).click();
  }

  async removeCard(last4: string) {
    await this.card(last4).getByRole('button', { name: 'Remove from wallet' }).click();
  }
}
