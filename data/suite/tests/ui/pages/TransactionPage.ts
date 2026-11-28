import { Page, Locator } from '@playwright/test';

// One transaction's details, and the form that disputes it.
export class TransactionPage {
  readonly page: Page;
  readonly amount: Locator;
  readonly disputeButton: Locator;
  readonly reason: Locator;
  readonly note: Locator;
  readonly receipt: Locator;
  readonly openDisputeButton: Locator;
  readonly disputeOpenBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.amount = page.getByTestId('txn-detail-amount');
    this.disputeButton = page.getByRole('button', { name: 'Dispute' });
    this.reason = page.getByLabel('Reason');
    this.note = page.getByLabel('Note (optional)');
    this.receipt = page.getByLabel(/Receipt/);
    this.openDisputeButton = page.getByRole('button', { name: 'Open dispute' });
    this.disputeOpenBadge = page.getByTestId('dispute-open-badge');
  }

  // Fill in the dispute form and send it. The note and the receipt are optional.
  async openDispute(reason: string, note = '', receiptFile = '') {
    await this.disputeButton.click();
    await this.reason.selectOption({ label: reason });
    if (note) await this.note.fill(note);
    if (receiptFile) await this.receipt.setInputFiles(receiptFile);
    await this.openDisputeButton.click();
  }
}
