// The lab's Playwright settings: the UI suite's own config, with three changes for a run
// from the site. Every test records a trace, a video and a final screenshot; the results
// go to this run's own folder; and the lab's reporter streams each step to the page.
//
// UI_DIR is the suite folder (tests/ui of a CardVault checkout); LAB_RUN_DIR is this run's
// folder. Both are set by server.py.
const path = require('node:path');

const UI_DIR = process.env.UI_DIR;
const RUN_DIR = process.env.LAB_RUN_DIR;
const base = require(path.join(UI_DIR, 'playwright.config.ts')).default;

// The suite's folders are relative to its own config file, so make them absolute here.
const inSuite = (dir) => path.resolve(UI_DIR, dir || '.');

module.exports = {
  ...base,
  testDir: inSuite(base.testDir),
  outputDir: path.join(RUN_DIR, 'results'),
  retries: 0,
  workers: 1,
  reporter: [
    [path.join(__dirname, 'pw-reporter.cjs')],
    ['html', { outputFolder: path.join(RUN_DIR, 'report'), open: 'never' }],
  ],
  use: { ...base.use, trace: 'on', video: 'on', screenshot: 'on' },
  projects: (base.projects || []).map((p) => ({ ...p, testDir: inSuite(p.testDir) })),
};
