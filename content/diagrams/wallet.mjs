// Diagrams for Module 6: the wallet.
import { arrow, box, svg, text, esc } from '../../src/components.mjs';

const mono = (x, y, s, { size = 12.5, anchor = 'middle', ink = true } = {}) =>
  `<text class="t-mono" x="${x}" y="${y}" text-anchor="${anchor}" style="font-size:${size}px${ink ? ';fill:var(--ink)' : ''}">${esc(s)}</text>`;
const halo = (x, y, s, cls = 't-sm', anchor = 'middle') =>
  `<text class="${cls} t-halo" x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;

/** A contact value from change to verified, with cooldown and lockout. */
export function verifyFlow() {
  let b = '';
  b += box(20, 70, 170, 64, 'unverified', { kind: 'plain', sub: 'new email or phone' });
  b += box(300, 70, 170, 64, 'code sent', { kind: 'event', sub: '202 Accepted' });
  b += box(600, 70, 170, 64, 'verified', { kind: 'bank', sub: 'flag = true' });
  b += arrow([[190, 102], [300, 102]], 'ln', 'ah');
  b += halo(245, 92, 'send', 't-mono');
  b += arrow([[470, 102], [600, 102]], 'ln-accent', 'ah-accent');
  b += halo(535, 92, 'right code', 't-sm');
  // change again
  b += arrow([[685, 70], [685, 30], [105, 30], [105, 70]], 'ln-faint', 'ah');
  b += halo(395, 34, 'PATCH a different value: unverified again', 't-sm');
  // cooldown
  b += arrow([[350, 134], [350, 170], [420, 170], [420, 134]], 'ln-faint', 'ah');
  b += halo(385, 190, 'send again within 30 s: 429', 't-sm');
  // wrong code
  b += arrow([[470, 120], [530, 120], [530, 230], [470, 230]], 'ln-stop', 'ah');
  b += box(300, 206, 170, 50, 'locked 15 min', { kind: 'stop', cls: 't-md' });
  b += text(544, 180, '5th wrong code', 't-sm', 'start');
  b += text(544, 198, '(1st to 4th: 422 with', 't-sm t-muted', 'start');
  b += text(544, 216, 'attempts_remaining)', 't-sm t-muted', 'start');
  b += text(385, 278, '423 OTP_LOCKED until the time passes', 't-sm t-muted');
  return svg(790, 292, 'A changed email or phone is unverified. Sending a code moves it to code sent; another send within 30 seconds is refused with 429. The right code marks it verified. Wrong codes return 422; the fifth locks that channel for 15 minutes with 423. Changing the value again makes it unverified.', b);
}

/** Optimistic locking with If-Match. */
export function ifMatch() {
  let b = '';
  b += box(20, 20, 200, 50, 'profile v3', { kind: 'bank', cls: 't-md' });
  b += box(330, 20, 170, 44, 'Tab A reads v3', { kind: 'plain', cls: 't-sm' });
  b += box(330, 110, 170, 44, 'Tab B reads v3', { kind: 'plain', cls: 't-sm' });
  b += arrow([[220, 45], [330, 42]], 'ln-faint', 'ah');
  b += arrow([[220, 50], [330, 128]], 'ln-faint', 'ah');
  b += arrow([[500, 42], [600, 42]], 'ln', 'ah');
  b += halo(550, 34, 'If-Match: 3', 't-mono');
  b += box(600, 20, 220, 44, '200, now v4', { kind: 'bank', cls: 't-md' });
  b += arrow([[500, 132], [600, 132]], 'ln', 'ah');
  b += halo(550, 124, 'If-Match: 3', 't-mono');
  b += box(600, 110, 220, 44, '412 VERSION_MISMATCH', { kind: 'stop', cls: 't-sm' });
  b += text(600, 180, 'current_version 4: read again, retry', 't-sm t-muted', 'start');
  return svg(840, 196, 'Two browser tabs read the profile at version 3. Tab A saves first with If-Match 3 and the profile becomes version 4. Tab B then saves with If-Match 3 and gets 412 VERSION_MISMATCH, instead of silently overwriting Tab A’s change.', b);
}

/** The eight eligibility rules, first failure wins. */
export function eligibilityLadder() {
  const steps = [
    ['Is the card ACTIVE?', 'CARD_NOT_ACTIVE'],
    ['Is it before the expiry date?', 'CARD_EXPIRED'],
    ['Is it CREDIT or DEBIT?', 'PRODUCT_NOT_SUPPORTED'],
    ['Used in the last 90 days?', 'NOT_RECENTLY_USED'],
    ['Customer still opted in?', 'CUSTOMER_OPTED_OUT'],
    ['Card not removed by the customer?', 'CARD_REMOVED_BY_CUSTOMER'],
    ['Email verified?', 'EMAIL_NOT_VERIFIED'],
    ['Phone verified?', 'PHONE_NOT_VERIFIED'],
  ];
  const rh = 46;
  let b = '';
  steps.forEach(([q, code], i) => {
    const y = 20 + i * rh;
    if (i === 4) b += `<line class="ln-faint" x1="20" y1="${y - 5}" x2="900" y2="${y - 5}"/>`;
    b += `<rect class="box" x="20" y="${y}" width="340" height="34" rx="8"/>`;
    b += text(36, y + 22, `${i + 1}. ${q}`, 't-sm', 'start');
    b += arrow([[360, y + 17], [420, y + 17]], 'ln', 'ah');
    b += text(390, y + 11, 'no', 't-sm t-muted');
    b += `<rect class="box-stop" x="420" y="${y}" width="270" height="34" rx="8"/>`;
    b += mono(555, y + 22, code, { size: 11.5 });
    if (i < steps.length - 1) b += arrow([[60, y + 34], [60, y + rh]], 'ln-faint', 'ah');
    if (i === 0) b += text(712, y + 22, 'about the card', 't-sm t-muted', 'start');
    if (i === 4) b += text(712, y + 22, 'about the customer', 't-sm t-muted', 'start');
  });
  const y = 20 + steps.length * rh;
  b += arrow([[60, y - 12], [60, y + 6]], 'ln-accent', 'ah-accent');
  b += `<rect class="box-bank" x="20" y="${y + 6}" width="340" height="40" rx="10"/>`;
  b += text(36, y + 31, 'eligible', 't-md', 'start');
  return svg(920, y + 60, 'Eight rules are checked in order: card active, not expired, credit or debit, used in the last 90 days, customer opted in, card not removed by the customer, email verified, phone verified. The first rule that fails gives the reason. If all pass, the card is eligible.', b);
}

/** Enrolment statuses. */
export function enrolmentStates() {
  let b = '';
  b += box(20, 130, 160, 64, 'PENDING', { kind: 'event', sub: 'waiting for operator' });
  b += box(320, 130, 170, 64, 'ENROLLED', { kind: 'bank', sub: 'token works' });
  b += box(620, 30, 170, 64, 'SUSPENDED', { kind: 'event', sub: 'paused' });
  b += box(620, 230, 170, 64, 'REMOVED', { kind: 'plain', sub: 'gone from wallet' });
  b += box(20, 276, 160, 50, 'FAILED', { kind: 'stop', cls: 't-md' });
  b += arrow([[180, 155], [320, 155]], 'ln-accent', 'ah-accent');
  b += halo(250, 145, 'callback', 't-sm');
  b += arrow([[60, 194], [60, 276]], 'ln-stop', 'ah');
  b += halo(70, 228, 'declined, or', 't-sm', 'start');
  b += halo(70, 245, 'gave up', 't-sm', 'start');
  b += arrow([[490, 145], [620, 70]], 'ln', 'ah');
  b += halo(548, 96, 'suspend', 't-sm');
  b += arrow([[620, 54], [405, 54], [405, 130]], 'ln-accent', 'ah-accent');
  b += halo(512, 46, 'resume', 't-sm');
  b += arrow([[490, 180], [620, 255]], 'ln', 'ah');
  b += halo(548, 232, 'remove', 't-sm');
  b += arrow([[705, 94], [705, 230]], 'ln', 'ah');
  b += halo(717, 165, 'remove', 't-sm', 'start');
  // starting again
  b += `<path class="ln-faint" d="M180 301 L240 301 L240 270"/>`;
  b += arrow([[620, 270], [240, 270], [240, 180], [180, 180]], 'ln-faint', 'ah');
  b += halo(252, 300, 'add again, opt in or sweep: a new enrol', 't-sm', 'start');
  return svg(810, 340, 'An enrolment starts PENDING and becomes ENROLLED when the operator’s callback confirms it, or FAILED if the operator declines or the bank gives up. ENROLLED can be suspended and resumed. ENROLLED and SUSPENDED can be removed. From REMOVED or FAILED, adding the card again, opting in or the sweep starts a new enrolment at PENDING.', b);
}

/** The checks a callback passes, in order. */
export function callbackChecks() {
  const steps = [
    ['signature and timestamp valid?', 'no', '401', 'stop'],
    ['body valid, enrolment known?', 'no', '422 or 404', 'stop'],
    ['event_id seen before?', 'yes', '200 DUPLICATE', 'plain'],
    ['enrolment already REMOVED?', 'yes', '200 IGNORED_REMOVED', 'plain'],
    ['operator_version older than stored?', 'yes', '200 STALE', 'plain'],
    ['status not what was last asked for?', 'yes', '200 SUPERSEDED', 'plain'],
  ];
  const rh = 50;
  let b = '';
  b += box(20, 10, 260, 40, 'callback arrives', { kind: 'mock', cls: 't-md' });
  steps.forEach(([q, ans, res, k], i) => {
    const y = 74 + i * rh;
    b += arrow([[60, y - 24], [60, y]], 'ln-faint', 'ah');
    b += `<rect class="box" x="20" y="${y}" width="360" height="36" rx="8"/>`;
    b += text(36, y + 23, q, 't-sm', 'start');
    b += arrow([[380, y + 18], [460, y + 18]], 'ln', 'ah');
    b += text(420, y + 11, ans, 't-sm t-muted');
    b += `<rect class="box-${k}" x="460" y="${y}" width="230" height="36" rx="8"/>`;
    b += mono(575, y + 23, res, { size: 12 });
  });
  const y = 74 + steps.length * rh;
  b += arrow([[60, y - 14], [60, y + 6]], 'ln-accent', 'ah-accent');
  b += `<rect class="box-bank" x="20" y="${y + 6}" width="360" height="42" rx="10"/>`;
  b += text(36, y + 32, 'apply it: 200 APPLIED or FAILURE_RECORDED', 't-sm', 'start');
  b += text(460, y + 24, 'every 200 tells the operator', 't-sm t-muted', 'start');
  b += text(460, y + 42, '“received, stop resending”', 't-sm t-muted', 'start');
  return svg(720, y + 62, 'A callback is checked in order: signature and timestamp, then body and enrolment, then whether its event_id was seen before, whether the enrolment is already removed, whether its operator_version is older than the stored one, and whether it matches what the bank last asked for. Only a callback that passes every check is applied. Everything except a signature or validation failure is answered 200.', b);
}

/** Two callbacks arriving out of order. */
export function outOfOrder() {
  let b = '';
  b += text(20, 24, 'The operator sends', 't-md', 'start');
  b += box(20, 40, 200, 50, 'SUSPENDED · v3', { kind: 'mock', cls: 't-md' });
  b += box(20, 110, 200, 50, 'ENROLLED · v4', { kind: 'mock', cls: 't-md' });
  b += text(380, 24, 'The bank receives', 't-md', 'start');
  b += box(380, 40, 200, 50, 'ENROLLED · v4', { kind: 'mock', cls: 't-md' });
  b += box(380, 110, 200, 50, 'SUSPENDED · v3', { kind: 'mock', cls: 't-md' });
  b += arrow([[220, 65], [300, 65], [300, 135], [380, 135]], 'ln-faint', 'ah');
  b += arrow([[220, 135], [280, 135], [280, 65], [380, 65]], 'ln-faint', 'ah');
  b += arrow([[580, 65], [640, 65]], 'ln-accent', 'ah-accent');
  b += text(650, 70, 'applied, stored v4', 't-sm', 'start');
  b += arrow([[580, 135], [640, 135]], 'ln-stop', 'ah');
  b += text(650, 132, '3 < 4: STALE,', 't-sm', 'start');
  b += text(650, 150, 'ignored', 't-sm', 'start');
  return svg(820, 176, 'The operator suspends then resumes a card, sending callbacks with operator_version 3 and then 4. They arrive in the opposite order. The bank applies version 4 and stores it; when version 3 arrives, it is older, so it is acknowledged and ignored as stale.', b);
}

/** The bank's record and the operator's file, compared. */
export function reconCompare() {
  const rows = [
    ['e1', 'ENROLLED · 4417', 'ENROLLED · 4417', '', 'match'],
    ['e2', 'ENROLLED · 2045', '(absent)', 'MISSING_AT_OPERATOR', 'stop'],
    ['e3', '(absent)', 'ENROLLED · 3390', 'MISSING_IN_SOR', 'stop'],
    ['e4', 'SUSPENDED · 8836', 'ENROLLED · 8836', 'STATUS_MISMATCH', 'stop'],
    ['e5', 'ENROLLED · 6604', 'ENROLLED · 6611', 'DATA_MISMATCH', 'stop'],
    ['e6', 'PENDING', 'PROCESSING', 'skipped: in flight', 'plain'],
  ];
  let b = '';
  b += text(80, 24, 'enrolment', 't-sm t-muted');
  b += text(240, 24, 'bank (system of record)', 't-md');
  b += text(470, 24, 'operator’s daily file', 't-md');
  b += text(720, 24, 'finding', 't-md');
  rows.forEach(([id, sor, file, finding, k], i) => {
    const y = 40 + i * 46;
    b += mono(80, y + 23, id, { size: 12 });
    b += `<rect class="box-bank" x="140" y="${y}" width="200" height="34" rx="7"/>`;
    b += mono(240, y + 22, sor, { size: 11.5 });
    b += `<rect class="box-mock" x="370" y="${y}" width="200" height="34" rx="7"/>`;
    b += mono(470, y + 22, file, { size: 11.5 });
    if (k === 'match') b += text(720, y + 22, 'no finding', 't-sm t-muted');
    else {
      b += `<rect class="box-${k}" x="610" y="${y}" width="220" height="34" rx="7"/>`;
      b += mono(720, y + 22, finding, { size: 11.5 });
    }
  });
  return svg(850, 320, 'Six enrolments compared. Same on both sides: no finding. Active at the bank but absent from the file: MISSING_AT_OPERATOR. In the file but unknown to the bank: MISSING_IN_SOR. Different statuses: STATUS_MISMATCH. Same status but a different last4 or expiry: DATA_MISMATCH. An enrolment still waiting for a callback is skipped.', b);
}
