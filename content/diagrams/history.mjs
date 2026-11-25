// Diagrams for Module 7: wallet transactions.
import { arrow, box, svg, text, esc } from '../../src/components.mjs';

const mono = (x, y, s, { size = 12.5, anchor = 'middle', ink = true } = {}) =>
  `<text class="t-mono" x="${x}" y="${y}" text-anchor="${anchor}" style="font-size:${size}px${ink ? ';fill:var(--ink)' : ''}">${esc(s)}</text>`;
const halo = (x, y, s, cls = 't-sm', anchor = 'middle') =>
  `<text class="${cls} t-halo" x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;

/** Two topics folded into one row per trace_id. */
export function foldEvents() {
  let b = '';
  b += box(20, 40, 190, 56, 'auth.decided', { kind: 'event', sub: 'merchant, amount, decision' });
  b += box(20, 150, 190, 56, 'txn.cleared', { kind: 'event', sub: 'SETTLE · REVERSE · REFUND' });
  b += box(300, 86, 150, 64, 'wallet-txn', { kind: 'bank', sub: 'WALLET only' });
  b += arrow([[210, 68], [255, 68], [255, 110], [300, 110]], 'ln-event', 'ah-event');
  b += arrow([[210, 178], [255, 178], [255, 128], [300, 128]], 'ln-event', 'ah-event');
  b += arrow([[450, 118], [520, 118]], 'ln', 'ah');
  b += halo(485, 108, 'upsert', 't-sm');
  // the row
  b += `<rect class="box-bank" x="520" y="30" width="300" height="180" rx="10"/>`;
  b += mono(670, 54, 'one row per trace_id', { size: 12, ink: false });
  const rows = [['merchant_name', 'from auth'], ['auth_amount', 'from auth'], ['cleared_amount', 'from SETTLE'], ['reversed_amount', 'sum of REVERSE'], ['refunded_amount', 'sum of REFUND'], ['status', 'worked out']];
  rows.forEach(([k, v], i) => {
    const y = 80 + i * 21;
    b += mono(540, y, k, { size: 12, anchor: 'start' });
    b += text(800, y, v, 't-sm t-muted', 'end');
  });
  b += text(420, 250, 'either event can arrive first; the row ends the same', 't-sm t-muted');
  return svg(840, 266, 'The wallet-txn service reads auth.decided and txn.cleared, keeps only wallet purchases, and upserts one row per trace_id. The authorization fills the merchant and amount; clearing records fill the settled, reversed and refunded amounts; the status is worked out from the amounts. Either event may arrive first.', b);
}

/** Pages with a cursor. */
export function cursorPages() {
  let b = '';
  const items = ['09:41', '09:12', '08:55', '08:55', '08:30', '07:02'];
  b += text(20, 22, 'newest first; ties broken by txn_id', 't-sm t-muted', 'start');
  items.forEach((t, i) => {
    const x = 20 + i * 108;
    const page2 = i >= 3;
    b += `<rect class="${page2 ? 'box-plain' : 'box-bank'}" x="${x}" y="40" width="96" height="44" rx="8"/>`;
    b += mono(x + 48, 67, t, { size: 12.5 });
  });
  b += `<line class="ln-faint" x1="338" y1="34" x2="338" y2="96"/>`;
  b += text(170, 108, 'page 1 (limit 3)', 't-sm');
  b += text(500, 108, 'page 2', 't-sm');
  b += box(220, 130, 236, 44, 'next_cursor', { kind: 'event', cls: 't-md' });
  b += arrow([[290, 84], [290, 130]], 'ln-faint', 'ah');
  b += text(470, 150, '= the last item’s time and txn_id', 't-sm', 'start');
  b += text(470, 168, 'page 2 starts strictly after it', 't-sm t-muted', 'start');
  return svg(680, 186, 'Transactions are listed newest first, three per page here. The next_cursor names the last item on the page by its time and txn_id, and the next page starts strictly after that item, so two purchases at the same minute are neither repeated nor skipped.', b);
}
