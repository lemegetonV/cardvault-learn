// Diagrams for Module 1. Each function returns an <svg> string.
import { arrow, box, svg, text } from '../../src/components.mjs';

/** The bank in the middle, the outside world around it. */
export function actors() {
  let b = '';
  b += box(20, 150, 150, 70, 'Customer', { kind: 'plain', sub: 'four seed people' });
  b += `<rect class="zone" x="250" y="30" width="350" height="300" rx="18"/>`;
  b += `<text class="t-mono t-accent" x="270" y="56" style="font-size:11px;letter-spacing:.08em">CARDVAULT BANK · UNDER TEST</text>`;
  b += box(270, 72, 310, 40, 'web app', { kind: 'bank', cls: 't-md' });
  const svc = [['auth', 270, 126], ['profile', 430, 126], ['card', 270, 176], ['enrollment', 430, 176], ['wallet-txn', 270, 226]];
  for (const [n, x, y] of svc) b += box(x, y, 150, 38, n, { kind: 'bank', cls: 't-md' });
  b += box(430, 226, 150, 38, 'Postgres · Redpanda', { kind: 'plain', cls: 't-sm' });
  b += text(425, 300, 'five services, each with its own database', 't-sm t-muted');
  b += box(730, 50, 160, 76, 'Wallet operator', { kind: 'mock', sub: 'mock' });
  b += box(730, 240, 160, 76, 'Card network', { kind: 'mock', sub: 'mock, with merchants' });
  b += arrow([[170, 185], [250, 185]], 'ln', 'ah');
  b += text(210, 175, 'uses', 't-sm t-muted');
  b += arrow([[600, 76], [730, 76]], 'ln-accent', 'ah-accent');
  b += text(665, 68, 'add or pause', 't-sm t-muted');
  b += arrow([[730, 106], [600, 106]], 'ln-accent', 'ah-accent');
  b += text(665, 124, 'confirms later', 't-sm t-muted');
  b += arrow([[730, 266], [600, 266]], 'ln', 'ah');
  b += text(665, 258, 'approve this?', 't-sm t-muted');
  b += arrow([[600, 296], [730, 296]], 'ln', 'ah');
  b += text(665, 314, 'yes or no', 't-sm t-muted');
  b += arrow([[95, 220], [95, 370], [810, 370], [810, 316]], 'ln-mock', 'ah-mock');
  b += `<text class="t-sm t-muted t-halo" x="450" y="374" text-anchor="middle">pays with the wallet at an online checkout</text>`;
  return svg(910, 390, 'The customer uses the bank’s web app. The bank asks the wallet operator to add cards and gets confirmations back. When the customer pays at a checkout, the card network asks the bank to approve the purchase.', b);
}

/** The order Docker Compose starts containers in, from the depends_on rules. */
export function startup() {
  const cols = [
    { t: 'First', s: 'storage', items: [['postgres', 'plain'], ['redpanda', 'event']] },
    { t: 'Then', s: 'needs Postgres', items: [['auth', 'bank'], ['wallet-operator-mock', 'mock']] },
    { t: 'Then', s: 'need Postgres, Redpanda, auth', items: [['card', 'bank'], ['profile', 'bank'], ['enrollment', 'bank'], ['wallet-txn', 'bank']] },
    { t: 'Last', s: 'need the services above', items: [['network-mock', 'mock'], ['web', 'bank']] },
  ];
  const cw = 190, gap = 46, x0 = 20, y0 = 70, bh = 40, bg = 12;
  let b = '';
  cols.forEach((c, i) => {
    const x = x0 + i * (cw + gap);
    b += text(x, 26, c.t, 't-lg', 'start');
    b += text(x, 46, c.s, 't-sm t-muted', 'start');
    c.items.forEach(([n, k], j) => { b += box(x, y0 + j * (bh + bg), cw, bh, n, { kind: k, cls: 't-md', rx: 8 }); });
    if (i < cols.length - 1) b += arrow([[x + cw + 8, y0 + 20], [x + cw + gap - 8, y0 + 20]], 'ln', 'ah');
  });
  const y = y0 + 4 * (bh + bg) + 22;
  b += `<rect class="box-plain" x="20" y="${y}" width="910" height="56" rx="10"/>`;
  b += text(40, y + 24, 'Inside each Python container', 't-md', 'start');
  const steps = ['run its database migrations', 'start the web server', 'healthy once /ready returns 200'];
  steps.forEach((s, i) => {
    const sx = 300 + i * 215;
    b += `<circle class="dot" cx="${sx}" cy="${y + 28}" r="4"/>`;
    b += text(sx + 12, y + 33, s, 't-sm', 'start');
    if (i < 2) b += arrow([[sx + 180, y + 28], [sx + 205, y + 28]], 'ln-faint', 'ah');
  });
  return svg(950, y + 70, 'Docker Compose starts Postgres and Redpanda first, then auth and the operator mock, then the four other services, then the network mock and the web app. Each Python container runs its migrations, starts its server and reports healthy through /ready.', b);
}

/** A call waits for its response; an event is posted and the sender moves on. */
export function callVsEvent() {
  let b = '';
  b += text(20, 26, 'An HTTP call', 't-lg', 'start');
  b += text(20, 46, 'the caller waits for the response', 't-sm t-muted', 'start');
  b += box(20, 70, 130, 50, 'web', { kind: 'bank', cls: 't-md' });
  b += box(250, 70, 130, 50, 'card', { kind: 'bank', cls: 't-md' });
  b += arrow([[150, 86], [250, 86]], 'ln', 'ah');
  b += text(200, 80, 'list my cards', 't-sm');
  b += arrow([[250, 106], [150, 106]], 'ln-mock', 'ah-mock');
  b += text(200, 124, 'here they are', 't-sm t-muted');
  b += `<line class="ln-faint" x1="440" y1="12" x2="440" y2="168"/>`;
  b += text(480, 26, 'An event', 't-lg', 'start');
  b += text(480, 46, 'the sender posts it and moves on', 't-sm t-muted', 'start');
  b += box(480, 70, 110, 50, 'card', { kind: 'bank', cls: 't-md' });
  b += box(640, 74, 110, 42, 'Redpanda', { kind: 'event', cls: 't-md' });
  b += box(800, 70, 120, 50, 'enrollment', { kind: 'bank', cls: 't-md' });
  b += arrow([[590, 95], [640, 95]], 'ln-event', 'ah-event');
  b += arrow([[750, 95], [800, 95]], 'ln-event', 'ah-event');
  b += text(700, 146, 'card.lifecycle: “card 4417 was reported lost”', 't-mono t-event');
  return svg(940, 170, 'Left: web calls card-service and waits for the list. Right: card-service posts a card.lifecycle event to Redpanda and enrollment-service reads it later.', b);
}

/** A card's $1,000 available balance through one $250 purchase. */
export function balance() {
  const stages = [
    { t: 'Before', s: 'nothing bought yet', a: 1000, h: 0, sp: 0 },
    { t: 'Approved', s: '$250 put on hold', a: 750, h: 250, sp: 0 },
    { t: 'Settled', s: 'hold becomes a charge', a: 750, h: 0, sp: 250 },
    { t: 'Refunded', s: 'money given back', a: 1000, h: 0, sp: 0 },
  ];
  const top = 40, H = 220, bw = 64, gap = 160, x0 = 40;
  const sc = H / 1000;
  let b = '';
  stages.forEach((st, i) => {
    const x = x0 + i * gap;
    let y = top;
    b += `<rect class="bar-bg" x="${x}" y="${top}" width="${bw}" height="${H}" rx="6"/>`;
    const seg = (v, cls, label) => {
      if (!v) return;
      const h = v * sc;
      b += `<rect class="${cls}" x="${x}" y="${y}" width="${bw}" height="${h}"/>`;
      const ty = y + Math.min(h / 2, 28);
      b += `<text class="t-mono" x="${x + bw + 8}" y="${ty}" text-anchor="start" style="fill:var(--ink)">$${v.toLocaleString('en-US')}</text>`;
      b += `<text class="t-sm t-muted" x="${x + bw + 8}" y="${ty + 15}" text-anchor="start">${label}</text>`;
      y += h;
    };
    seg(st.h, 'bar-hold', 'on hold');
    seg(st.sp, 'bar-spent', 'charged');
    seg(st.a, 'bar-avail', 'available');
    b += `<text class="t-lg" x="${x + bw / 2}" y="${top + H + 28}" text-anchor="middle">${st.t}</text>`;
    b += `<text class="t-sm t-muted" x="${x + bw / 2}" y="${top + H + 46}" text-anchor="middle">${st.s}</text>`;
  });
  b += text(x0, 24, 'Spending power on one card, starting at $1,000', 't-md t-muted', 'start');
  return svg(680, 320, 'A $1,000 balance: approving a $250 purchase moves $250 onto hold, settling turns the hold into a charge, and a refund returns the money.', b);
}
