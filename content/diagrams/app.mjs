// Diagrams for the "Know the app" track.
import { svg, box, arrow, text } from '../../src/components.mjs';

/** Who is involved: the customer, the bank, and the two outside companies. */
export function business() {
  const W = 780, H = 250;
  let b = '';
  b += box(20, 97, 140, 56, 'Customer', { kind: 'plain' });
  b += box(300, 87, 190, 76, 'CardVault Bank', { kind: 'bank', sub: 'the app you test' });
  b += box(610, 20, 150, 56, 'Wallet company', { kind: 'mock' });
  b += box(610, 174, 150, 56, 'Card network', { kind: 'mock' });
  b += arrow([[160, 125], [296, 125]]);
  b += text(228, 115, 'uses the app');
  b += arrow([[490, 108], [540, 108], [540, 48], [606, 48]], 'ln', 'ah', { start: true });
  b += text(548, 38, 'add a card · confirm', 't-sm', 'start');
  b += arrow([[606, 202], [540, 202], [540, 142], [494, 142]]);
  b += text(548, 222, 'approve this purchase?', 't-sm', 'start');
  return svg(W, H, 'The customer uses CardVault Bank. The bank talks to the wallet company and the card network.', b);
}

/** The whole system: browser, web app, five services, database, message bus, partners. */
export function system() {
  const W = 900, H = 490;
  const sx = 400, sw = 240, sh = 48;
  const services = [
    ['Login', 'auth-service'],
    ['Cards', 'card-service'],
    ['Profile', 'profile-service'],
    ['Wallet', 'enrollment-service'],
    ['Transactions', 'wallet-txn-service'],
  ];
  const sy = (i) => 54 + i * 64;
  let b = '';
  // The part under test.
  b += `<rect class="zone" x="176" y="14" width="486" height="462" rx="16"/>`;
  b += text(196, 38, 'CardVault Bank: what you test', 't-sm t-accent', 'start');
  b += box(20, 182, 120, 60, 'Browser', { kind: 'plain', sub: 'the customer' });
  b += box(196, 170, 150, 84, 'Web app', { kind: 'bank', sub: 'screens + BFF' });
  b += arrow([[140, 212], [192, 212]]);
  services.forEach(([label, name], i) => {
    const y = sy(i), cy = y + sh / 2;
    b += box(sx, y, sw, sh, label, { kind: 'bank', sub: name, cls: 't-md' });
    b += arrow([[346, 212], [372, 212], [372, cy], [sx - 4, cy]]);
  });
  // Shared infrastructure under the services.
  const bottom = sy(4) + sh;
  b += `<path class="ln-faint" d="M${sx + 10} ${bottom + 18} H${sx + sw - 10}"/>`;
  b += text(sx + sw / 2, bottom + 13, 'every service uses', 't-mono');
  b += box(sx, bottom + 30, 112, 52, 'Database', { kind: 'plain', cls: 't-md', sub: 'Postgres' });
  b += box(sx + 128, bottom + 30, 112, 52, 'Message bus', { kind: 'event', cls: 't-md', sub: 'Kafka' });
  // Outside companies.
  const cardsY = sy(1) + sh / 2, walletY = sy(3) + sh / 2;
  b += box(730, cardsY - 28, 150, 56, 'Card network', { kind: 'mock', cls: 't-md', sub: 'outside' });
  b += box(730, walletY - 28, 150, 56, 'Wallet company', { kind: 'mock', cls: 't-md', sub: 'outside' });
  b += arrow([[730, cardsY], [sx + sw + 4, cardsY]]);
  b += text(686, cardsY - 8, 'purchases', 't-sm');
  b += arrow([[726, walletY], [sx + sw + 4, walletY]], 'ln', 'ah', { start: true });
  b += text(686, walletY - 8, 'enrol cards', 't-sm');
  return svg(W, H, 'The browser talks to the web app, which calls five backend services. The services share a database server and a message bus. The card network and the wallet company are outside.', b);
}

/** Two ways services talk: a direct call, and an event on the message bus. */
export function twoWays() {
  const W = 760, H = 230;
  let b = '';
  b += text(20, 26, 'A direct call: ask and wait for the answer', 't-md', 'start');
  b += box(20, 44, 150, 52, 'Web app', { kind: 'bank', cls: 't-md' });
  b += box(330, 44, 150, 52, 'Cards', { kind: 'bank', cls: 't-md' });
  b += arrow([[170, 62], [326, 62]]);
  b += text(248, 54, 'GET my cards');
  b += arrow([[326, 82], [174, 82]], 'ln-mock', 'ah-mock');
  b += text(248, 100, 'here they are', 't-sm t-muted');
  b += text(20, 146, 'An event: announce it, whoever cares listens later', 't-md', 'start');
  b += box(20, 162, 150, 52, 'Cards', { kind: 'bank', cls: 't-md' });
  b += box(300, 162, 160, 52, 'Message bus', { kind: 'event', cls: 't-md' });
  b += box(590, 162, 150, 52, 'Transactions', { kind: 'bank', cls: 't-md' });
  b += arrow([[170, 188], [296, 188]], 'ln-event', 'ah-event');
  b += text(233, 180, 'purchase approved', 't-sm t-event');
  b += arrow([[460, 188], [586, 188]], 'ln-event', 'ah-event');
  b += text(523, 180, 'picks it up', 't-sm t-event');
  return svg(W, H, 'A direct call waits for an answer. An event is announced on the message bus and picked up by whoever listens.', b);
}
