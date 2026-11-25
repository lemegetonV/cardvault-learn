// Diagrams for the API test suite track.
import { arrow, box, svg, text, esc } from '../../src/components.mjs';

const mono = (x, y, s, { size = 12.5, anchor = 'middle', ink = true } = {}) =>
  `<text class="t-mono" x="${x}" y="${y}" text-anchor="${anchor}" style="font-size:${size}px${ink ? ';fill:var(--ink)' : ''}">${esc(s)}</text>`;

/** The suite outside the stack, and the four ways it looks in. */
export function outsideIn() {
  let b = '';
  b += box(20, 140, 180, 120, 'the suite', { kind: 'plain', sub: 'tests/api', cls: 't-lg' });
  b += `<rect class="box-plain" x="290" y="14" width="610" height="350" rx="16"/>`;
  b += text(880, 40, 'a running CardVault (local or stage)', 't-sm t-muted', 'end');
  const bank = ['auth', 'card', 'enrollment', 'wallet-txn', 'profile'];
  bank.forEach((n, i) => { b += box(312 + i * 116, 58, 104, 44, n, { kind: 'bank', cls: 't-md' }); });
  b += box(312, 150, 220, 44, 'network mock', { kind: 'mock', cls: 't-md' });
  b += box(546, 150, 220, 44, 'operator mock', { kind: 'mock', cls: 't-md' });
  b += box(312, 250, 330, 44, 'Kafka topics', { kind: 'event', cls: 't-md' });
  b += box(660, 250, 220, 44, 'Postgres', { kind: 'plain', cls: 't-md' });
  // the four ways in, each leaving the suite's right edge
  b += arrow([[200, 152], [262, 152], [262, 80], [312, 80]], 'ln', 'ah');
  b += text(270, 124, 'HTTP', 't-sm', 'start');
  b += arrow([[200, 172], [312, 172]], 'ln-mock', 'ah-mock');
  b += text(208, 190, 'controls', 't-sm t-muted', 'start');
  b += arrow([[200, 226], [280, 226], [280, 272], [312, 272]], 'ln-event', 'ah-event');
  b += text(208, 218, 'events', 't-sm t-muted', 'start');
  b += arrow([[200, 248], [240, 248], [240, 330], [770, 330], [770, 294]], 'ln-faint', 'ah');
  b += text(320, 350, 'read-only SQL, for what no API shows', 't-sm t-muted', 'start');
  return svg(920, 372, 'The suite sits outside a running CardVault. It talks to the five bank services over HTTP, controls the two mocks, reads Kafka topics, and reads Postgres with a read-only role only for facts no API shows.', b);
}

/** The layers of tools, from the language up to the tests. */
export function toolLayers() {
  const rows = [
    ['tests/<area>/test_*.py', 'what to check, one file per area of the spec', 'bank'],
    ['cardvault_tests', 'the suite’s own code: clients, models, checks, waits', 'plain'],
    ['pytest', 'finds tests, runs them, fixtures, markers, reports', 'mock'],
    ['httpx · pydantic · uv', 'HTTP calls · response shapes · installs everything', 'mock'],
    ['Python 3.12+', 'the language', 'plain'],
  ];
  let b = '';
  rows.forEach(([t, d, k], i) => {
    const y = 14 + i * 58;
    b += `<rect class="box-${k}" x="20" y="${y}" width="820" height="48" rx="10"/>`;
    b += mono(40, y + 30, t, { size: 14, anchor: 'start' });
    b += text(330, y + 30, d, 't-sm t-muted', 'start');
  });
  return svg(860, 14 + rows.length * 58, 'Five layers. At the bottom, Python. Above it, three libraries: httpx for HTTP, pydantic for response shapes, uv to install it all. Then pytest, which runs tests. Then cardvault_tests, the suite’s own code. At the top, the test files.', b);
}

/** Where a setting comes from, first match wins. */
export function settingsOrder() {
  const rows = [
    ['environment variable', 'TEST_KEY=… uv run pytest', 'wins over everything'],
    ['.env.stage', 'untracked, for secrets', ''],
    ['envs/stage.env', 'committed, no secrets', ''],
    ['default in settings.py', 'e.g. http_timeout_seconds = 10', 'used when nothing else says'],
  ];
  let b = '';
  rows.forEach(([t, s, n], i) => {
    const y = 16 + i * 66;
    b += box(80, y, 300, 50, t, { kind: i === 1 ? 'stop' : 'plain', cls: 't-md' });
    b += mono(400, y + 31, s, { size: 12.5, anchor: 'start', ink: false });
    if (n) b += text(840, y + 31, n, 't-sm t-muted', 'end');
    if (i < rows.length - 1) b += arrow([[230, y + 50], [230, y + 66]], 'ln-faint', 'ah');
  });
  b += text(40, 40, '1st', 't-sm t-muted', 'start');
  b += text(40, 238, 'last', 't-sm t-muted', 'start');
  return svg(860, 16 + rows.length * 66, 'A setting is looked up in four places, first match wins: an environment variable, then the untracked secrets file .env.stage, then the committed envs/stage.env, then the default in settings.py.', b);
}

/** One request through the client: auth, correlation ID, send, record. */
export function requestHooks() {
  const steps = [
    ['client.get("/v1/cards")', 'plain', 'the test asks'],
    ['auth adds credentials', 'plain', 'Authorization: Bearer …'],
    ['request hook', 'plain', 'X-Correlation-ID: t-…'],
    ['card service', 'bank', '200 + JSON'],
    ['response hook', 'plain', 'record the exchange'],
  ];
  let b = '';
  steps.forEach(([t, k, sub], i) => {
    const x = 16 + i * 178;
    b += box(x, 30, 160, 56, t, { kind: k, cls: i === 0 ? 't-mono' : 't-sm' });
    b += text(x + 80, 112, sub, 't-sm t-muted');
    if (i < steps.length - 1) b += arrow([[x + 160, 58], [x + 178, 58]], 'ln', 'ah');
  });
  return svg(906, 126, 'A request leaves the test, the auth object adds the credentials, the request hook adds a fresh correlation ID, the service answers, and the response hook records the exchange as evidence.', b);
}

/** What happens once per run, then per test. */
export function runOrder() {
  let b = '';
  b += `<rect class="box-plain" x="20" y="14" width="430" height="176" rx="14"/>`;
  b += text(40, 42, 'once per run (pytest_sessionstart)', 't-md', 'start');
  const once = ['wait for every /ready', 'reset every service and mock', 'clear the clock offset', 'load the seed data'];
  once.forEach((s, i) => {
    const y = 74 + i * 30;
    b += `<circle class="dot" cx="50" cy="${y - 4}" r="9"/><text class="t-mono" x="50" y="${y}" text-anchor="middle" style="fill:var(--surface);font-size:11px">${i + 1}</text>`;
    b += text(70, y, s, 't-sm', 'start');
  });
  b += arrow([[450, 102], [510, 102]], 'ln', 'ah');
  b += `<rect class="box-bank" x="510" y="14" width="390" height="176" rx="14"/>`;
  b += text(530, 42, 'then, for every test', 't-md', 'start');
  const each = ['set up what it asks for (fixtures)', 'act: send the request', 'check the answer', 'tidy up, pass or fail'];
  each.forEach((s, i) => {
    const y = 74 + i * 30;
    b += `<circle class="dot" cx="540" cy="${y - 4}" r="9"/><text class="t-mono" x="540" y="${y}" text-anchor="middle" style="fill:var(--surface);font-size:11px">${i + 1}</text>`;
    b += text(560, y, s, 't-sm', 'start');
  });
  return svg(920, 204, 'Once per run, before any test: wait for every service to be ready, reset everything, clear the clock offset and load the seed data. Then every test sets up what it needs, acts, checks and tidies up.', b);
}

/** Fixture dependencies (not an order of execution). */
export function fixtureGraph() {
  const node = (x, y, w, label, kind, sub) => box(x, y, w, 46, label, { kind, sub, cls: 't-mono' });
  let b = '';
  b += node(20, 20, 150, 'settings', 'plain', 'session');
  b += node(230, 20, 150, 'services', 'plain', 'session');
  b += node(230, 110, 150, 'controls', 'plain', 'session');
  b += node(440, 110, 170, 'orchestrator', 'plain', 'session');
  b += node(440, 20, 170, 'alice', 'plain', 'session');
  b += node(680, 66, 190, 'make_customer', 'plain', 'function');
  b += node(680, 160, 190, 'shared_clock', 'plain', 'function');
  const a = (p) => { b += arrow(p, 'ln-faint', 'ah'); };
  a([[170, 43], [230, 43]]);
  a([[95, 66], [95, 133], [230, 133]]);
  a([[380, 43], [440, 43]]);
  a([[380, 133], [440, 133]]);
  a([[610, 133], [660, 133], [660, 100], [680, 100]]);
  a([[420, 43], [420, 88], [650, 88], [650, 78], [680, 78]]);
  a([[380, 150], [400, 150], [400, 183], [680, 183]]);
  b += text(20, 230, 'An arrow means “is given to”. pytest works out the order from these needs.', 't-sm t-muted', 'start');
  return svg(890, 242, 'Fixtures and what each one is given. settings feeds services and controls. services feeds alice and make_customer. controls feeds orchestrator, which feeds make_customer, and controls also feeds shared_clock. alice and the clients are created once per run; make_customer and shared_clock once per test.', b);
}

/** Two tests on one shared customer collide; two fresh customers cannot. */
export function sharedVsFresh() {
  let b = '';
  // left: shared
  b += text(20, 26, 'one shared customer', 't-md', 'start');
  b += box(20, 44, 190, 46, 'test A', { kind: 'plain', sub: 'reports the card lost', cls: 't-md' });
  b += box(20, 140, 190, 46, 'test B', { kind: 'plain', sub: 'expects it ACTIVE', cls: 't-md' });
  b += box(270, 92, 150, 46, 'alice’s card', { kind: 'stop', cls: 't-md' });
  b += arrow([[210, 67], [240, 67], [240, 106], [270, 106]], 'ln', 'ah');
  b += arrow([[210, 163], [240, 163], [240, 124], [270, 124]], 'ln', 'ah');
  b += text(345, 166, 'B passes or fails', 't-sm t-stop');
  b += text(345, 182, 'depending on timing', 't-sm t-stop');
  // right: fresh
  b += `<line x1="460" y1="14" x2="460" y2="196" class="life"/>`;
  b += text(500, 26, 'a fresh customer each', 't-md', 'start');
  b += box(500, 44, 190, 46, 'test A', { kind: 'plain', sub: 'reports the card lost', cls: 't-md' });
  b += box(500, 140, 190, 46, 'test B', { kind: 'plain', sub: 'expects it ACTIVE', cls: 't-md' });
  b += box(740, 44, 150, 46, 'cust-3f…’s card', { kind: 'bank', cls: 't-md' });
  b += box(740, 140, 150, 46, 'cust-9a…’s card', { kind: 'bank', cls: 't-md' });
  b += arrow([[690, 67], [740, 67]], 'ln', 'ah');
  b += arrow([[690, 163], [740, 163]], 'ln', 'ah');
  return svg(910, 204, 'Left: two tests act on the same seed card, so one test’s change decides whether the other passes. Right: each test has its own fresh customer and card, so neither can see the other’s change.', b);
}

/** What POST /test/customers does across the services. */
export function customerFanOut() {
  let b = '';
  b += box(20, 120, 170, 56, 'make_customer', { kind: 'plain', sub: 'a template', cls: 't-mono' });
  b += box(260, 120, 190, 56, 'enrollment', { kind: 'bank', sub: 'POST /test/customers', cls: 't-md' });
  b += arrow([[190, 148], [260, 148]], 'ln', 'ah');
  const targets = [
    ['auth', 'a login', 'bank', 14],
    ['profile', 'email and phone', 'bank', 78],
    ['card', 'the cards', 'bank', 142],
    ['network mock', 'a token (if enrolled)', 'mock', 206],
    ['operator mock', 'a record (if enrolled)', 'mock', 270],
  ];
  for (const [n, what, k, y] of [...targets].reverse()) {
    b += box(560, y, 150, 44, n, { kind: k, cls: 't-md' });
    b += text(726, y + 27, what, 't-sm t-muted', 'start');
    if (k === 'mock') b += arrow([[510, 148], [510, y + 22], [560, y + 22]], 'ln-mock', 'ah-mock');
    else b += arrow([[450, 148], [510, 148], [510, y + 22], [560, y + 22]], 'ln-faint', 'ah');
  }
  b += text(105, 210, 'gets back: username,', 't-sm t-muted');
  b += text(105, 226, 'password, card IDs', 't-sm t-muted');
  return svg(900, 330, 'make_customer sends one template to the enrollment service’s POST /test/customers. It creates a login in auth, a profile, the cards in the card service and, for cards marked enrolled, a token at the network mock and a record at the operator mock. The test gets back a username, a password and the card IDs.', b);
}

/** A parallel run, then the serial tests on their own. */
export function runPhases() {
  let b = '';
  b += `<rect class="box-plain" x="20" y="14" width="560" height="256" rx="14"/>`;
  b += mono(40, 42, 'pytest -n auto', { size: 14, anchor: 'start' });
  b += text(560, 42, '380 tests', 't-sm t-muted', 'end');
  b += box(40, 106, 130, 56, 'controller', { kind: 'plain', sub: 'resets, then deals', cls: 't-md' });
  ['worker 1', 'worker 2', 'worker 3', 'worker 4'].forEach((w, i) => {
    const y = 62 + i * 46;
    b += box(250, y, 120, 36, w, { kind: 'plain', cls: 't-sm' });
    b += arrow([[170, 134], [210, 134], [210, y + 18], [250, y + 18]], 'ln-faint', 'ah');
    for (let k = 0; k < 6; k++) b += `<rect class="box-bank" x="${386 + k * 30}" y="${y + 8}" width="22" height="20" rx="4"/>`;
  });
  b += text(40, 258, 'each worker takes the next test as it frees up', 't-sm t-muted', 'start');
  b += arrow([[580, 132], [630, 132]], 'ln', 'ah');
  b += text(605, 120, 'then', 't-sm t-muted');
  b += `<rect class="box-plain" x="630" y="14" width="270" height="256" rx="14"/>`;
  b += mono(650, 42, 'pytest -m serial', { size: 14, anchor: 'start' });
  b += text(880, 42, '17 tests', 't-sm t-muted', 'end');
  b += box(650, 116, 120, 36, 'one process', { kind: 'plain', cls: 't-sm' });
  for (let k = 0; k < 3; k++) b += `<rect class="box-stop" x="${786 + k * 30}" y="124" width="22" height="20" rx="4"/>`;
  b += text(650, 258, 'clock and fault tests, one by one', 't-sm t-muted', 'start');
  return svg(920, 284, 'First run: pytest -n auto. A controller resets the system, then deals 380 tests to four workers, each taking the next test as it finishes one. Second run: pytest -m serial runs the 17 tests that move shared switches, one at a time in a single process.', b);
}

/** After the clock moves, each service sees it within about a second. */
export function clockLag() {
  const x0 = 200, px = 560; // 0 s at x0, 1 s at x0 + px
  let b = '';
  b += `<line class="ln-faint" x1="${x0}" y1="224" x2="${x0 + px + 40}" y2="224"/>`;
  [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
    const x = x0 + t * px;
    b += `<line class="ln-faint" x1="${x}" y1="220" x2="${x}" y2="228"/>`;
    b += text(x, 246, `${t} s`, 't-sm t-muted');
  });
  const rows = [
    ['auth', 0, 'the service the test asked: at once'],
    ['card', 0.3, ''],
    ['profile', 0.55, ''],
    ['enrollment', 0.8, ''],
  ];
  rows.forEach(([n, t, note], i) => {
    const y = 20 + i * 48;
    const x = x0 + t * px;
    b += box(20, y, 150, 34, n, { kind: 'bank', cls: 't-sm' });
    if (t > 0) b += `<rect class="box-plain" x="${x0}" y="${y + 8}" width="${t * px}" height="18" rx="4"/>`;
    b += `<rect class="box-event" x="${x}" y="${y + 8}" width="${x0 + px + 40 - x}" height="18" rx="4"/>`;
    if (note) b += text(x + 10, y + 22, note, 't-sm', 'start');
  });
  b += text(x0 + 4, 268, 'grey: still the old time  ·  gold: the new time', 't-sm t-muted', 'start');
  return svg(820, 280, 'The test moves the clock through auth, which sees the new time at once. The other services re-read the clock in the background and each switches to the new time at a different moment, all within about one second.', b);
}

/** Sleeping for a guess versus polling with a deadline. */
export function sleepVsPoll() {
  const x0 = 180, px = 130; // seconds to pixels
  const X = (t) => x0 + t * px;
  let b = '';
  b += `<line class="ln-faint" x1="${X(0)}" y1="232" x2="${X(5)}" y2="232"/>`;
  for (let t = 0; t <= 5; t++) { b += text(X(t), 252, `${t} s`, 't-sm t-muted'); }
  const row = (y, label, sub) => { b += text(20, y + 16, label, 't-md', 'start'); b += text(20, y + 34, sub, 't-sm t-muted', 'start'); };
  // 1: sleep, fast day
  row(14, 'sleep(3)', 'a fast day');
  b += `<rect class="box-plain" x="${X(0)}" y="22" width="${3 * px}" height="22" rx="4"/>`;
  b += `<circle class="dot-event" cx="${X(1)}" cy="33" r="6"/>`;
  b += text(X(1), 62, 'done at 1 s', 't-sm t-muted');
  b += text(X(3) + 10, 38, 'checks at 3 s: 2 s wasted', 't-sm', 'start');
  // 2: sleep, slow day
  row(84, 'sleep(3)', 'a slow day');
  b += `<rect class="box-plain" x="${X(0)}" y="92" width="${3 * px}" height="22" rx="4"/>`;
  b += `<rect class="box-stop" x="${X(3)}" y="92" width="10" height="22" rx="3"/>`;
  b += `<circle class="dot-event" cx="${X(3.6)}" cy="103" r="6"/>`;
  b += text(X(3.6) + 6, 132, 'done at 3.6 s', 't-sm t-muted', 'start');
  b += text(X(3) - 4, 132, 'checks at 3 s: fails', 't-sm t-stop', 'end');
  // 3: poll
  row(154, 'wait_until', 'asks every 0.25 s');
  for (let t = 0; t <= 1.0001; t += 0.25) b += `<circle class="dot" cx="${X(t)}" cy="173" r="3.5"/>`;
  b += `<circle class="dot-event" cx="${X(1)}" cy="173" r="6"/>`;
  b += text(X(1) + 14, 178, 'sees it done at 1 s and carries on', 't-sm', 'start');
  b += text(X(1), 202, 'on a slow day it keeps asking, up to its timeout', 't-sm t-muted', 'start');
  return svg(860, 262, 'A fixed three-second sleep wastes two seconds when the work finishes in one, and fails when the work takes 3.6 seconds. Polling every quarter second notices the work finished at one second and continues at once; on a slow day it keeps asking until its timeout.', b);
}

/** One parametrized function, one test per row. */
export function paramRows() {
  const rows = [
    ['lost', 'LOST card', 'CARD_LOST'],
    ['closed', 'CLOSED card', 'CARD_CLOSED'],
    ['expired', 'expiry 2020-01', 'CARD_EXPIRED'],
    ['over-available', '500.01 on 500.00', 'INSUFFICIENT_FUNDS'],
  ];
  let b = '';
  b += text(20, 24, 'a table of cases', 't-md', 'start');
  rows.forEach(([id, cond, code], i) => {
    const y = 38 + i * 44;
    b += `<rect class="box-plain" x="20" y="${y}" width="290" height="34" rx="6"/>`;
    b += text(32, y + 22, cond, 't-sm', 'start');
    b += mono(298, y + 22, code, { size: 11, anchor: 'end', ink: false });
  });
  b += box(360, 92, 180, 64, 'one test function', { kind: 'plain', sub: '@parametrize', cls: 't-md' });
  b += arrow([[310, 124], [360, 124]], 'ln', 'ah');
  b += text(600, 24, 'what pytest runs and reports', 't-md', 'start');
  rows.forEach(([id], i) => {
    const y = 38 + i * 44;
    b += `<rect class="box-bank" x="600" y="${y}" width="350" height="34" rx="6"/>`;
    b += mono(614, y + 22, `test_card_purchase_is_declined[${id}]`, { size: 11.5, anchor: 'start' });
    b += arrow([[540, 124], [570, 124], [570, y + 17], [600, y + 17]], 'ln-faint', 'ah');
  });
  return svg(970, 220, 'A table of four cases feeds one test function marked with parametrize. pytest runs it once per row and reports each run by name, such as test_card_purchase_is_declined[lost].', b);
}

/** A purchase's money, worked by hand, step by step. */
export function moneySteps() {
  const steps = [
    ['approve 10.00', [['hold', 10]], 'limit − 10.00'],
    ['reverse 3.00', [['hold', 7], ['back', 3]], 'limit − 7.00'],
    ['settle 7.00', [['spent', 7], ['back', 3]], 'limit − 7.00'],
    ['refund 2.00', [['spent', 5], ['back', 5]], 'limit − 5.00'],
  ];
  const cls = { hold: 'bar-hold', spent: 'bar-spent', back: 'bar-avail' };
  const px = 34; // per 1.00
  let b = '';
  steps.forEach(([label, segs, avail], i) => {
    const y = 20 + i * 52;
    b += text(20, y + 21, label, 't-md', 'start');
    let x = 170;
    b += `<rect class="bar-bg" x="170" y="${y + 4}" width="${10 * px}" height="26" rx="4"/>`;
    for (const [k, v] of segs) {
      b += `<rect class="${cls[k]}" x="${x}" y="${y + 4}" width="${v * px}" height="26" rx="3"/>`;
      x += v * px;
    }
    b += text(170 + 10 * px + 24, y + 22, 'available =', 't-sm t-muted', 'start');
    b += mono(170 + 10 * px + 104, y + 22, avail, { size: 13, anchor: 'start' });
  });
  const ly = 20 + steps.length * 52 + 14;
  const key = [['bar-hold', 'held'], ['bar-spent', 'charged'], ['bar-avail', 'given back']];
  key.forEach(([c, t], i) => {
    const x = 170 + i * 130;
    b += `<rect class="${c}" x="${x}" y="${ly - 11}" width="16" height="14" rx="3"/>`;
    b += text(x + 24, ly, t, 't-sm t-muted', 'start');
  });
  return svg(760, ly + 14, 'One 10.00 purchase, step by step. Approved: 10.00 held. Reverse 3.00: 7.00 held, 3.00 given back. Settle 7.00: 7.00 charged. Refund 2.00: 5.00 charged, 5.00 given back. Available is the limit minus what is held and charged.', b);
}

/** Twenty purchases at once against room for ten. */
export function raceResult() {
  let b = '';
  b += text(20, 24, '20 × 10.00 at the same moment', 't-md', 'start');
  for (let i = 0; i < 20; i++) {
    const y = 40 + (i % 10) * 18, x = 20 + Math.floor(i / 10) * 60;
    b += `<rect class="box-plain" x="${x}" y="${y}" width="48" height="12" rx="3"/>`;
  }
  b += arrow([[140, 130], [210, 130]], 'ln', 'ah');
  b += box(210, 92, 200, 76, 'one card', { kind: 'bank', sub: 'available 100.00', cls: 't-md' });
  b += arrow([[410, 112], [480, 82]], 'ln', 'ah');
  b += arrow([[410, 148], [480, 178]], 'ln', 'ah');
  b += box(480, 56, 210, 46, '10 approved', { kind: 'bank', cls: 't-md' });
  b += box(480, 158, 210, 46, '10 declined', { kind: 'stop', sub: 'INSUFFICIENT_FUNDS', cls: 't-md' });
  b += text(720, 84, 'then: available is exactly 0', 't-sm', 'start');
  b += text(720, 186, 'a broken lock shows as', 't-sm t-muted', 'start');
  b += text(720, 202, 'more than 10 approved', 't-sm t-muted', 'start');
  return svg(900, 230, 'Twenty purchases of 10.00 arrive at the same moment at a card with 100.00 available. Exactly ten must be approved and ten declined with INSUFFICIENT_FUNDS, leaving exactly 0 available. More than ten approvals would mean two requests read the same balance.', b);
}

/** Days since last use: where the 90-day rule changes its answer, and where tests stand. */
export function usageBoundary() {
  const x0 = 60, px = 5.2; // per day
  const X = (d) => x0 + d * px;
  let b = '';
  b += `<rect class="box-bank" x="${X(0)}" y="40" width="${90 * px}" height="26" rx="4"/>`;
  b += `<rect class="box-stop" x="${X(90)}" y="40" width="${40 * px}" height="26" rx="4"/>`;
  b += text(X(45), 58, 'eligible', 't-sm');
  b += text(X(110), 58, 'NOT_RECENTLY_USED', 't-sm t-stop');
  b += `<line class="ln" x1="${X(90)}" y1="28" x2="${X(90)}" y2="78"/>`;
  b += text(X(90), 22, 'edge: last use + 90 days', 't-sm');
  const points = [[5, 'default card', 'row'], [89, '1 min before', 'clock'], [91, '1 min after', 'clock'], [91, 'used 91 days ago', 'row']];
  b += `<line class="ln-faint" x1="${X(0)}" y1="96" x2="${X(130)}" y2="96"/>`;
  [0, 30, 60, 120].forEach((d) => { b += text(X(d), 114, `${d}`, 't-sm t-muted'); });
  b += text(X(130) + 8, 114, 'days', 't-sm t-muted', 'start');
  // test points
  const tp = (d, y, label, cls, anchor = 'middle', dx = 0) => {
    b += `<circle class="${cls}" cx="${X(d)}" cy="96" r="5"/>`;
    b += `<line class="ln-faint" x1="${X(d)}" y1="101" x2="${X(d)}" y2="${y - 12}"/>`;
    b += text(X(d) + dx, y, label, 't-sm', anchor);
  };
  tp(5, 150, 'used 5 days ago', 'dot');
  tp(89.4, 150, 'edge − 1 min', 'dot', 'end', -4);
  tp(90.6, 150, 'edge + 1 min', 'dot-stop', 'start', 4);
  tp(120, 150, 'used 91+ days ago', 'dot-stop');
  b += `<rect class="box-stop" x="${X(132)}" y="40" width="96" height="26" rx="4"/>`;
  b += text(X(132) + 48, 58, 'never used', 't-sm t-stop');
  return svg(860, 166, 'A line of days since the card was last used. Up to 90 days the card is eligible; past 90 days, or never used, it is not recently used. Tests stand on ordinary values (5 days, 91 or more) and a minute either side of the 90-day edge.', b);
}

/** Two ways to test the callback flow. */
export function callbackTwoWays() {
  let b = '';
  b += text(20, 26, 'the whole flow', 't-md', 'start');
  b += box(20, 40, 150, 44, 'test adds a card', { kind: 'plain', cls: 't-sm' });
  b += box(230, 40, 150, 44, 'enrollment', { kind: 'bank', cls: 't-md' });
  b += box(440, 40, 150, 44, 'operator mock', { kind: 'mock', cls: 't-md' });
  b += arrow([[170, 62], [230, 62]], 'ln', 'ah');
  b += arrow([[380, 54], [440, 54]], 'ln', 'ah');
  b += arrow([[440, 72], [380, 72]], 'ln-mock', 'ah-mock');
  b += text(410, 98, 'callback, ~2 s later', 't-sm t-muted');
  b += text(620, 58, 'real, but the test cannot', 't-sm', 'start');
  b += text(620, 74, 'choose what the operator says', 't-sm', 'start');
  b += `<line x1="20" y1="118" x2="880" y2="118" class="life"/>`;
  b += text(20, 148, 'straight to the callback', 't-md', 'start');
  b += box(20, 162, 150, 44, 'test signs a callback', { kind: 'plain', cls: 't-sm' });
  b += box(230, 162, 150, 44, 'enrollment', { kind: 'bank', cls: 't-md' });
  b += arrow([[170, 184], [230, 184]], 'ln', 'ah');
  b += text(200, 224, 'HMAC + timestamp', 't-sm t-muted');
  b += text(620, 180, 'any status, version, signature', 't-sm', 'start');
  b += text(620, 196, 'or timestamp the test wants', 't-sm', 'start');
  return svg(900, 236, 'Top: the whole flow, where the test adds a card and the operator mock calls back about two seconds later. Bottom: the test signs a callback itself and sends it straight to the enrollment service, choosing every field.', b);
}

/** A misbehaving operator, set up by the test. */
export function operatorControlFlow() {
  let b = '';
  const steps = [
    ['1', 'test sets the operator’s behaviour', 'decline · errors · repeat or reorder callbacks'],
    ['2', 'customer adds a card', 'as in any other test'],
    ['3', 'bank calls the operator', 'and meets the misbehaviour'],
    ['4', 'test waits for the bank’s outcome', 'FAILED, retried and ENROLLED, applied once…'],
    ['5', 'fixture turns behaviour off', 'pass or fail'],
  ];
  steps.forEach(([n, t, sub], i) => {
    const y = 16 + i * 52;
    const kind = i === 2 ? 'mock' : i === 3 ? 'bank' : 'plain';
    b += `<rect class="box-${kind}" x="20" y="${y}" width="420" height="42" rx="8"/>`;
    b += `<circle class="dot" cx="44" cy="${y + 21}" r="10"/><text class="t-mono" x="44" y="${y + 25}" text-anchor="middle" style="fill:var(--surface);font-size:11px">${n}</text>`;
    b += text(66, y + 26, t, 't-md', 'start');
    b += text(460, y + 26, sub, 't-sm t-muted', 'start');
  });
  return svg(860, 16 + steps.length * 52, 'A test of a misbehaving operator in five steps: the test sets the operator mock’s behaviour, a customer adds a card, the bank calls the operator and meets the misbehaviour, the test waits for the bank’s outcome, and the fixture turns the behaviour off whether the test passed or failed.', b);
}

/** Bank records against the operator's file, and the finding each difference gives. */
export function reconFindings() {
  const rows = [
    ['ENROLLED', '(no record)', 'MISSING_AT_OPERATOR'],
    ['(no record)', 'ENROLLED', 'MISSING_IN_SOR'],
    ['ENROLLED', 'SUSPENDED', 'STATUS_MISMATCH'],
    ['ENROLLED · 4417', 'ENROLLED · 9999', 'DATA_MISMATCH'],
    ['ENROLLED', 'ENROLLED', 'no finding'],
  ];
  let b = '';
  b += text(110, 24, 'the bank (SOR)', 't-md');
  b += text(370, 24, 'the operator’s file', 't-md');
  b += text(680, 24, 'finding', 't-md');
  rows.forEach(([sor, op, f], i) => {
    const y = 40 + i * 50;
    const none = (s) => s.startsWith('(');
    b += box(20, y, 180, 38, sor, { kind: none(sor) ? 'plain' : 'bank', cls: 't-sm' });
    b += box(280, y, 180, 38, op, { kind: none(op) ? 'plain' : 'mock', cls: 't-sm' });
    b += `<line class="ln-faint" x1="200" y1="${y + 19}" x2="280" y2="${y + 19}"/>`;
    b += arrow([[460, y + 19], [540, y + 19]], 'ln-faint', 'ah');
    b += box(540, y, 280, 38, f, { kind: i === 4 ? 'plain' : 'stop', cls: 't-mono' });
  });
  return svg(840, 40 + rows.length * 50, 'Each row compares one enrolment. Bank has it, operator does not: MISSING_AT_OPERATOR. Operator has it, bank does not: MISSING_IN_SOR. Different statuses: STATUS_MISMATCH. Same status, different last4: DATA_MISMATCH. Both the same: no finding.', b);
}

/** An event watch starts at the end of each partition, before the test acts. */
export function eventWatch() {
  let b = '';
  const rows = [['partition 0', 7, null], ['partition 1', 5, 6], ['partition 2', 9, null]];
  rows.forEach(([name, old, mine], r) => {
    const y = 40 + r * 52;
    b += text(20, y + 22, name, 't-sm t-muted', 'start');
    for (let i = 0; i < old; i++) b += `<rect class="box-plain" x="${120 + i * 40}" y="${y + 4}" width="32" height="26" rx="4"/>`;
    const sx = 120 + old * 40;
    b += `<line class="ln" x1="${sx - 4}" y1="${y - 2}" x2="${sx - 4}" y2="${y + 36}"/>`;
    if (mine !== null) {
      b += `<rect class="box-plain" x="${sx}" y="${y + 4}" width="32" height="26" rx="4"/>`;
      b += `<rect class="box-event" x="${sx + 40}" y="${y + 4}" width="32" height="26" rx="4"/>`;
      b += text(sx + 84, y + 22, 'the test’s own event', 't-sm', 'start');
    }
  });
  b += text(120, 24, 'grey boxes before each line: already there, never read', 't-sm t-muted', 'start');
  b += text(120, 210, 'each line: where the watch starts, before the test acts', 't-sm', 'start');
  return svg(760, 222, 'Three partitions of a topic. Old events sit before a line where the watch starts, set before the test acts. After the line, other tests’ events and the test’s own event arrive; the watch picks out the one that matches.', b);
}

/** Three kinds of messy delivery and the expected outcome. */
export function messyDelivery() {
  const rows = [
    ['the same event twice', [['event', 'E1'], ['event', 'E1']], 'applied once', 'bank'],
    ['cleared before decided', [['event', 'cleared'], ['event', 'decided']], 'same end state: SETTLED', 'bank'],
    ['a message nobody can read', [['stop', '{"this is…'], ['event', 'next']], 'retried, parked on the DLQ, next one applied', 'stop'],
  ];
  let b = '';
  rows.forEach(([label, msgs, out, k], i) => {
    const y = 16 + i * 64;
    b += text(20, y + 28, label, 't-md', 'start');
    msgs.forEach(([kind, t], j) => { b += box(250 + j * 120, y + 6, 108, 36, t, { kind, cls: 't-sm' }); });
    b += arrow([[490, y + 24], [530, y + 24]], 'ln', 'ah');
    b += box(530, y + 6, 330, 36, out, { kind: k, cls: 't-sm' });
  });
  return svg(880, 16 + rows.length * 64, 'Three kinds of messy delivery. The same event twice must be applied once. A clearing that arrives before its authorization must end in the same state as the usual order. A message nobody can read is retried, parked on the dead-letter topic, and the next message is still applied.', b);
}

/** Writes go through the services; the suite only reads the databases. */
export function readOnlyDb() {
  let b = '';
  b += box(20, 70, 160, 60, 'the suite', { kind: 'plain', cls: 't-lg' });
  b += box(300, 20, 200, 50, 'services', { kind: 'bank', sub: 'the only writers', cls: 't-md' });
  b += box(300, 130, 200, 50, 'databases', { kind: 'plain', sub: 'card · wallet_txn · …', cls: 't-md' });
  b += arrow([[180, 86], [300, 46]], 'ln', 'ah');
  b += text(150, 40, 'API calls change state', 't-sm', 'start');
  b += arrow([[400, 70], [400, 130]], 'ln', 'ah');
  b += arrow([[180, 116], [300, 156]], 'ln-faint', 'ah');
  b += text(222, 160, '<db>_ro: SELECT only', 't-sm t-muted', 'middle');
  b += box(560, 130, 180, 50, 'UPDATE …', { kind: 'stop', sub: 'InsufficientPrivilege', cls: 't-mono' });
  b += `<line class="ln-stop" x1="500" y1="155" x2="560" y2="155"/>`;
  return svg(760, 196, 'The suite changes state only through the services’ APIs; the services are the only writers to their databases. The suite reads the databases with a read-only role, and any attempt to write is refused with InsufficientPrivilege.', b);
}

/** Three doors, three proofs: only the matching pair opens. */
export function doorsAndProofs() {
  const doors = [['customer', '/v1/…'], ['internal', '/internal/v1/…'], ['test', '/test/…']];
  const proofs = ['Bearer token', 'X-Service-Key', 'X-Test-Key'];
  let b = '';
  b += text(20, 30, 'proof sent →', 't-sm t-muted', 'start');
  proofs.forEach((p, j) => { b += text(300 + j * 170, 30, p, 't-md'); });
  doors.forEach(([d, path], i) => {
    const y = 50 + i * 56;
    b += text(20, y + 22, `${d} endpoints`, 't-md', 'start');
    b += mono(20, y + 40, path, { size: 11.5, anchor: 'start', ink: false });
    proofs.forEach((_, j) => {
      const ok = i === j;
      b += box(230 + j * 170, y, 140, 44, ok ? 'opens' : '401', { kind: ok ? 'bank' : 'stop', cls: 't-sm' });
    });
  });
  return svg(760, 50 + 3 * 56 + 6, 'A grid of three kinds of endpoint against three kinds of proof. Customer endpoints open only for a bearer token, internal endpoints only for a service key, test endpoints only for the test key. Every other pair is refused with 401.', b);
}

/** One journey across the services. */
export function journeySteps() {
  const steps = [
    ['add the card', 'enrollment · operator mock'],
    ['pay with the token', 'card'],
    ['merchant settles less', 'card → wallet-txn'],
    ['dispute the charge', 'wallet-txn'],
  ];
  let b = '';
  steps.forEach(([t, s], i) => {
    const x = 20 + i * 215;
    b += `<rect class="box-bank" x="${x}" y="20" width="190" height="58" rx="10"/>`;
    b += `<circle class="dot" cx="${x + 20}" cy="40" r="10"/><text class="t-mono" x="${x + 20}" y="44" text-anchor="middle" style="fill:var(--surface);font-size:11px">${i + 1}</text>`;
    b += text(x + 38, 45, t, 't-sm', 'start');
    b += text(x + 95, 100, s, 't-sm t-muted');
    if (i < steps.length - 1) b += arrow([[x + 190, 49], [x + 215, 49]], 'ln', 'ah');
  });
  b += text(20, 136, 'Each step starts from the state the one before it left behind.', 't-sm t-muted', 'start');
  return svg(880, 148, 'A journey in four steps: add the card to the wallet, pay with its token, the merchant settles for less, and the customer disputes the charge. Each step uses the state left by the one before.', b);
}

/** From a failed test to the service's own log line, by correlation ID. */
export function evidenceTrail() {
  const steps = [
    ['a test fails', 'the assertion message', 'stop'],
    ['CardVault requests', 'every call, with its ID', 'plain'],
    ['one correlation ID', 't-728df5802f1a', 'plain'],
    ['the service’s logs', 'what it did, and why', 'bank'],
  ];
  let b = '';
  steps.forEach(([t, s, k], i) => {
    const x = 20 + i * 215;
    b += box(x, 24, 185, 60, t, { kind: k, sub: s, cls: 't-md' });
    if (i < steps.length - 1) b += arrow([[x + 185, 54], [x + 215, 54]], 'ln', 'ah');
  });
  b += text(20, 116, 'The same requests are attached to the test in the Allure report, with keys and passwords masked.', 't-sm t-muted', 'start');
  return svg(880, 128, 'A test fails. Under it, the CardVault requests section lists every call it made, each with a correlation ID. Searching the services’ logs for that ID shows what the service did. The same requests are attached to the Allure report with secrets masked.', b);
}

/** The api-tests workflow, in order. */
export function ciPipeline() {
  let b = '';
  b += text(20, 26, 'job: lint', 't-md', 'start');
  b += box(20, 40, 180, 40, 'ruff check', { kind: 'plain', cls: 't-sm' });
  b += box(220, 40, 180, 40, 'ruff format --check', { kind: 'plain', cls: 't-sm' });
  b += arrow([[200, 60], [220, 60]], 'ln', 'ah');
  b += text(20, 118, 'job: api-tests', 't-md', 'start');
  const steps = [
    ['start the stack', 'bank'], ['uv sync', 'plain'], ['pytest -n auto', 'plain'], ['pytest -m serial', 'plain'],
  ];
  steps.forEach(([t, k], i) => {
    const x = 20 + i * 210;
    b += box(x, 132, 180, 40, t, { kind: k, cls: 't-sm' });
    if (i < steps.length - 1) b += arrow([[x + 180, 152], [x + 210, 152]], 'ln', 'ah');
  });
  const always = ['Allure report', 'compose logs', 'upload evidence', 'tear down'];
  b += text(124, 214, 'always, pass or fail', 't-sm t-muted', 'start');
  always.forEach((t, i) => {
    const x = 20 + i * 210;
    b += box(x, 222, 180, 40, t, { kind: 'mock', cls: 't-sm' });
    if (i < always.length - 1) b += arrow([[x + 180, 242], [x + 210, 242]], 'ln-mock', 'ah-mock');
  });
  b += arrow([[740, 172], [740, 196], [110, 196], [110, 222]], 'ln-faint', 'ah');
  return svg(880, 278, 'Two jobs run side by side. lint runs ruff check and ruff format --check. api-tests starts the stack, installs the suite, runs pytest -n auto, then pytest -m serial. After that, whether the tests passed or failed, it builds the Allure report, collects the container logs, uploads the evidence and tears the stack down.', b);
}

/** One suite, two targets, and how to read a red on stage. */
export function stageReading() {
  let b = '';
  b += box(20, 70, 160, 60, 'the suite', { kind: 'plain', sub: 'same tests', cls: 't-lg' });
  b += box(280, 20, 220, 56, 'local / CI', { kind: 'bank', sub: 'no known defects: all green', cls: 't-md' });
  b += box(280, 124, 220, 56, 'stage', { kind: 'stop', sub: 'known defects on: some red', cls: 't-md' });
  b += arrow([[180, 92], [280, 48]], 'ln', 'ah');
  b += arrow([[180, 108], [280, 152]], 'ln', 'ah');
  b += text(580, 40, 'a red test on stage:', 't-md', 'start');
  b += text(580, 70, '· green locally too → likely a stage defect', 't-sm', 'start');
  b += text(580, 94, '· red locally too → the test or the code', 't-sm', 'start');
  b += text(580, 118, '· timeouts only → load or the tunnel', 't-sm', 'start');
  b += text(580, 142, '· then read the evidence to confirm', 't-sm t-muted', 'start');
  return svg(900, 196, 'The same suite runs against local or CI, where everything should be green, and against stage, where known defects are switched on and some tests go red. A red on stage that is green locally most likely shows a stage defect; red in both places points at the test or the code; timeouts alone suggest load or the tunnel. The evidence confirms which.', b);
}
