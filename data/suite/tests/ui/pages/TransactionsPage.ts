import { Page, Locator } from '@playwright/test';

// The Wallet transactions page: the list, its filters and the CSV export.
export class TransactionsPage {
  readonly page: Page;
  readonly rows: Locator;
  readonly statuses: Locator;
  readonly status: Locator;
  readonly applyButton: Locator;
  readonly clearButton: Locator;
  readonly loadMoreButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.rows = page.getByTestId('txn-row');
    this.statuses = this.rows.getByTestId('txn-status'); // the status label on each row
    this.status = page.getByLabel('Status');
    this.applyButton = page.getByRole('button', { name: 'Apply' });
    this.clearButton = page.getByRole('button', { name: 'Clear' });
    this.loadMoreButton = page.getByRole('button', { name: 'Load more' });
  }

  async open() {
    await this.page.goto('/wallet/transactions');
  }

  // Show only transactions with one status, such as 'SETTLED' or 'DECLINED'.
  async filterByStatus(status: string) {
    await this.status.selectOption(status);
    await this.applyButton.click();
  }

  // Open one transaction's details by clicking its shop's name.
  async openTransaction(merchant: string) {
    await this.page.getByRole('link', { name: merchant }).click();
  }
}
