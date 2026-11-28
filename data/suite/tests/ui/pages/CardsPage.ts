import { Page, Locator } from '@playwright/test';

// The Cards page: every card the customer holds, with its balance and actions.
export class CardsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly cards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Cards' });
    this.cards = page.getByTestId('card-list').getByRole('listitem');
  }

  async open() {
    await this.page.goto('/cards');
  }

  // One card in the list, found by the last four digits of its number.
  card(last4: string): Locator {
    return this.cards.filter({ hasText: `•••• ${last4}` });
  }

  // The card's "Available" amount, for example "$4,970.00".
  available(last4: string): Locator {
    return this.card(last4).getByTestId('card-available');
  }
}
