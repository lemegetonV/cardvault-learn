import { Page, Locator } from '@playwright/test';

// The short messages that pop up in a corner after an action, such as
// "Dispute opened". They appear on every page, so they are a component of
// their own instead of a part of each page object.
export class Toast {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // The message with this text. Each toast has role="status", which screen readers announce.
  message(text: string): Locator {
    return this.page.getByRole('status').filter({ hasText: text });
  }
}
