import { Page, Locator, FrameLocator } from '@playwright/test';

// The dialog that opens before a card is added to the wallet. The wallet
// company's terms sit inside it in a frame: a small web page of their own.
export class ConsentDialog {
  readonly page: Page;
  readonly terms: FrameLocator;
  readonly agreeBox: Locator;
  readonly continueButton: Locator;
  readonly thankYou: Locator;
  readonly addCardButton: Locator;

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
}
