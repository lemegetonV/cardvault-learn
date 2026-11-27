// Diagrams for the Playwright track.
import { svg, box, arrow, text } from '../../src/components.mjs';

/** How a test reaches the app: test file, Playwright, a real browser, the web app. */
export function howItDrives() {
  const W = 880, H = 300;
  let b = '';
  b += box(20, 112, 130, 76, 'Your test', { kind: 'plain', sub: 'a .spec.ts file' });
  b += box(180, 112, 140, 76, 'Playwright', { kind: 'plain', sub: 'runner + library' });
  b += arrow([[150, 150], [176, 150]]);
  // The browser, with a context and a page inside it.
  b += `<rect class="zone" x="420" y="20" width="250" height="260" rx="16"/>`;
  b += text(438, 46, 'A real browser', 't-sm', 'start');
  b += text(438, 64, 'Chromium, Firefox or WebKit', 't-mono', 'start');
  b += `<rect class="zone" x="438" y="82" width="214" height="180" rx="12"/>`;
  b += text(454, 104, 'Context: a fresh profile', 't-sm', 'start');
  b += box(458, 120, 174, 124, 'Page', { kind: 'plain', sub: 'one tab' });
  b += arrow([[320, 170], [454, 170]], 'ln', 'ah', { start: true });
  b += text(370, 160, 'commands');
  b += text(370, 190, 'results', 't-sm t-muted');
  b += box(730, 144, 130, 76, 'Web app', { kind: 'bank', sub: 'CardVault' });
  b += arrow([[632, 182], [726, 182]], 'ln', 'ah', { start: true });
  b += text(690, 172, 'HTTP', 't-sm');
  return svg(W, H, 'Your test file tells Playwright what to do. Playwright drives a real browser and reports the results back. Inside the browser a context holds a page, and the page loads the CardVault web app.', b);
}

/** One browser, a fresh context for each test, a page in each context. */
export function contexts() {
  const W = 760, H = 250;
  let b = '';
  b += `<rect class="zone" x="20" y="16" width="720" height="218" rx="16"/>`;
  b += text(40, 42, 'One browser, started once', 't-sm', 'start');
  const ctx = (x, label, user) => {
    let c = `<rect class="zone" x="${x}" y="60" width="320" height="156" rx="12"/>`;
    c += text(x + 16, 84, label, 't-sm', 'start');
    c += text(x + 16, 102, user, 't-mono', 'start');
    c += box(x + 20, 116, 280, 80, 'Page', { kind: 'plain', sub: 'its own cookies, storage, sign-in' });
    return c;
  };
  b += ctx(40, 'Context for test 1', 'signed in as alice');
  b += ctx(400, 'Context for test 2', 'not signed in');
  return svg(W, H, 'Playwright starts one browser and gives every test its own context. Contexts share nothing: a sign-in in one is invisible in the other.', b);
}

/** Which locator to try first: from what the user sees down to the page's structure. */
export function locatorLadder() {
  const W = 820, H = 330;
  const rows = [
    ['getByRole', 'a button, link or heading, by its name', 'plain', 'first choice'],
    ['getByLabel', 'a form field, by the label beside it', 'plain', ''],
    ['getByText / getByPlaceholder', 'by the words on the screen', 'plain', ''],
    ['getByTestId', 'by a data-testid the developers added', 'plain', 'when nothing above fits'],
    ['CSS or XPath', 'by the page’s inner structure', 'stop', 'last resort: breaks easily'],
  ];
  let b = '';
  rows.forEach(([name, what, kind, note], i) => {
    const y = 18 + i * 60;
    b += box(20, y, 290, 46, name, { kind, cls: 't-md' });
    b += text(330, y + 28, what, 't-sm', 'start');
    if (note) b += text(800, y + 28, note, 't-sm t-muted', 'end');
  });
  return svg(W, H, 'Try locators from the top. The top three find things the way a user does. A test id is a stable fallback. CSS and XPath depend on the page structure and break when it changes.', b);
}
