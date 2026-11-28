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

/** A web-first assertion checks again and again until the page matches or time runs out. */
export function retryTimeline() {
  const W = 820, H = 230;
  const x0 = 60, x1 = 780; // 0 s to 5 s
  const at = (s) => x0 + (x1 - x0) * (s / 5);
  let b = '';
  b += `<path class="ln-faint" d="M${x0} 120 H${x1}"/>`;
  [0, 1, 2, 3, 4, 5].forEach((s) => {
    b += `<path class="ln-faint" d="M${at(s)} 114 V126"/>`;
    b += text(at(s), 146, `${s} s`, 't-mono');
  });
  b += text(x1, 170, 'timeout: it would fail here', 't-sm t-stop', 'end');
  // The page: loading, then the badge appears.
  b += box(x0, 30, at(1.4) - x0, 40, 'Loading…', { kind: 'plain', cls: 't-sm' });
  b += box(at(1.4), 30, x1 - at(1.4), 40, 'Badge shows ENROLLED', { kind: 'bank', cls: 't-sm' });
  b += text(x0, 22, 'What the page shows', 't-sm t-muted', 'start');
  // The checks.
  [0, 0.3, 0.7, 1.2].forEach((s) => { b += `<circle class="dot-miss" cx="${at(s)}" cy="120" r="6"/>`; });
  b += `<circle class="dot-hit" cx="${at(1.6)}" cy="120" r="7"/>`;
  b += text(at(0.6), 104, 'not yet… not yet…', 't-sm t-muted');
  b += text(at(1.6), 104, 'matches: pass', 't-sm t-accent');
  b += text(x0, 204, 'Each dot is one check. The test moves on at the first match, not after a fixed time.', 't-sm t-muted', 'start');
  return svg(W, H, 'The assertion checks the page several times. The first checks see the loading text and fail quietly. The check after the badge appears passes, and the test moves on. If nothing matched for 5 seconds, the assertion would fail.', b);
}

/** A fixed pause against waiting for the thing that matters. */
export function sleepVsWait() {
  const W = 820, H = 250;
  const x0 = 170, x1 = 790;
  const at = (s) => x0 + (x1 - x0) * (s / 4);
  let b = '';
  b += text(20, 30, 'Time', 't-sm t-muted', 'start');
  [0, 1, 2, 3, 4].forEach((s) => { b += text(at(s), 30, `${s} s`, 't-mono'); });
  const lane = (y, label, ready, stop, cls, note) => {
    let l = text(20, y + 26, label, 't-md', 'start');
    l += `<path class="ln-faint" d="M${x0} ${y + 20} H${x1}"/>`;
    l += `<rect class="box-plain" x="${x0}" y="${y + 6}" width="${at(ready) - x0}" height="28" rx="6"/>`;
    l += text(x0 + 10, y + 25, 'rows loading', 't-mono', 'start');
    l += `<rect class="${cls}" x="${at(stop) - 3}" y="${y}" width="6" height="40" rx="3"/>`;
    l += text(at(Math.max(ready, stop)) + 12, y + 26, note, `t-sm ${cls === 'box-stop' ? 't-stop' : 't-accent'}`, 'start');
    return l;
  };
  b += lane(50, 'Sleep 2 s, quick day', 0.8, 2, 'box-bank', 'passes, 1.2 s wasted');
  b += lane(110, 'Sleep 2 s, slow day', 2.6, 2, 'box-stop', 'checked at 2 s: fails');
  b += lane(170, 'Wait for 20 rows', 2.6, 2.6, 'box-bank', 'goes on when they arrive');
  return svg(W, H, 'A fixed two-second sleep wastes time on a quick day and checks too early on a slow day. Waiting for the rows goes on the moment they arrive, whatever the day.', b);
}

/** The built-in fixtures, nested: one browser per worker, a context and page per test, request beside them. */
export function fixtureLayers() {
  const W = 820, H = 300;
  let b = '';
  b += `<rect class="zone" x="20" y="16" width="520" height="266" rx="16"/>`;
  b += text(40, 42, 'browser', 't-md', 'start');
  b += text(40, 60, 'started once per worker, shared by its tests', 't-mono', 'start');
  b += `<rect class="zone" x="40" y="76" width="480" height="188" rx="12"/>`;
  b += text(58, 100, 'context', 't-md', 'start');
  b += text(58, 118, 'new for every test: empty cookies and storage', 't-mono', 'start');
  b += box(60, 136, 210, 108, 'page', { kind: 'plain', sub: 'the first tab' });
  b += box(290, 136, 210, 108, 'context.newPage()', { kind: 'plain', sub: 'more tabs, same sign-in', cls: 't-md' });
  b += box(580, 60, 220, 90, 'request', { kind: 'plain', sub: 'HTTP calls, no browser' });
  b += box(580, 176, 220, 90, 'testInfo', { kind: 'plain', sub: 'facts about this test' });
  return svg(W, H, 'The browser fixture is started once per worker. Every test gets a new context inside it, and a page inside that. More pages in the same context share its sign-in. The request and testInfo fixtures sit beside the browser.', b);
}

/** What page.route can do with a request: answer it, change the real answer, or stop it. */
export function routeFlow() {
  const W = 860, H = 300;
  let b = '';
  b += box(20, 112, 140, 76, 'Page', { kind: 'plain', sub: 'asks for data' });
  b += box(220, 112, 160, 76, 'page.route', { kind: 'plain', sub: 'matches the address' });
  b += arrow([[160, 150], [216, 150]]);
  b += box(470, 20, 170, 64, 'fulfill', { kind: 'plain', sub: 'answer from the test' });
  b += box(470, 118, 170, 64, 'fetch, then fulfill', { kind: 'plain', sub: 'real answer, changed', cls: 't-md' });
  b += box(470, 216, 170, 64, 'abort', { kind: 'stop', sub: 'as if offline' });
  b += arrow([[380, 140], [430, 52], [466, 52]]);
  b += arrow([[380, 150], [466, 150]]);
  b += arrow([[380, 160], [430, 248], [466, 248]]);
  b += box(700, 112, 140, 76, 'Web app', { kind: 'bank', sub: 'CardVault' });
  b += arrow([[640, 150], [696, 150]], 'ln', 'ah', { start: true });
  return svg(W, H, 'A request from the page meets page.route first. The test can answer it itself with fulfill, let it reach CardVault and change the real answer before the page sees it, or abort it. Only the middle path reaches the web app.', b);
}

/** Sharding and workers: two machines, each running half the files with two workers. */
export function shardsWorkers() {
  const W = 860, H = 300;
  let b = '';
  const machine = (x, title, flag, lanes) => {
    let m = `<rect class="zone" x="${x}" y="16" width="400" height="266" rx="16"/>`;
    m += text(x + 20, 42, title, 't-md', 'start');
    m += text(x + 20, 60, flag, 't-mono', 'start');
    lanes.forEach((files, i) => {
      const y = 82 + i * 98;
      m += text(x + 20, y + 16, `worker ${i}`, 't-sm', 'start');
      files.forEach((f, j) => {
        m += box(x + 20 + j * 124, y + 26, 112, 54, f, { kind: 'plain', cls: 't-sm' });
      });
    });
    return m;
  };
  b += machine(20, 'Machine 1: shard 1 of 2', '--shard=1/2', [['forms', 'hooks', 'frames'], ['locators', 'time', '…']]);
  b += machine(440, 'Machine 2: shard 2 of 2', '--shard=2/2', [['waiting', 'reports', 'devices'], ['parallel', 'network', '…']]);
  return svg(W, H, 'Sharding splits the test files between two machines. On each machine, two workers take files one at a time and run them side by side.', b);
}

/** The framework in layers: tests on top, fixtures, then page objects and the API client, then the app. */
export function frameworkLayers() {
  const W = 860, H = 380;
  let b = '';
  b += box(250, 16, 360, 62, 'tests/*.spec.ts', { kind: 'plain', sub: 'what to check, in plain steps' });
  b += arrow([[430, 78], [430, 104]]);
  b += box(250, 108, 360, 62, 'fixtures.ts', { kind: 'plain', sub: 'hands each test what it asks for' });
  b += arrow([[330, 170], [170, 204]]);
  b += arrow([[530, 170], [690, 204]]);
  b += box(20, 208, 300, 62, 'pages/ + components/', { kind: 'plain', sub: 'page and part objects: where and how' });
  b += box(540, 208, 300, 62, 'api/', { kind: 'plain', sub: 'set-up through the services' });
  b += box(350, 210, 160, 58, 'data/', { kind: 'plain', sub: 'values and files', cls: 't-md' });
  b += arrow([[170, 270], [170, 304]]);
  b += arrow([[690, 270], [690, 304]]);
  b += box(20, 308, 300, 58, 'Web app', { kind: 'bank', sub: 'through a real browser' });
  b += box(540, 308, 300, 58, 'Services', { kind: 'bank', sub: 'HTTP, no browser' });
  return svg(W, H, 'Tests sit on top and only say what to check. Fixtures hand them page objects, component objects, an API client and ready-made customers. Page objects drive the web app through a browser; the API client sets up data in the services directly. Test data sits beside both.', b);
}

/** One test asks for customer; Playwright builds the fixtures it depends on first. */
export function fixtureChain() {
  const W = 860, H = 240;
  let b = '';
  b += box(20, 88, 170, 64, 'the test', { kind: 'plain', sub: 'asks for customer' });
  b += arrow([[190, 120], [246, 120]]);
  b += box(250, 88, 170, 64, 'customer', { kind: 'plain', sub: 'new, with a purchase' });
  b += arrow([[420, 110], [490, 62]]);
  b += arrow([[420, 130], [490, 178]]);
  b += box(494, 30, 160, 58, 'api', { kind: 'plain', cls: 't-md' });
  b += box(494, 150, 160, 58, 'loginPage', { kind: 'plain', cls: 't-md' });
  b += arrow([[654, 58], [700, 58]]);
  b += arrow([[654, 178], [700, 178]]);
  b += box(704, 30, 136, 58, 'request', { kind: 'plain', sub: 'built in', cls: 't-md' });
  b += box(704, 150, 136, 58, 'page', { kind: 'plain', sub: 'built in', cls: 't-md' });
  return svg(W, H, 'The test asks only for customer. customer needs api and loginPage; api needs the built-in request fixture, and loginPage needs the built-in page. Playwright builds them from the right-hand side first, and the test gets the same page that customer signed in.', b);
}
