// Diagrams for Module 3: identity and trust.
import { arrow, box, svg, text, esc } from '../../src/components.mjs';

const mono = (x, y, s, { size = 13, ink = true, anchor = 'middle', cls = 't-mono' } = {}) =>
  `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}" style="font-size:${size}px${ink ? ';fill:var(--ink)' : ''}">${esc(s)}</text>`;

/** The three parts of an access token. */
export function tokenParts() {
  let b = '';
  const parts = [
    { x: 20, w: 250, kind: 'plain', t: 'Header', lines: ['"alg": "RS256"', '"kid": "Xq3…"'], note: 'how it was signed, and with which key' },
    { x: 290, w: 330, kind: 'bank', t: 'Payload (the claims)', lines: ['"sub": "a11ce000-…-0001"', '"iss": "cardvault-auth"', '"aud": "cardvault"', '"iat": 1795597200   "exp": 1795598100', '"jti": "7d1e…"'], note: 'who, issued by whom, for whom, until when' },
    { x: 640, w: 260, kind: 'event', t: 'Signature', lines: ['made with auth’s', 'private key'], note: 'proves nobody changed the first two parts' },
  ];
  for (const p of parts) {
    b += `<rect class="box-${p.kind}" x="${p.x}" y="20" width="${p.w}" height="170" rx="12"/>`;
    b += text(p.x + 18, 48, p.t, 't-md', 'start');
    p.lines.forEach((l, i) => { b += mono(p.x + 18, 76 + i * 22, l, { size: 12.5, anchor: 'start' }); });
    b += text(p.x + p.w / 2, 216, p.note, 't-sm t-muted');
  }
  b += mono(280, 108, '.', { size: 28 });
  b += mono(630, 108, '.', { size: 28 });
  return svg(920, 232, 'An access token has three parts separated by dots: a header saying it is signed with RS256 and which key, a payload of claims such as sub, iss, aud, iat, exp and jti, and a signature made with auth’s private key.', b);
}

/** Refresh tokens rotate on every use; reusing an old one revokes the family. */
export function refreshFamily() {
  let b = '';
  b += text(20, 26, 'One login starts a family of refresh tokens', 't-md', 'start');
  const toks = [['rt_A', 'used'], ['rt_B', 'used'], ['rt_C', 'current']];
  toks.forEach(([t, s], i) => {
    const x = 20 + i * 220;
    b += `<rect class="${s === 'current' ? 'box-bank' : 'box'}" x="${x}" y="48" width="160" height="58" rx="10"/>`;
    b += mono(x + 80, 74, t);
    b += text(x + 80, 94, s === 'current' ? 'the one to use next' : 'used, now dead', 't-sm t-muted');
    if (i < 2) {
      b += arrow([[x + 160, 77], [x + 220, 77]], 'ln', 'ah');
      b += text(x + 190, 68, 'refresh', 't-sm t-muted');
    }
  });
  b += `<path class="ln-faint" d="M20 136 H900"/>`;
  b += text(20, 166, 'Someone presents rt_A again', 't-md', 'start');
  b += `<rect class="box-stop" x="20" y="186" width="160" height="58" rx="10"/>`;
  b += mono(100, 212, 'rt_A');
  b += text(100, 232, 'already used', 't-sm t-muted');
  b += arrow([[180, 215], [250, 215]], 'ln', 'ah');
  b += `<rect class="box-stop" x="250" y="178" width="390" height="74" rx="10"/>`;
  b += text(270, 206, 'Treated as theft: the whole family is revoked', 't-md', 'start');
  b += text(270, 230, 'rt_A, rt_B and rt_C all stop working', 't-sm t-muted', 'start');
  b += arrow([[640, 215], [700, 215]], 'ln', 'ah');
  b += mono(710, 220, '401 REFRESH_TOKEN_REUSED', { size: 12.5, anchor: 'start' });
  return svg(920, 262, 'Each refresh uses up the current refresh token and returns a new one, so rt_A leads to rt_B and rt_C. If an already-used token such as rt_A is presented again, the whole family is revoked and the response is 401 REFRESH_TOKEN_REUSED.', b);
}

/** Five failed logins lock the username for 15 minutes. */
export function lockout() {
  let b = '';
  for (let i = 0; i < 5; i++) {
    const x = 20 + i * 104;
    b += `<rect class="box-stop" x="${x}" y="30" width="90" height="56" rx="10"/>`;
    b += text(x + 45, 54, `try ${i + 1}`, 't-md');
    b += mono(x + 45, 74, '401', { size: 12, ink: false });
  }
  b += text(20, 18, 'Wrong password (or unknown username)', 't-sm t-muted', 'start');
  b += arrow([[540, 58], [580, 58]], 'ln', 'ah');
  b += `<rect class="box-stop" x="580" y="24" width="320" height="68" rx="10"/>`;
  b += text(600, 52, 'Locked for 15 minutes', 't-md', 'start');
  b += mono(600, 76, '423 ACCOUNT_LOCKED + locked_until', { size: 12, anchor: 'start', ink: false });
  b += text(20, 126, 'Even the right password gets 423 while locked. A successful login before the fifth failure resets the count to zero.', 't-sm t-muted', 'start');
  return svg(920, 140, 'Five failed logins for a username lock it for 15 minutes. During the lock every login, even with the right password, gets 423 ACCOUNT_LOCKED with the time the lock ends.', b);
}

/** Who proves what, to whom, and how. */
export function trustMap() {
  let b = '';
  const N = {
    browser: [20, 40, 150, 'Browser', 'plain'],
    web: [250, 40, 170, 'web (BFF)', 'bank'],
    svc: [520, 20, 200, 'bank services', 'bank'],
    card: [520, 170, 200, 'card internal API', 'bank'],
    enr: [520, 300, 200, 'enrollment', 'bank'],
    net: [20, 170, 170, 'network mock', 'mock'],
    op: [800, 300, 170, 'wallet operator mock', 'mock'],
    tests: [800, 120, 170, 'your tests', 'plain'],
  };
  for (const [, [x, y, w, l, k]] of Object.entries(N)) b += box(x, y, w, 54, l, { kind: k, cls: 't-md' });
  const lab = (x, y, s, how) => {
    b += `<text class="t-sm t-halo" x="${x}" y="${y}" text-anchor="middle">${esc(s)}</text>`;
    b += `<text class="t-mono t-halo" x="${x}" y="${y + 16}" text-anchor="middle" style="font-size:11.5px">${esc(how)}</text>`;
  };
  b += arrow([[170, 67], [250, 67]], 'ln', 'ah');
  lab(210, 106, 'session cookie', 'HttpOnly');
  b += arrow([[420, 57], [520, 47]], 'ln', 'ah');
  lab(470, 24, 'customer token', 'Bearer JWT');
  b += arrow([[190, 197], [520, 197]], 'ln-mock', 'ah-mock');
  lab(355, 186, 'purchases, clearing', 'X-Service-Key');
  b += arrow([[620, 354], [620, 380], [885, 380], [885, 354]], 'ln-accent', 'ah-accent', { start: true });
  lab(752, 404, 'pushes and callbacks, both ways', 'X-Signature (HMAC)');
  b += arrow([[885, 300], [885, 260], [105, 260], [105, 224]], 'ln-mock', 'ah-mock');
  lab(300, 250, 'wallet tokens', 'X-Service-Key');
  b += arrow([[800, 147], [720, 147], [720, 182]], 'ln-faint', 'ah');
  lab(760, 110, 'test controls', 'X-Test-Key');
  return svg(990, 430, 'The browser holds an HttpOnly session cookie; the web app’s server sends the customer’s JWT to the services. The network mock and the wallet operator mock call with a service key. Enrollment and the wallet operator sign their messages to each other with HMAC. Tests use a test key for the test controls.', b);
}

/** How an HMAC signature is made and checked. */
export function hmacFlow() {
  let b = '';
  b += text(20, 24, 'Sender', 't-lg', 'start');
  b += `<rect class="box" x="20" y="40" width="230" height="40" rx="8"/>`;
  b += mono(135, 65, '1795597200', { size: 12.5 });
  b += text(260, 65, 'timestamp', 't-sm t-muted', 'start');
  b += `<rect class="box" x="20" y="90" width="230" height="40" rx="8"/>`;
  b += mono(135, 115, '{"enrollment_id": …}', { size: 12.5 });
  b += text(260, 115, 'raw body', 't-sm t-muted', 'start');
  b += `<rect class="box-event" x="20" y="140" width="230" height="40" rx="8"/>`;
  b += text(135, 165, 'shared secret', 't-md');
  b += arrow([[340, 110], [400, 110]], 'ln', 'ah');
  b += `<rect class="box-plain" x="400" y="80" width="170" height="60" rx="10"/>`;
  b += text(485, 106, 'HMAC-SHA256', 't-md');
  b += text(485, 126, 'of "timestamp.body"', 't-sm t-muted');
  b += arrow([[570, 110], [630, 110]], 'ln', 'ah');
  b += `<rect class="box-bank" x="630" y="80" width="270" height="60" rx="10"/>`;
  b += mono(765, 106, 'X-Timestamp: 1795597200', { size: 12 });
  b += mono(765, 126, 'X-Signature: 9f2c…', { size: 12 });
  b += `<path class="ln-faint" d="M20 206 H900"/>`;
  b += text(20, 238, 'Receiver, with the same secret', 't-lg', 'start');
  const steps = [
    ['1', 'Recompute the signature from the timestamp and the raw body it received'],
    ['2', 'Compare with X-Signature. Different: 401 SIGNATURE_INVALID'],
    ['3', 'Check the timestamp is within 5 minutes of now. Too old or too new: 401 SIGNATURE_EXPIRED'],
  ];
  steps.forEach(([n, s], i) => {
    const y = 272 + i * 32;
    b += `<circle class="dot" cx="32" cy="${y - 4}" r="10"/><text class="t-mono" x="32" y="${y}" text-anchor="middle" style="fill:var(--surface);font-size:11px">${n}</text>`;
    b += text(52, y, s, 't-sm', 'start');
  });
  return svg(920, 362, 'The sender joins the timestamp and the raw body, signs them with HMAC-SHA256 and the shared secret, and sends the timestamp and signature as headers. The receiver recomputes the signature, compares it, then checks the timestamp is within five minutes.', b);
}

/** Private key signs in one place; public keys verify everywhere. */
export function keyPair() {
  let b = '';
  b += `<rect class="box-bank" x="20" y="60" width="240" height="120" rx="12"/>`;
  b += text(140, 90, 'auth service', 't-lg');
  b += `<rect class="box-stop" x="50" y="110" width="180" height="50" rx="8"/>`;
  b += text(140, 132, 'private key', 't-md');
  b += text(140, 150, 'never leaves auth', 't-sm t-muted');
  b += arrow([[260, 100], [380, 100]], 'ln', 'ah');
  b += text(320, 90, 'signs tokens', 't-sm t-muted');
  b += arrow([[260, 150], [380, 150]], 'ln-event', 'ah-event');
  b += text(320, 172, 'publishes', 't-sm t-muted');
  b += `<rect class="box-event" x="380" y="126" width="210" height="50" rx="8"/>`;
  b += mono(485, 156, '/.well-known/jwks.json', { size: 12 });
  b += `<rect class="box" x="380" y="76" width="210" height="44" rx="8"/>`;
  b += text(485, 103, 'access token', 't-md');
  const svcs = ['card', 'profile', 'enrollment', 'wallet-txn'];
  svcs.forEach((s, i) => {
    const y = 20 + i * 56;
    b += box(700, y, 180, 44, s, { kind: 'bank', cls: 't-md' });
    b += arrow([[590, 125], [650, 125], [650, y + 22], [700, y + 22]], 'ln-faint', 'ah');
  });
  b += text(645, 250, 'each checks the signature itself with the public key', 't-sm t-muted');
  return svg(900, 262, 'The auth service keeps the private key and uses it to sign access tokens. It publishes the matching public key at /.well-known/jwks.json. Every other service fetches the public key once and checks token signatures itself.', b);
}

/** Hashing, encryption and signing side by side. */
export function threeTools() {
  const cols = [
    { t: 'Hashing', s: 'one way: you cannot get the input back', a: 'password', f: 'scrypt + salt', o: 'scrypt$16384$…', use: 'Passwords, refresh tokens', k: 'plain' },
    { t: 'Encryption', s: 'two way: the key gets the input back', a: 'full card number', f: 'AES-256-GCM + key', o: 'v1:Bx9…', use: 'Full card numbers', k: 'bank' },
    { t: 'Signing', s: 'anyone can read it, nobody can change it', a: 'token claims', f: 'RS256 or HMAC', o: 'claims + signature', use: 'Access tokens, callbacks', k: 'event' },
  ];
  let b = '';
  cols.forEach((c, i) => {
    const x = 20 + i * 300;
    b += text(x, 26, c.t, 't-lg', 'start');
    b += text(x, 46, c.s, 't-sm t-muted', 'start');
    b += `<rect class="box" x="${x}" y="66" width="270" height="40" rx="8"/>`;
    b += mono(x + 135, 91, c.a, { size: 12.5 });
    b += arrow([[x + 135, 106], [x + 135, 132]], 'ln', 'ah');
    b += `<rect class="box-${c.k}" x="${x}" y="132" width="270" height="40" rx="8"/>`;
    b += text(x + 135, 157, c.f, 't-md');
    b += arrow([[x + 135, 172], [x + 135, 198]], 'ln', 'ah');
    b += `<rect class="box" x="${x}" y="198" width="270" height="40" rx="8"/>`;
    b += mono(x + 135, 223, c.o, { size: 12.5 });
    b += text(x, 266, 'Used for: ' + c.use, 't-sm', 'start');
  });
  return svg(920, 280, 'Hashing turns a password into a value that cannot be turned back. Encryption turns a card number into ciphertext that the key can turn back. Signing leaves the content readable but adds a signature so changes are detected.', b);
}
