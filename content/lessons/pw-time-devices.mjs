import { code, interview, table, keyIdea, shot, testerEye } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'Some behaviour depends on things a test does not normally control: how much time has passed, where in the world the customer is, and what device they hold. Waiting 14 real minutes for a session warning is not a test anyone would run. This lesson shows Playwright’s fake clock, its time zone and language settings, and its phone emulation.',
  youWill: 'You will be able to test time-based behaviour with page.clock, local formats with locale and timezoneId, and phones with devices.',
  body: `
<h2>The session warning</h2>
${shot({ src: 'pw-session-warning.png', alt: 'The wallet page dimmed behind a dialog: Your session is about to end. Signing out in 59 s. Buttons: Sign out and Stay signed in.', caption: 'One minute before the 15-minute session ends, CardVault warns the customer. Reached in a test by moving a fake clock, not by waiting.' })}
<p>A CardVault session lasts 15 minutes. At 14 minutes the page shows a warning with a countdown; <strong>Stay signed in</strong> extends the session; at 15 minutes the page signs the customer out. The page measures this with the browser’s own clock and timers, which is exactly what Playwright can fake.</p>

<h2>A fake clock</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/time.spec.ts', src: `
  test.beforeEach(async ({ page }) => {
    // Give the page a fake clock before it opens, so the test can move time on.
    await page.clock.install();

    // The wallet page asks the server how long the session has left, then
    // starts its timer. Wait for that answer, or time could move on too early.
    const session = page.waitForResponse('**/api/auth/session');
    await signInAsAlice(page);
    await session;
  });
` })}
<ul>
<li><code>page.clock.install()</code> replaces the page’s clock and timers with fake ones that Playwright controls. Call it before the page opens: timers the page started earlier are not controlled. The fake clock covers the whole context, every page in it. Time still flows normally until the test moves it.</li>
<li>The wait for <code>/api/auth/session</code> matters. Until that answer arrives, the page’s timer has no deadline, and moving the clock would do nothing. An earlier version of this file skipped it and failed now and then when the machine was busy, which is how the line got here.</li>
</ul>
${code({ lang: 'typescript', title: 'tests/ui/learn/time.spec.ts', src: `
  test('a warning appears one minute before the session ends', async ({ page }) => {
    // Jump 14 minutes ahead. Each timer that came due fires once, like opening a laptop lid.
    await page.clock.fastForward('14:00');

    const warning = page.getByRole('alertdialog', { name: 'Your session is about to end' });
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('Signing out in');

    await warning.getByRole('button', { name: 'Stay signed in' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'You are still signed in' })).toBeVisible();
    await expect(warning).toBeHidden();
  });

  test('after 15 minutes the customer is signed out', async ({ page }) => {
    // A few seconds past 15 minutes: the session timer starts a moment after
    // the page opens, so exactly 15:00 can land just before the deadline.
    await page.clock.fastForward('15:05');

    await expect(page).toHaveURL(/\\/login\\?reason=timeout/);
    await expect(page.getByText('You were signed out after 15 minutes.')).toBeVisible();
  });
` })}
<p><code>fastForward('14:00')</code> moves the fake clock 14 minutes ahead in an instant, as “minutes:seconds”, and fires each timer that came due once, like opening a laptop after it slept: a countdown that ticks every second does not tick 840 times. (<code>page.clock.runFor</code> would run every tick.) The page reacts as if 14 minutes had passed. The checks use only what the customer sees: an <code>alertdialog</code> (a dialog that needs attention), the countdown text, the toast, and finally the sign-in page with its message. The countdown is checked loosely, “Signing out in”, because the exact second depends on when the page’s timer last ticked.</p>

<h2>Where the customer is</h2>
<p>CardVault shows every date and time in the customer’s own time zone and format, using the browser’s settings. Two options control those settings: <code>locale</code>, the language and region (such as <code>en-IN</code>, English as used in India), and <code>timezoneId</code>, the time zone. To know the right answer, the test needs a transaction at a known moment, so it supplies one with <a href="/learn/pw-network-mocking/">page.route</a>: one purchase at 14:30 UTC on 1 March 2026.</p>
${code({ lang: 'typescript', title: 'tests/ui/learn/time.spec.ts', src: `
test.describe('a customer in India', () => {
  // The browser's language and time zone, for every test in this group.
  test.use({ locale: 'en-IN', timezoneId: 'Asia/Kolkata' });

  test('sees the time in India Standard Time', async ({ page }) => {
    await page.route('**/api/wallet/transactions?*', (route) => route.fulfill({ json: ONE_PURCHASE }));
    await signInAsAlice(page);
    await page.goto('/wallet/transactions');

    // 14:30 UTC is 20:00 in India (UTC+5:30).
    await expect(page.getByTestId('txn-time')).toContainText('1 Mar 2026, 8:00 pm');
  });
});
` })}
<p>The file has a second group for New York, with <code>en-US</code> and <code>America/New_York</code>, which expects <code>Mar 1, 2026, 9:30 AM</code>. The same instant, two correct answers. Both expected texts were worked out from the time zone rules, then confirmed by running the tests.</p>

<h2>Pretending to be a phone</h2>
${code({ lang: 'typescript', title: 'tests/ui/learn/devices.spec.ts', src: `
// devices holds ready-made settings for real phones and tablets: screen size,
// pixel density, touch and the browser's user agent. This file pretends to be
// a Pixel 7 phone.
test.use({ ...devices['Pixel 7'] });
` })}
${code({ lang: 'typescript', title: 'tests/ui/learn/devices.spec.ts', src: `
test('tap the Menu button to reach the other pages', async ({ page }) => {
  // tap() is a touch, the way a finger presses a phone screen.
  await page.getByRole('button', { name: 'Menu' }).tap();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Cards' }).tap();

  await expect(page).toHaveURL('/cards');
  await expect(page.getByRole('heading', { name: 'Cards' })).toBeVisible();
});
` })}
<p>The device settings go at the top of the file because they include which browser to use, which Playwright can only set for a whole file or project. <code>tap()</code> needs a touch screen, which the Pixel 7 settings switch on. A second test in the file checks that the page never scrolls sideways at phone width. This is <strong>emulation</strong>: Chromium imitating a phone. It catches layout problems, but it is not a real phone or the phone’s own browser.</p>

${keyIdea('<p>Install a fake clock before the page opens and move it with <code>fastForward</code>. Set <code>locale</code> and <code>timezoneId</code> to see the page as customers elsewhere do. Use <code>devices[...]</code> to emulate a phone. In each case, work out the expected result from the rules, not from the screen.</p>')}

${table(['To test', 'Use'], [
  ['Something that happens after a while', '`page.clock.install()`, then `page.clock.fastForward(\'14:00\')`'],
  ['A fixed “now”', '`page.clock.setFixedTime(new Date(...))`'],
  ['Language and number formats', '`test.use({ locale: \'en-IN\' })`'],
  ['A time zone', '`test.use({ timezoneId: \'Asia/Kolkata\' })`'],
  ['A phone or tablet', '`test.use({ ...devices[\'Pixel 7\'] })` or a project'],
  ['A screen size only', '`test.use({ viewport: { width, height } })`'],
])}

${testerEye('<p>Time zones are a classic source of bugs: a purchase late in the evening that shows on the wrong day, or a date filter that cuts off a few hours early. Pick test times near midnight and in zones far from UTC. A fake clock also lets you test what real time makes impractical, such as a code that expires after 30 seconds.</p>')}

${interview({
  say: `<p>“For time-based UI like a session timeout I install Playwright’s fake clock before the page loads and fastForward it, so a 15-minute rule runs in a second. For dates and currency I set locale and timezoneId per test group and feed the page a transaction at a known UTC time, so the expected local text is worked out from the rules. For mobile I emulate a device from the devices list, tap instead of click, and check there is no horizontal scroll.”</p>`,
  qa: [
    ['How do you test a session timeout without waiting?', '<p>Call <code>page.clock.install()</code> before the page opens, then <code>page.clock.fastForward(\'14:00\')</code> to jump ahead; each timer that came due fires once. Assert on the warning, then fast-forward past the limit and assert the sign-out.</p>'],
    ['How do you test that dates show in the user’s time zone?', '<p>Set <code>timezoneId</code> and <code>locale</code> with <code>test.use</code>, control the data so a timestamp is known, and assert the local text you work out from the zone’s offset. Repeat for a second zone to prove the conversion.</p>'],
    ['Is device emulation the same as testing on a real phone?', '<p>No. It sets the screen size, pixel density, touch and user agent in a desktop browser engine, which finds most layout and touch problems. Browser-specific or hardware issues need real devices or a device cloud.</p>'],
  ],
})}
`,
};
