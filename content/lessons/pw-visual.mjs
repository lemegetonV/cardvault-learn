import { code, terminal, interview, table, keyIdea, shot, testerEye } from '../../src/components.mjs';

export default {
  minutes: 11,
  lede: 'Every check so far looks at text, counts and states. None of them would notice a button that turned the wrong colour or a layout that slid out of place. Visual comparison does: it takes a screenshot and compares it with an approved picture, pixel by pixel. This lesson shows how it works, how to deal with parts that change, and why the pictures belong to one kind of machine.',
  youWill: 'You will be able to write a screenshot comparison, handle changing content with masks, and explain where baselines come from.',
  body: `
<h2>Comparing pictures</h2>
<p><code>expect(page).toHaveScreenshot(name)</code> takes a screenshot and compares it with a saved picture called the <strong>baseline</strong>. If any pixel differs by more than a small colour threshold, the test fails; <code>maxDiffPixels</code> can allow a few differing pixels, but by default none are allowed. The first time, there is no baseline: Playwright saves the screenshot as the baseline and fails the test, so that a person looks at the picture before it becomes the truth.</p>
${code({ lang: 'typescript', title: 'tests/ui/visual/visual.spec.ts', src: `
test('the sign-in page looks as it did', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveScreenshot('sign-in.png');
});
` })}
${terminal([['npm run visual', `    Error: A snapshot doesn't exist at /work/visual/visual.spec.ts-snapshots/sign-in-visual-linux.png, writing actual.`]], 'Real output of the first run, shortened. Why the command is npm run visual comes at the end.')}
<p>The baseline is saved next to the test, in a folder named after the file. The name ends with the project and the operating system: <code>sign-in-visual-linux.png</code>. The next run compares against it and passes. Before comparing, Playwright waits until two screenshots in a row are identical and turns off animations, so a page still settling does not fail the test.</p>

<h2>When something changes</h2>
<p>To see a failure, a temporary test turned the Sign in button red and compared again:</p>
${terminal([['npm run visual', `    Error: expect(page).toHaveScreenshot(expected) failed

      11843 pixels (ratio 0.02 of all image pixels) are different.

      Snapshot: sign-in.png`]], 'Real output, shortened')}
${shot({ src: 'pw-visual-diff.png', alt: 'Three pictures of the sign-in form side by side: the expected one with a blue Sign in button, the received one with a red button, and a diff where only the button is highlighted in red.', caption: 'The report shows the baseline, this run’s screenshot and a diff that highlights the changed pixels. Here, only the button.' })}
<p>The HTML report shows the three pictures side by side, with a slider to compare them. If the change was intended, a new design for instance, you approve it by updating the baseline: <code>npx playwright test --update-snapshots</code> overwrites the saved pictures with the new screenshots, and the change is reviewed like code.</p>

<h2>One element, with a mask</h2>
${code({ lang: 'typescript', title: 'tests/ui/visual/visual.spec.ts', src: `
  const card = page.getByRole('listitem').filter({ hasText: '4417' });

  // A picture of one element. "Last used" changes from day to day, so mask
  // hides it behind a coloured box before comparing.
  await expect(card).toHaveScreenshot('credit-card-4417.png', {
    mask: [card.getByTestId('card-last-used')],
  });
` })}
<p>A screenshot of a single element, here alice’s credit card, is smaller and steadier than a whole page. Some content changes on its own, such as a date or a time, and would fail every comparison. <code>mask</code> takes a list of locators and covers each one with a solid pink box in both pictures, so only the rest is compared. The available balance and limit stay visible, because the demo data keeps them the same.</p>

${keyIdea('<p><code>toHaveScreenshot</code> compares with an approved baseline and fails on visible change. Approve intended changes with <code>--update-snapshots</code>. Prefer single elements, and mask parts that change on their own.</p>')}

<h2>Why the pictures belong to one machine</h2>
<p>The same page renders slightly differently on another operating system, browser build or set of fonts: text a pixel wider, edges smoothed differently. CardVault’s suite learned this the hard way. The first baselines were made on one Linux machine, and on the CI machine, also Linux, both tests failed:</p>
${terminal([['(CI, the test step)', `    Error: expect(page).toHaveScreenshot(expected) failed

      1363 pixels (ratio 0.01 of all image pixels) are different.`]], 'Real output from CI, shortened')}
<p>Nothing in the app had changed; the fonts had. The usual answer is to take and compare every screenshot on the same machine image. Playwright publishes a <strong>Docker image</strong>, a ready-made Linux system with the browsers and fonts installed, for each version. CardVault runs its visual tests inside it, locally and on CI, so the baselines and the comparisons come from identical machines.</p>
${code({ lang: 'typescript', title: 'tests/ui/visual.config.ts', src: `
export default defineConfig({
  testDir: './visual',
  outputDir: 'visual-results',
` })}
<p>The visual tests have their own folder and a second config file, so the everyday <code>npx playwright test</code> leaves them out. <code>npm run visual</code> starts the Docker image and runs <code>npx playwright test --config visual.config.ts</code> inside it; <code>--config</code> picks a settings file other than the default. To approve new pictures, <code>npm run visual:update</code> does the same with <code>--update-snapshots</code>.</p>

${table(['Option', 'What it does'], [
  ['`mask: [locator]`', 'Covers changing parts before comparing'],
  ['`maxDiffPixels: 100`', 'Allows up to this many different pixels'],
  ['`maxDiffPixelRatio: 0.01`', 'Allows this share of pixels to differ'],
  ['`fullPage: true`', 'Captures the whole scrollable page'],
  ['`animations: \'disabled\'`', 'Stops animations (already the default for <code>toHaveScreenshot</code>)'],
  ['`--update-snapshots`', 'Saves new baselines from this run'],
])}

${testerEye('<p>Visual tests catch what nothing else does: a broken style sheet, overlapping text, a missing icon. They also fail on harmless changes, so keep them few and focused on screens where looks matter, such as a sign-in page or a payment card. Check new baselines by eye; an approved picture of a bug is a test that guards the bug.</p>')}

${interview({
  say: `<p>“Playwright’s toHaveScreenshot compares against a committed baseline, with a diff image in the report on failure. I keep visual checks to a few key screens, prefer element screenshots, mask dynamic content such as dates, and set a small tolerance if needed. Baselines depend on OS, browser and fonts, so we take and compare them inside Playwright’s Docker image, locally and on CI, and intended changes are approved with --update-snapshots and reviewed in the pull request.”</p>`,
  qa: [
    ['How does visual testing work in Playwright?', '<p><code>toHaveScreenshot</code> takes a screenshot, waits until it is stable, and compares it with a saved baseline. The first run saves the baseline. Later runs fail when pixels differ beyond the tolerance, and the report shows expected, actual and diff.</p>'],
    ['How do you handle dynamic content in screenshots?', '<p>Mask it with the <code>mask</code> option, control it (fake clock, mocked data), or screenshot a smaller element that does not contain it. A small <code>maxDiffPixels</code> tolerance can absorb tiny rendering noise.</p>'],
    ['Why might visual tests pass locally and fail on CI?', '<p>Rendering differs between operating systems, browser builds and installed fonts. Baselines should be generated in the same environment that compares them, often a fixed Docker image, and Playwright names baselines per platform for this reason.</p>'],
  ],
})}
`,
};
