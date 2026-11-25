// The CardVault service map, drawn once and used both as a static figure (lesson 3,
// home page) and as the interactive map. Solid lines are HTTP calls, gold dashed lines
// are Kafka events, slate dashed boxes are mocks, and the dotted outline is the bank.
import { arrow, esc, svg } from '../../src/components.mjs';

const N = {
  browser: { x: 40, y: 250, w: 130, h: 56, label: 'Browser', kind: 'plain' },
  web: { x: 210, y: 250, w: 140, h: 56, label: 'web', sub: 'UI + BFF :3000', kind: 'bank' },
  auth: { x: 440, y: 50, w: 150, h: 56, label: 'auth', sub: ':8001', kind: 'bank' },
  profile: { x: 440, y: 170, w: 150, h: 56, label: 'profile', sub: ':8005', kind: 'bank' },
  card: { x: 440, y: 320, w: 150, h: 70, label: 'card', sub: ':8002', kind: 'bank' },
  enrollment: { x: 760, y: 150, w: 150, h: 110, label: 'enrollment', sub: ':8003', kind: 'bank' },
  'wallet-txn': { x: 760, y: 430, w: 150, h: 60, label: 'wallet-txn', sub: ':8004', kind: 'bank' },
  operator: { x: 980, y: 160, w: 150, h: 70, label: 'wallet operator', sub: 'mock :8101', kind: 'mock' },
  network: { x: 40, y: 430, w: 140, h: 56, label: 'card network', sub: 'mock :8102', kind: 'mock' },
  postgres: { x: 440, y: 530, w: 290, h: 44, label: 'Postgres', sub: 'one database per service', kind: 'plain' },
  redpanda: { x: 760, y: 530, w: 370, h: 44, label: 'Redpanda (Kafka)', sub: 'carries every gold arrow', kind: 'event' },
};

const E = [
  // HTTP calls
  { a: 'web', b: 'auth', pts: [[350, 270], [390, 270], [390, 78], [440, 78]] },
  { a: 'web', b: 'profile', pts: [[350, 274], [390, 274], [390, 198], [440, 198]] },
  { a: 'web', b: 'card', pts: [[350, 284], [390, 284], [390, 355], [440, 355]] },
  { a: 'web', b: 'enrollment', pts: [[350, 278], [620, 278], [620, 180], [760, 180]] },
  { a: 'web', b: 'wallet-txn', pts: [[350, 278], [620, 278], [620, 445], [760, 445]] },
  { a: 'browser', b: 'web', pts: [[170, 278], [210, 278]] },
  { a: 'network', b: 'card', pts: [[180, 458], [515, 458], [515, 390]], label: 'authorizations, clearing', lx: 330, ly: 476 },
  { a: 'enrollment', b: 'operator', pts: [[910, 182], [980, 182]], label: 'pushes', lx: 945, ly: 174, cls: 'ln-accent', head: 'ah-accent' },
  { a: 'operator', b: 'enrollment', pts: [[980, 212], [910, 212]], label: 'callbacks', lx: 945, ly: 230, cls: 'ln-accent', head: 'ah-accent' },
  { a: 'browser', b: 'operator', pts: [[105, 250], [105, 20], [1055, 20], [1055, 160]], label: 'terms page, shown in an iframe', lx: 580, ly: 14, cls: 'ln-mock', head: 'ah-mock' },
  // Kafka events
  { a: 'profile', b: 'enrollment', ev: true, pts: [[590, 195], [760, 195]], label: 'contact.updated', lx: 690, ly: 188 },
  { a: 'card', b: 'enrollment', ev: true, pts: [[590, 336], [690, 336], [690, 228], [760, 228]], label: 'card.lifecycle', lx: 640, ly: 329 },
  { a: 'enrollment', b: 'card', ev: true, pts: [[760, 245], [720, 245], [720, 364], [590, 364]], label: 'enrollment.changed', lx: 655, ly: 384 },
  { a: 'card', b: 'wallet-txn', ev: true, pts: [[590, 380], [605, 380], [605, 474], [760, 474]], label: 'auth.decided, txn.cleared', lx: 683, ly: 510 },
];

export function serviceMap({ interactive = false } = {}) {
  let body = '';
  // The bank's boundary
  body += `<rect class="zone" x="196" y="34" width="730" height="556" rx="18"/>`;
  body += `<text class="t-mono t-accent" x="214" y="58" style="font-size:11px;letter-spacing:.08em">THE BANK · UNDER TEST</text>`;
  for (const e of E) {
    const cls = e.ev ? 'ln-event' : (e.cls || 'ln');
    const head = e.ev ? 'ah-event' : (e.head || 'ah');
    body += `<g class="edge" data-a="${e.a}" data-b="${e.b}">${arrow(e.pts, cls, head, { halo: true })}`;
    if (e.label) {
      const tcls = e.ev ? 't-mono t-event' : 't-sm t-muted';
      body += `<text class="${tcls} t-halo" x="${e.lx}" y="${e.ly}" text-anchor="middle">${esc(e.label)}</text>`;
    }
    body += `</g>`;
  }
  for (const [id, n] of Object.entries(N)) {
    const k = `box-${n.kind}`;
    const attrs = interactive ? ` tabindex="0" role="button" aria-label="${esc(n.label)}"` : '';
    const cy = n.sub ? n.y + n.h / 2 - 3 : n.y + n.h / 2 + 5;
    body += `<g class="map-node" data-id="${id}"${attrs}><rect class="${k}" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="10"/>`
      + `<text class="t-lg" x="${n.x + n.w / 2}" y="${cy}" text-anchor="middle">${esc(n.label)}</text>`
      + (n.sub ? `<text class="t-mono" x="${n.x + n.w / 2}" y="${cy + 17}" text-anchor="middle">${esc(n.sub)}</text>` : '')
      + `</g>`;
  }
  return svg(1160, 600, 'CardVault service map: the browser talks to the web app, which calls five bank services; two mocks play the card network and the wallet operator; services share events through Redpanda.', body)
    .replace('<svg class="d"', `<svg class="d map${interactive ? ' interactive' : ''}"`);
}

export const mapNodes = N;
export const mapEdges = E;
