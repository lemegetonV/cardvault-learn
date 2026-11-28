import { Page, Locator } from '@playwright/test';

// The sign-in page. A page object keeps a page's locators and actions in one
// place, so tests say what they do ("sign in") instead of how (fill, fill, click).
export class LoginPage {
  readonly page: Page;
  readonly username: Locator;
  readonly password: Locator;
  readonly signInButton: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.page = page;
    this.username = page.getByLabel('Username');
    this.password = page.getByLabel('Password');
    this.signInButton = page.getByRole('button', { name: 'Sign in' });
    this.error = page.getByTestId('login-error');
  }

  async open() {
    await this.page.goto('/login');
  }

  async signIn(username: string, password: string) {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.signInButton.click();
  }
}
