// Diagrams for Module 8: the web app.
import { arrow, box, svg, text, esc } from '../../src/components.mjs';

const mono = (x, y, s, { size = 12.5, anchor = 'middle', ink = true } = {}) =>
  `<text class="t-mono" x="${x}" y="${y}" text-anchor="${anchor}" style="font-size:${size}px${ink ? ';fill:var(--ink)' : ''}">${esc(s)}</text>`;
const halo = (x, y, s, cls = 't-sm', anchor = 'middle') =>
  `<text class="${cls} t-halo" x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;

/** Browser, BFF and services, and where the token lives. */
export function bffMap() {
  let b = '';
  // browser
  b += `<rect class="zone" x="20" y="20" width="230" height="250" rx="14"/>`;
  b += text(135, 46, 'Browser', 't-lg');
  b += box(40, 66, 190, 44, 'page script', { kind: 'plain', cls: 't-md' });
  b += text(40, 140, 'cookies', 't-sm t-muted', 'start');
  b += mono(40, 164, 'cv_access   HttpOnly', { size: 11.5, anchor: 'start' });
  b += mono(40, 186, 'cv_refresh  HttpOnly', { size: 11.5, anchor: 'start' });
  b += mono(40, 208, 'cv_csrf     readable', { size: 11.5, anchor: 'start' });
  b += text(40, 244, 'the script cannot read the tokens', 't-sm t-muted', 'start');
  // BFF
  b += `<rect class="box-bank" x="330" y="20" width="230" height="250" rx="14"/>`;
  b += text(445, 46, 'Next.js server', 't-lg');
  b += box(350, 66, 190, 44, 'pages', { kind: 'plain', cls: 't-md' });
  b += box(350, 130, 190, 56, '/api/… (the BFF)', { kind: 'plain', cls: 't-md' });
  b += text(445, 220, 'reads cv_access,', 't-sm');
  b += text(445, 238, 'sends it as a Bearer token', 't-sm');
  b += arrow([[250, 150], [350, 150]], 'ln', 'ah');
  b += halo(300, 140, 'cookies', 't-sm');
  // services
  const svcs = [['/api/cards/…', 'card'], ['/api/profile/…', 'profile'], ['/api/wallet/transactions…', 'wallet-txn'], ['/api/wallet/…', 'enrollment']];
  svcs.forEach(([p, s], i) => {
    const y = 30 + i * 60;
    b += box(700, y, 150, 44, s, { kind: 'bank', cls: 't-md' });
    b += arrow([[540, 158], [620, 158], [620, y + 22], [700, y + 22]], 'ln', 'ah');
  });
  b += text(620, 296, 'Authorization: Bearer …', 't-mono');
  return svg(870, 310, 'The browser holds three cookies. The access and refresh tokens are HttpOnly, so page scripts cannot read them; only the CSRF cookie is readable. The page calls the Next.js server’s /api routes, the backend-for-frontend, which reads the access token from the cookie and forwards the call to the right service with a Bearer token.', b);
}

/** Double-submit CSRF. */
export function csrfDouble() {
  let b = '';
  b += text(20, 26, 'From CardVault’s own page', 't-lg', 'start');
  b += box(20, 44, 170, 50, 'page script', { kind: 'plain', cls: 't-md' });
  b += arrow([[190, 69], [260, 69]], 'ln-faint', 'ah');
  b += halo(225, 61, 'reads', 't-sm');
  b += box(260, 44, 140, 50, 'cv_csrf = a91f…', { kind: 'event', cls: 't-sm' });
  b += arrow([[105, 94], [105, 130]], 'ln', 'ah');
  b += box(20, 130, 380, 50, 'cookie a91f… + header x-csrf-token: a91f…', { kind: 'plain', cls: 't-sm' });
  b += arrow([[400, 155], [470, 155]], 'ln-accent', 'ah-accent');
  b += box(470, 130, 150, 50, 'match: allowed', { kind: 'bank', cls: 't-sm' });
  const y = 220;
  b += text(20, y + 6, 'From another website', 't-lg', 'start');
  b += box(20, y + 24, 170, 50, 'evil page', { kind: 'stop', cls: 't-md' });
  b += text(200, y + 54, 'cannot read CardVault’s cookies', 't-sm t-muted', 'start');
  b += arrow([[105, y + 74], [105, y + 110]], 'ln', 'ah');
  b += box(20, y + 110, 380, 50, 'cookie (if sent) + no matching header', { kind: 'plain', cls: 't-sm' });
  b += arrow([[400, y + 135], [470, y + 135]], 'ln-stop', 'ah');
  b += box(470, y + 110, 150, 50, '403 CSRF_FAILED', { kind: 'stop', cls: 't-sm' });
  return svg(640, y + 176, 'CardVault’s own page reads the cv_csrf cookie and copies it into the x-csrf-token header; the BFF sees the cookie and header match and allows the call. Another website cannot read CardVault’s cookies, so even if the browser attaches the cookie, the header is missing or wrong, and the BFF answers 403 CSRF_FAILED.', b);
}

/** The terms frame and postMessage. */
export function termsFrame() {
  let b = '';
  b += `<rect class="box-bank" x="20" y="20" width="560" height="220" rx="14"/>`;
  b += text(40, 46, 'CardVault page (localhost:3000)', 't-md', 'start');
  b += `<rect class="box-mock" x="40" y="62" width="270" height="150" rx="10"/>`;
  b += text(60, 88, 'iframe: operator terms', 't-sm', 'start');
  b += mono(60, 108, 'localhost:8101/embed/terms', { size: 11.5, anchor: 'start', ink: false });
  b += text(60, 144, '☐ I agree', 't-sm', 'start');
  b += `<rect class="box-plain" x="60" y="160" width="100" height="32" rx="6"/>`;
  b += text(110, 181, 'Continue', 't-sm');
  b += arrow([[310, 145], [400, 145]], 'ln-event', 'ah-event');
  b += halo(355, 134, 'postMessage', 't-sm');
  b += `<rect class="box" x="400" y="100" width="160" height="90" rx="10"/>`;
  b += text(480, 126, 'origin is the', 't-sm');
  b += text(480, 144, 'operator?', 't-sm');
  b += text(480, 172, 'enable “Add card”', 't-sm t-muted');
  b += box(620, 100, 200, 50, 'any other origin', { kind: 'stop', cls: 't-sm' });
  b += text(720, 172, 'ignored', 't-sm t-muted');
  b += arrow([[620, 125], [560, 125]], 'ln-stop', 'ah');
  return svg(840, 256, 'The CardVault page shows the operator’s terms in an iframe. When the customer agrees and presses Continue, the frame sends a postMessage with the terms version. The page enables the Add card button only for a message from the operator’s origin; messages from any other origin are ignored.', b);
}

/** The 15-minute session. */
export function sessionTimeline() {
  let b = '';
  const x0 = 50, x1 = 710;
  const at = (m) => x0 + (x1 - x0) * (m / 15);
  const y = 70;
  b += text(x0, 30, 'signed in', 't-sm', 'start');
  b += `<line class="ln" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>`;
  for (let m = 0; m <= 15; m += 5) {
    b += `<line class="ln-faint" x1="${at(m)}" y1="${y - 8}" x2="${at(m)}" y2="${y + 8}"/>`;
    if (m > 0 && m < 15) b += text(at(m), y + 28, `${m}:00`, 't-sm t-muted');
    if (m === 0) b += text(x0 + 8, y + 28, '0:00', 't-sm t-muted', 'start');
  }
  b += `<rect class="box-event" x="${at(14)}" y="${y - 18}" width="${at(15) - at(14)}" height="36" rx="4"/>`;
  b += text(at(14.5), 30, 'warning, countdown', 't-sm');
  b += text(at(15), y + 28, '15:00', 't-sm t-muted');
  b += arrow([[x1, y], [770, y]], 'ln-stop', 'ah');
  b += box(770, y - 20, 120, 40, 'signed out', { kind: 'stop', cls: 't-sm' });
  b += arrow([[at(14.5), y + 18], [at(14.5), 140], [x0, 140], [x0, y + 12]], 'ln-accent', 'ah-accent');
  b += halo((x0 + at(14.5)) / 2, 134, '“Stay signed in”: tokens refreshed, the 15 minutes start again', 't-sm');
  return svg(910, 160, 'A web session lasts 15 minutes. At 14:00 a warning dialog counts down the last minute. At 15:00 the customer is signed out. Pressing Stay signed in refreshes the tokens and starts the 15 minutes again.', b);
}
