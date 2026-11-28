import { code, terminal, interview, table, keyIdea, shot, testerEye } from '../../src/components.mjs';

export default {
  minutes: 10,
  lede: 'A test run is only useful if someone can read its result: you now, a teammate tomorrow, a manager before a release. Playwright’s reporters turn a run into terminal output, an HTML report or files for other tools, and a test can add its own evidence. This lesson shows the reporters and how to make a report say more.',
  youWill: 'You will be able to choose reporters and add steps, annotations and attachments that make a report useful.',
  body: `
<h2>Reporters</h2>
<p>A <strong>reporter</strong> decides how a run’s results are shown or saved. CardVault’s config, from <a href="/learn/pw-config/">the config lesson</a>, uses two at once: <code>list</code> prints a line per test in the terminal, and <code>html</code> writes a report you open in a browser. You can swap them for one run on the command line:</p>
${terminal([['npx playwright test learn/running.spec.ts --reporter=dot', `Running 5 tests using 1 worker
·····
  5 passed (2.6s)`]], 'Real output: one dot per test, the setup step included')}
${table(['Reporter', 'Gives you', 'Good for'], [
  ['`list`', 'One line per test', 'Running locally'],
  ['`line`, `dot`', 'A shorter progress display', 'Long runs, CI logs'],
  ['`html`', 'A browsable report with steps, errors, screenshots and traces', 'Reading results, sharing them'],
  ['`junit`', 'An XML file in a standard format', 'CI systems and test-management tools'],
  ['`json`', 'All results as JSON', 'Your own scripts and dashboards'],
  ['`blob`', 'Raw results to merge later', 'Runs split across machines (sharding)'],
])}

<h2>What makes a report useful</h2>
${shot({ src: 'pw-report-steps.png', alt: 'The HTML report entry for one test: its title, file and line, tags learn and export, an Annotations box saying feature: Transactions: Export CSV, a Test Steps box listing Before Hooks, sign in as alice, filter to settled transactions, export and keep the file, After Hooks with timings, and an Attachments box with a link to export.csv.', caption: 'One test in the HTML report. The tag, the annotation, the named steps and the attached file all come from the test below.' })}
${code({ lang: 'typescript', title: 'tests/ui/learn/reports.spec.ts', src: `
test(
  'the CSV export, with evidence for the report',
  // An annotation is a note shown with the test in the HTML report.
  { tag: '@export', annotation: { type: 'feature', description: 'Transactions: Export CSV' } },
  async ({ page }, testInfo) => {
` })}
<ul>
<li>The test’s name says what it checks in words a reader understands, which is the first thing a report shows.</li>
<li>The <strong>tag</strong> <code>@export</code> appears as a label and can be filtered on, in the report and with <code>--grep</code>, as in <a href="/learn/pw-running-tests/">running what you want</a>.</li>
<li>An <strong>annotation</strong> is a note with a <code>type</code> and a <code>description</code>. Teams use them to link a test to a feature, a ticket or a known issue. The report shows them in their own box.</li>
</ul>
${code({ lang: 'typescript', title: 'tests/ui/learn/reports.spec.ts', src: `
    await test.step('export and keep the file', async () => {
      const downloading = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export CSV' }).click();
      const download = await downloading;

      // Attach the downloaded file, so anyone reading the report can open it.
      await testInfo.attach('export.csv', { path: await download.path(), contentType: 'text/csv' });
      expect(download.suggestedFilename()).toMatch(/\\.csv$/);
    });
` })}
<p>The steps come from <code>test.step</code>, met in <a href="/learn/pw-debugging/">debugging</a>. <code>testInfo.attach(name, { path, contentType })</code> copies a file into the report; <a href="/learn/pw-builtin-fixtures/">built-in fixtures</a> attached a screenshot the same way with <code>body</code>. Now the evidence travels with the result: a reviewer can open the exact file this run downloaded. <code>toMatch</code> checks text against a pattern; <code>/\\.csv$/</code> means “ends with .csv”.</p>

<h2>What the report adds by itself</h2>
<ul>
<li><strong>On failure:</strong> the error, the screenshot and the trace, because the config asks for them.</li>
<li><strong>Retries and flaky tests:</strong> each attempt is listed, and a test that failed then passed is shown as <strong>flaky</strong>, with its own filter at the top.</li>
<li><strong>Timings:</strong> for the whole test and for each step, which helps to find slow tests.</li>
</ul>
<p><code>npx playwright show-report</code> opens the report of the last run. On CI it is uploaded as a file to download, which <a href="/learn/pw-ci/">running in CI</a> covers.</p>

${keyIdea('<p>Reporters decide how results are shown: <code>list</code> for the terminal, <code>html</code> to read and share, <code>junit</code> or <code>json</code> for other tools. Clear names, steps, tags, annotations and attachments turn a report into evidence.</p>')}

${testerEye('<p>Write test names and steps for the person reading the report, not for yourself. “the CSV export, with evidence” and a failed step called “export and keep the file” tell a developer where to look without opening the code. Attach evidence that would otherwise be lost, such as a downloaded file or an API response.</p>')}

${interview({
  say: `<p>“We run the list reporter locally and add the HTML report, which CI uploads with the run. A good report needs clear test names, test.step for the main stages, tags for filtering, annotations linking tests to features or tickets, and attachments such as a downloaded file. On failure the report already includes the error, screenshot and trace. For test-management tools we can add the junit reporter.”</p>`,
  qa: [
    ['Which reporters do you use and why?', '<p><code>list</code> for readable terminal output, <code>html</code> for a shareable report with steps, screenshots and traces, and <code>junit</code> when a CI or test-management tool needs a standard file. Several can run at once.</p>'],
    ['How do you add your own evidence to a report?', '<p>With <code>testInfo.attach(name, { body | path, contentType })</code>, for example a screenshot, a downloaded file or an API response. It appears under the test’s Attachments.</p>'],
    ['What is an annotation?', '<p>A note on a test, with a type and description, set in the test’s options or with <code>testInfo.annotations.push</code>. Built-in markers like skip and fixme are annotations too. They show in the report and are useful for linking tests to issues.</p>'],
  ],
})}
`,
};
