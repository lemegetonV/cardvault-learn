// Diagrams for Module 4: cards and money.
import { arrow, box, svg, text, esc } from '../../src/components.mjs';

const mono = (x, y, s, { size = 12.5, anchor = 'middle', ink = true } = {}) =>
  `<text class="t-mono" x="${x}" y="${y}" text-anchor="${anchor}" style="font-size:${size}px${ink ? ';fill:var(--ink)' : ''}">${esc(s)}</text>`;
const halo = (x, y, s, cls = 't-sm', anchor = 'middle') =>
  `<text class="${cls} t-halo" x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;

/** The three card statuses and the actions between them. */
export function cardStates() {
  let b = '';
  b += box(40, 150, 190, 70, 'ACTIVE', { kind: 'bank', sub: 'can be used' });
  b += box(420, 30, 190, 70, 'LOST', { kind: 'event', sub: 'every purchase declined' });
  b += box(420, 270, 190, 70, 'CLOSED', { kind: 'stop', sub: 'permanent' });
  // report lost
  b += arrow([[230, 165], [420, 75]], 'ln', 'ah');
  b += halo(300, 104, 'report-lost', 't-mono');
  // reissue back
  b += arrow([[420, 55], [150, 55], [150, 150]], 'ln-accent', 'ah-accent');
  b += halo(285, 46, 'reissue: new number and expiry', 't-sm');
  // close from active
  b += arrow([[230, 205], [420, 295]], 'ln', 'ah');
  b += halo(300, 270, 'close', 't-mono');
  // close from lost
  b += arrow([[540, 100], [540, 270]], 'ln', 'ah');
  b += halo(552, 190, 'close', 't-mono', 'start');
  // reissue from active
  b += arrow([[90, 220], [90, 250], [180, 250], [180, 220]], 'ln-accent', 'ah-accent');
  b += halo(135, 270, 'reissue', 't-mono');
  // notes
  b += text(660, 60, 'report-lost again: 200, no change', 't-sm t-muted', 'start');
  b += text(660, 300, 'close again: 200, no change', 't-sm t-muted', 'start');
  b += text(660, 320, 'anything else: 409', 't-sm t-muted', 'start');
  b += mono(660, 338, 'INVALID_STATE_TRANSITION', { size: 11.5, anchor: 'start', ink: false });
  return svg(920, 360, 'A card is ACTIVE, LOST or CLOSED. Report-lost moves ACTIVE to LOST. Reissue moves ACTIVE or LOST to ACTIVE with a new number and expiry. Close moves ACTIVE or LOST to CLOSED for good. Repeating report-lost or close returns 200 with no change; any other move from CLOSED returns 409.', b);
}

/** The authorization checks, in order. */
export function decisionLadder() {
  const steps = [
    ['Is the card LOST?', 'CARD_LOST'],
    ['Is the card CLOSED?', 'CARD_CLOSED'],
    ['Has the card expired?', 'CARD_EXPIRED'],
    ['Wallet purchase: is the token mapped to this card?', 'TOKEN_MISMATCH', 'no'],
    ['Wallet purchase: is the token ENROLLED?', 'TOKEN_INACTIVE', 'no'],
    ['Is the amount more than available?', 'INSUFFICIENT_FUNDS'],
  ];
  const rh = 52;
  let b = '';
  b += box(20, 10, 220, 44, 'authorization arrives', { kind: 'plain', cls: 't-md' });
  steps.forEach(([q, code, ans], i) => {
    const y = 80 + i * rh;
    b += arrow([[130, y - 26], [130, y]], 'ln-faint', 'ah');
    b += `<rect class="box" x="20" y="${y}" width="440" height="36" rx="8"/>`;
    b += text(36, y + 23, q, 't-sm', 'start');
    b += arrow([[460, y + 18], [560, y + 18]], 'ln', 'ah');
    b += text(510, y + 11, ans || 'yes', 't-sm t-muted');
    b += `<rect class="box-stop" x="560" y="${y}" width="250" height="36" rx="8"/>`;
    b += mono(685, y + 23, `DECLINED · ${code}`, { size: 12 });
  });
  const y = 80 + steps.length * rh;
  b += arrow([[130, y - 16], [130, y + 6]], 'ln-accent', 'ah-accent');
  b += `<rect class="box-bank" x="20" y="${y + 6}" width="440" height="44" rx="10"/>`;
  b += text(36, y + 34, 'APPROVED: create a hold, reduce available', 't-md', 'start');
  b += text(560, y + 34, 'Either way: store the decision, publish auth.decided', 't-sm t-muted', 'start');
  return svg(920, y + 66, 'The card service checks, in order: card lost, card closed, card expired, token not mapped to the card, token not enrolled, amount above available. The first failing check declines with its code. If all pass, the purchase is approved, a hold is created and available goes down.', b);
}

/** A hold and what clearing can do to it. */
export function holdStates() {
  let b = '';
  b += box(20, 120, 200, 70, 'ACTIVE hold', { kind: 'event', sub: 'money set aside' });
  b += box(400, 20, 220, 70, 'SETTLED', { kind: 'bank', sub: 'charged for real' });
  b += box(400, 220, 220, 70, 'RELEASED', { kind: 'plain', sub: 'money given back' });
  b += arrow([[220, 140], [400, 60]], 'ln', 'ah');
  b += halo(276, 80, 'SETTLE (any amount on CREDIT)', 't-sm');
  b += arrow([[220, 170], [400, 250]], 'ln', 'ah');
  b += halo(300, 232, 'REVERSE (whole hold)', 't-sm');
  b += arrow([[60, 190], [60, 230], [150, 230], [150, 190]], 'ln-faint', 'ah');
  b += halo(105, 250, 'partial REVERSE: smaller hold', 't-sm');
  b += arrow([[620, 45], [700, 45], [700, 75], [620, 75]], 'ln-accent', 'ah-accent');
  b += text(712, 55, 'REFUND, up to what', 't-sm', 'start');
  b += text(712, 73, 'was charged', 't-sm', 'start');
  b += text(712, 250, 'cannot be settled', 't-sm t-muted', 'start');
  b += text(712, 268, 'or reversed again', 't-sm t-muted', 'start');
  return svg(900, 300, 'An approved purchase leaves an ACTIVE hold. SETTLE turns it into a real charge; REVERSE releases it, fully or in part. Only a settled purchase can be refunded, and only up to what was charged.', b);
}

/** Settling for less than the hold gives the difference back. */
export function settleDifference() {
  const sc = 1.6; // px per dollar
  let b = '';
  const rows = [
    { t: 'Approved', s: 'hold $250.00', bars: [['bar-hold', 250]], note: '$250.00 held' },
    { t: 'Settled for $240.00', s: 'a $10.00 discount, say', bars: [['bar-spent', 240], ['bar-avail', 10]], note: '$240.00 charged, $10.00 back to available' },
  ];
  rows.forEach((r, i) => {
    const y = 24 + i * 96;
    b += text(20, y + 18, r.t, 't-md', 'start');
    b += text(20, y + 38, r.s, 't-sm t-muted', 'start');
    let x = 220;
    r.bars.forEach(([cls, v]) => {
      const w = v * sc;
      b += `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="30" rx="4"/>`;
      x += w;
    });
    b += text(220, y + 52, r.note, 't-sm', 'start');
  });
  return svg(660, 200, 'A purchase is approved with a $250 hold, then settles for $240. The $240 becomes a charge and the remaining $10 returns to available.', b);
}
