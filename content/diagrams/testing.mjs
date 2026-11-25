// Diagrams for Module 9: built for testing.
import { arrow, box, svg, text, esc } from '../../src/components.mjs';

const mono = (x, y, s, { size = 12.5, anchor = 'middle', ink = true } = {}) =>
  `<text class="t-mono" x="${x}" y="${y}" text-anchor="${anchor}" style="font-size:${size}px${ink ? ';fill:var(--ink)' : ''}">${esc(s)}</text>`;
const halo = (x, y, s, cls = 't-sm', anchor = 'middle') =>
  `<text class="${cls} t-halo" x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;

/** What a test can control, and where. */
export function controlMap() {
  let b = '';
  b += box(20, 140, 140, 60, 'your test', { kind: 'plain', sub: 'X-Test-Key' });
  // services
  b += `<rect class="box-bank" x="240" y="20" width="300" height="300" rx="14"/>`;
  b += text(390, 46, 'every service', 't-lg');
  const svc = [['/test/reset', 'empty its tables'], ['/test/seed', 'reset, then load the seed'], ['/test/faults', 'misbehave on purpose'], ['/test/clock', 'move the shared clock'], ['/test/quiet', 'anything still in flight?']];
  svc.forEach(([p, d], i) => {
    const y = 70 + i * 48;
    b += mono(262, y, p, { size: 12.5, anchor: 'start' });
    b += text(262, y + 18, d, 't-sm t-muted', 'start');
  });
  // mocks
  b += `<rect class="box-mock" x="620" y="20" width="260" height="160" rx="14"/>`;
  b += text(750, 46, 'each mock', 't-lg');
  b += mono(642, 80, '/test/behaviour', { size: 12.5, anchor: 'start' });
  b += text(642, 98, 'how it treats the bank', 't-sm t-muted', 'start');
  b += mono(642, 130, '/test/state', { size: 12.5, anchor: 'start' });
  b += text(642, 148, 'what it holds; change it', 't-sm t-muted', 'start');
  // helpers
  b += `<rect class="box-plain" x="620" y="200" width="260" height="120" rx="14"/>`;
  b += text(750, 226, 'helpers', 't-lg');
  b += mono(642, 258, 'POST /test/customers', { size: 12, anchor: 'start' });
  b += text(642, 276, 'a fresh customer with cards', 't-sm t-muted', 'start');
  b += mono(642, 302, 'GET /test/enrollments', { size: 12, anchor: 'start' });
  b += arrow([[160, 170], [240, 170]], 'ln', 'ah');
  b += arrow([[200, 170], [200, 360], [750, 360], [750, 320]], 'ln-faint', 'ah');
  b += arrow([[200, 170], [200, 6], [580, 6], [580, 100], [620, 100]], 'ln-faint', 'ah');
  return svg(900, 372, 'A test, using the X-Test-Key header, can call five controls on every service: reset, seed, faults, clock and quiet. Each mock adds behaviour controls and a state view it can change. Helpers create a fresh customer with cards and list enrolments.', b);
}

/** The CI run. */
export function ciFlow() {
  const steps = [
    ['checks', 'plain', 'lint, schemas, types'],
    ['build images', 'plain', 'cached per image'],
    ['start the stack', 'bank', 'memory limits'],
    ['seed', 'bank', ''],
    ['make smoke', 'event', 'end to end'],
    ['keep evidence', 'plain', 'usage, logs: always'],
    ['tear down', 'plain', 'always'],
  ];
  let b = '';
  steps.forEach(([s, k, sub], i) => {
    const x = 20 + i * 128;
    b += box(x, 40, 112, 60, s, { kind: k, cls: 't-sm' });
    if (sub) b += text(x + 56, 124, sub, 't-sm t-muted');
    if (i < steps.length - 1) b += arrow([[x + 112, 70], [x + 128, 70]], 'ln', 'ah');
  });
  b += text(20, 22, 'job 1', 't-sm t-muted', 'start');
  b += text(148, 22, 'job 2: stack-smoke (sized for 2 vCPU, 8 GB)', 't-sm t-muted', 'start');
  b += `<line class="ln-faint" x1="140" y1="14" x2="140" y2="134"/>`;
  return svg(920, 140, 'CI runs two jobs. The first lints the code, checks the event schemas are current and type-checks the web app. The second builds every image with a cache, starts the whole stack with memory limits, seeds it, runs the smoke test, then always records resource usage, keeps the logs and tears the stack down.', b);
}

/** Where a test idea is best checked. */
export function testLayers() {
  const layers = [
    ['Browser (Playwright)', 'pages, dialogs, frames, time zones, what the customer sees', 'plain'],
    ['Across services', 'events, callbacks, eventual consistency, reconciliation', 'event'],
    ['One service’s API (pytest)', 'rules, status codes, idempotency, money arithmetic', 'bank'],
    ['Contracts', 'OpenAPI and event schemas match what is sent', 'mock'],
  ];
  let b = '';
  layers.forEach(([t, d, k], i) => {
    const y = 20 + i * 64;
    const inset = (3 - i) * 0;
    b += `<rect class="box-${k}" x="${20 + inset}" y="${y}" width="${780 - 2 * inset}" height="52" rx="10"/>`;
    b += text(40, y + 22, t, 't-md', 'start');
    b += text(40, y + 41, d, 't-sm t-muted', 'start');
  });
  b += arrow([[820, 230], [820, 30]], 'ln-faint', 'ah');
  b += text(832, 120, 'slower,', 't-sm t-muted', 'start');
  b += text(832, 138, 'fewer tests', 't-sm t-muted', 'start');
  return svg(920, 276, 'Four places to check a test idea. Contracts at the bottom, then one service’s API, then flows across services, then the browser at the top. Higher layers are slower, so they get fewer tests.', b);
}
