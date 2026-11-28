import { Page, Locator } from '@playwright/test';

// The main navigation. On a wide screen its links are always shown; on a
// phone they hide behind a Menu button. goTo() works on both.
export class Menu {
  readonly page: Page;
  readonly menuButton: Locator;
  readonly nav: Locator;

  constructor(page: Page) {
    this.page = page;
    this.menuButton = page.getByRole('button', { name: 'Menu' });
    this.nav = page.getByRole('navigation', { name: 'Main' });
  }

  // Open one of the main pages by its link, for example 'Transactions'.
  // Call it once the page has shown its data: until then, the Menu button
  // may not respond to a click.
  async goTo(linkName: string) {
    // isVisible() answers straight away, without waiting: is the button on screen?
    if (await this.menuButton.isVisible()) {
      await this.menuButton.click();
    }
    await this.nav.getByRole('link', { name: linkName }).click();
  }
}
