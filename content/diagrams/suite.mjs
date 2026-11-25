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
