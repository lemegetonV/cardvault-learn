// Diagrams for Module 2: inside one service.
import { arrow, box, svg, text, esc } from '../../src/components.mjs';

/** A folder tree with a note beside each row. rows: [depth, name, note, kind] */
export function tree(rows, label) {
  const rh = 30, top = 18;
  let b = '';
  rows.forEach(([d, name, note, kind], i) => {
    const y = top + i * rh;
    const x = 24 + d * 26;
    if (d > 0) b += `<path class="ln-faint" d="M${x - 16} ${y - rh + 12} V${y - 4} H${x - 4}"/>`;
    const isDir = name.endsWith('/');
    const cls = kind === 'bank' ? 't-accent' : kind === 'mock' ? 't-muted' : '';
    b += `<text class="t-mono ${cls}" x="${x}" y="${y}" style="font-size:13.5px;${kind ? '' : 'fill:var(--ink)'};${isDir ? 'font-weight:600' : ''}">${esc(name)}</text>`;
    if (note) b += text(330, y, note, 't-sm t-muted', 'start');
  });
  return svg(820, top + rows.length * rh, label, b);
}

/** One recipe, one image per service, and what each container does at start. */
export function oneImage() {
  let b = '';
  b += box(20, 120, 170, 76, 'app/Dockerfile', { kind: 'plain', sub: 'one recipe', cls: 't-md' });
  const svcs = [['auth', 'bank'], ['card', 'bank'], ['enrollment', 'bank'], ['wallet_txn', 'bank'], ['profile', 'bank'], ['network', 'mock'], ['wallet_operator', 'mock']];
  svcs.forEach(([n, k], i) => {
    const y = 14 + i * 42;
    b += box(300, y, 200, 34, `SERVICE=${n}`, { kind: k, cls: 't-mono', rx: 8 });
    b += arrow([[190, 158], [250, 158], [250, y + 17], [300, y + 17]], 'ln-faint', 'ah');
  });
  b += text(250, 318, 'one image per service', 't-sm t-muted');
  b += `<rect class="box-plain" x="560" y="60" width="330" height="196" rx="12"/>`;
  b += text(580, 88, 'What every container runs at start', 't-md', 'start');
  const steps = [
    ['1', 'Read $SERVICE and find its package'],
    ['2', 'services.<name>, or mocks.<name>'],
    ['3', 'Run its migrations, if it has a database'],
    ['4', 'Start uvicorn with <package>.main:app'],
  ];
  steps.forEach(([n, s], i) => {
    const y = 122 + i * 34;
    b += `<circle class="dot" cx="592" cy="${y - 4}" r="10"/><text class="t-mono" x="592" y="${y}" text-anchor="middle" style="fill:var(--surface);font-size:11px">${n}</text>`;
    b += text(612, y, s, 't-sm', 'start');
  });
  b += `<path class="ln-faint" d="M506 31 H520 V283 H506"/>`;
  b += arrow([[520, 158], [560, 158]], 'ln', 'ah');
  return svg(910, 330, 'One Dockerfile builds an image for each service by setting SERVICE. Every container runs the same entrypoint, which finds the package, runs migrations and starts uvicorn.', b);
}

/** Five service databases plus testsupport, each with an owner role and a read-only role. */
export function databases() {
  const dbs = [['auth', 'auth'], ['card', 'card'], ['enrollment', 'enrollment'], ['wallet_txn', 'wallet-txn'], ['profile', 'profile']];
  const mono = (x, y, s, size, ink) => `<text class="t-mono" x="${x}" y="${y}" text-anchor="middle" style="font-size:${size}px${ink ? ';fill:var(--ink)' : ''}">${esc(s)}</text>`;
  let b = '';
  b += `<rect class="box-plain" x="20" y="132" width="900" height="186" rx="16"/>`;
  b += text(900, 162, 'One Postgres server', 't-md t-muted', 'end');
  dbs.forEach(([db, svc], i) => {
    const x = 40 + i * 150;
    b += box(x, 20, 130, 46, svc, { kind: 'bank', cls: 't-md' });
    b += arrow([[x + 65, 66], [x + 65, 190]], 'ln-accent', 'ah-accent');
    b += `<rect class="box" x="${x}" y="190" width="130" height="104" rx="10"/>`;
    b += `<ellipse cx="${x + 65}" cy="204" rx="34" ry="7" fill="none" stroke="var(--line)" stroke-width="1.5"/>`;
    b += mono(x + 65, 236, db, 13, true);
    b += mono(x + 65, 260, `${db}_svc`, 11, false);
    b += mono(x + 65, 278, `${db}_ro`, 11, false);
  });
  b += text(112, 104, 'reads, writes', 't-sm t-muted', 'start');
  const x = 790;
  b += `<rect class="box-event" x="${x}" y="190" width="110" height="104" rx="10"/>`;
  b += mono(x + 55, 236, 'testsupport', 12, true);
  b += text(x + 55, 260, 'the shared', 't-sm t-muted');
  b += text(x + 55, 278, 'clock', 't-sm t-muted');
  b += box(40, 352, 200, 46, 'tests', { kind: 'plain', cls: 't-md' });
  b += arrow([[240, 375], [255, 375], [255, 294]], 'ln-mock', 'ah-mock');
  b += text(272, 371, 'log in as card_ro, profile_ro, …  SELECT only, never a change', 't-sm t-muted', 'start');
  return svg(940, 412, 'Each service owns one database on a shared Postgres server and logs in with its owner role, such as card_svc. A read-only role per database, such as card_ro, lets tests look but not change anything. A small testsupport database holds the shared clock.', b);
}

/** One offset row, read by every service and mock every half second. */
export function clockRow() {
  let b = '';
  b += box(20, 150, 180, 70, 'test', { kind: 'plain', sub: 'POST /test/clock' });
  b += `<rect class="box-event" x="290" y="142" width="220" height="86" rx="12"/>`;
  b += `<text class="t-mono" x="400" y="170" text-anchor="middle" style="fill:var(--ink);font-size:13px">clock_offset</text>`;
  b += text(400, 194, 'one row: offset_seconds', 't-sm t-muted');
  b += text(400, 214, 'testsupport database', 't-sm t-muted');
  b += arrow([[200, 185], [290, 185]], 'ln', 'ah');
  b += text(245, 176, 'writes', 't-sm t-muted');
  const svcs = [['auth', 'bank'], ['card', 'bank'], ['enrollment', 'bank'], ['profile', 'bank'], ['wallet-txn', 'bank'], ['both mocks', 'mock']];
  svcs.forEach(([s, k], i) => {
    const y = 14 + i * 58;
    b += box(660, y, 170, 44, s, { kind: k, cls: 't-md' });
    b += arrow([[510, 185], [606, 185], [606, y + 22], [660, y + 22]], 'ln-faint', 'ah');
  });
  b += text(518, 210, 're-read', 't-sm t-muted', 'start');
  b += text(518, 228, 'every 0.5 s', 't-sm t-muted', 'start');
  b += text(850, 176, 'each uses', 't-sm t-muted', 'start');
  b += `<text class="t-mono" x="850" y="196" text-anchor="start" style="fill:var(--ink)">real time</text>`;
  b += `<text class="t-mono" x="850" y="214" text-anchor="start" style="fill:var(--ink)">+ offset</text>`;
  return svg(960, 364, 'A test writes one offset row. Every service and both mocks re-read it every half second and add it to the real time.', b);
}

/** The layers a request passes through, and the errors each one can answer with. */
export function layers() {
  const rows = [
    ['Request context', 'reads or creates the correlation ID, logs every request', '500 INTERNAL_ERROR, if anything below crashes', 'plain'],
    ['Fault injection', 'only when a test has switched a fault on', '503 FAULT_INJECTED · 504 FAULT_TIMEOUT', 'mock'],
    ['Routing', 'FastAPI finds the endpoint for the method and path', '404 NOT_FOUND · 405 METHOD_NOT_ALLOWED', 'plain'],
    ['Who is calling?', 'checks the bearer token or service key', '401 UNAUTHORIZED · TOKEN_INVALID · TOKEN_EXPIRED', 'plain'],
    ['Input checks', 'Pydantic checks the body, query and path values', '422 VALIDATION_ERROR', 'plain'],
    ['The service’s own rules', 'the handler, its database, its events', '404 CARD_NOT_FOUND · 409 · …', 'bank'],
  ];
  const x0 = 20, w = 900, rh = 62, gap = 10;
  let b = '';
  rows.forEach(([t, s, err, k], i) => {
    const y = 14 + i * (rh + gap);
    const inset = i * 18;
    b += `<rect class="box-${k}" x="${x0 + inset}" y="${y}" width="${w - inset * 2}" height="${rh}" rx="10"/>`;
    b += text(x0 + inset + 20, y + 26, t, 't-md', 'start');
    b += text(x0 + inset + 20, y + 47, s, 't-sm t-muted', 'start');
    b += `<text class="t-mono" x="${x0 + w - inset - 20}" y="${y + 37}" text-anchor="end" style="font-size:12px">${esc(err)}</text>`;
  });
  return svg(940, 14 + rows.length * (rh + gap) + 4, 'A request passes six layers in order: request context, fault injection, routing, the caller check, input checks, and the service’s own rules. Each layer can answer with its own errors, so the error code tells you how far the request got.', b);
}

/** Card service owns cards; enrollment keeps its own copy, fed by events. */
export function projection() {
  let b = '';
  b += box(20, 20, 200, 50, 'card service', { kind: 'bank', cls: 't-md' });
  b += `<rect class="box" x="20" y="96" width="200" height="120" rx="10"/>`;
  b += text(120, 122, 'cards', 't-mono', 'middle').replace('class="t-mono"', 'class="t-mono" style="fill:var(--ink);font-size:13px"');
  ['card_id · customer_id', 'status · last4 · expiry', 'limit · available …'].forEach((l, i) => { b += text(120, 148 + i * 20, l, 't-sm t-muted'); });
  b += arrow([[120, 70], [120, 96]], 'ln-accent', 'ah-accent');
  b += box(330, 92, 200, 50, 'Redpanda', { kind: 'event', cls: 't-md' });
  b += arrow([[220, 117], [330, 117]], 'ln-event', 'ah-event');
  b += text(275, 108, 'publishes', 't-sm t-muted');
  b += text(430, 168, 'card.lifecycle', 't-mono t-event');
  b += text(430, 188, '“card 4417 is now LOST”', 't-sm t-muted');
  b += box(640, 20, 240, 50, 'enrollment service', { kind: 'bank', cls: 't-md' });
  b += `<rect class="box" x="640" y="96" width="240" height="120" rx="10"/>`;
  b += text(760, 122, 'card_projection', 't-mono', 'middle').replace('class="t-mono"', 'class="t-mono" style="fill:var(--ink);font-size:13px"');
  ['card_id · customer_id', 'status · last4 · expiry', 'only what it needs'].forEach((l, i) => { b += text(760, 148 + i * 20, l, 't-sm t-muted'); });
  b += arrow([[530, 117], [640, 117]], 'ln-event', 'ah-event');
  b += text(585, 108, 'copies', 't-sm t-muted');
  b += arrow([[760, 70], [760, 96]], 'ln-accent', 'ah-accent');
  return svg(900, 230, 'The card service owns the cards table and publishes card.lifecycle events. The enrollment service reads them and keeps its own small copy, card_projection, with only the fields it needs.', b);
}

/** Moving the shared clock past a token's expiry. */
export function tokenTimeline() {
  const x = (min) => 240 + min * 42; // minutes after 09:00 -> px
  let b = '';
  const axis = (y, title, sub) => {
    b += text(20, y - 6, title, 't-md', 'start');
    b += text(20, y + 14, sub, 't-sm t-muted', 'start');
    b += `<path class="ln-faint" d="M${x(0)} ${y} H${x(16.5)}"/>`;
    for (let m = 0; m <= 15; m += 5) {
      b += `<path class="ln-faint" d="M${x(m)} ${y - 5} V${y + 5}"/>`;
      b += text(x(m), y + 22, `09:${String(m).padStart(2, '0')}`, 't-mono');
    }
  };
  b += `<rect class="box-bank" x="${x(0)}" y="30" width="${x(15) - x(0)}" height="214" rx="6" style="opacity:.5"/>`;
  b += text(x(7.5), 52, 'alice’s access token is valid for 900 seconds', 't-sm t-accent');
  b += `<path class="ln-stop" d="M${x(15)} 30 V244" style="stroke-dasharray:5 4"/>`;
  b += text(x(15) + 8, 52, 'expires', 't-sm', 'start');
  b += text(x(15) + 8, 70, '09:15:00', 't-mono', 'start');
  axis(110, 'Real time', 'the computer’s clock');
  b += `<circle class="dot" cx="${x(0.1)}" cy="110" r="6"/>`;
  b += text(x(0.1) + 12, 96, 'now 09:00:06', 't-sm', 'start');
  axis(206, 'Business time', 'real time + offset');
  b += arrow([[x(0.1), 186], [x(15.1), 186]], 'ln-accent', 'ah-accent');
  b += `<text class="t-mono t-halo" x="${x(0.4)}" y="176" text-anchor="start">advance_seconds: 901</text>`;
  b += `<circle class="dot-stop" cx="${x(15.1)}" cy="206" r="7"/>`;
  b += `<text class="t-sm t-halo" x="${x(14.6)}" y="176" text-anchor="end">09:15:07, so 401 TOKEN_EXPIRED</text>`;
  return svg(1010, 256, 'Alice’s token is valid from 09:00 to 09:15. Real time is 09:00:06. Advancing the shared clock by 901 seconds moves business time to 09:15:07, past the expiry, so the next request gets 401 TOKEN_EXPIRED.', b);
}
