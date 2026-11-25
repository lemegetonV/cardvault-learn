// Diagrams for Module 5: events.
import { arrow, box, svg, text, esc } from '../../src/components.mjs';

const mono = (x, y, s, { size = 12.5, anchor = 'middle', ink = true } = {}) =>
  `<text class="t-mono" x="${x}" y="${y}" text-anchor="${anchor}" style="font-size:${size}px${ink ? ';fill:var(--ink)' : ''}">${esc(s)}</text>`;
const halo = (x, y, s, cls = 't-sm', anchor = 'middle') =>
  `<text class="${cls} t-halo" x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;

/** Calling every interested service versus publishing one event. */
export function callsVsEvents() {
  let b = '';
  b += text(20, 26, 'If card called everyone', 't-lg', 'start');
  b += text(20, 46, 'card must know every listener, and waits for each', 't-sm t-muted', 'start');
  b += box(20, 110, 130, 50, 'card', { kind: 'bank', cls: 't-md' });
  const outs = ['enrollment', 'wallet-txn', 'a future service'];
  outs.forEach((o, i) => {
    const y = 66 + i * 64;
    b += box(270, y, 150, 44, o, { kind: i === 2 ? 'plain' : 'bank', cls: 't-md' });
    b += arrow([[150, 135], [210, 135], [210, y + 22], [270, y + 22]], 'ln', 'ah');
  });
  b += halo(210, 262, 'one slow or down: card is stuck', 't-sm');
  b += `<line class="ln-faint" x1="470" y1="12" x2="470" y2="280"/>`;
  b += text(500, 26, 'With an event', 't-lg', 'start');
  b += text(500, 46, 'card publishes once; listeners subscribe on their own', 't-sm t-muted', 'start');
  b += box(500, 110, 110, 50, 'card', { kind: 'bank', cls: 't-md' });
  b += box(650, 112, 120, 46, 'Redpanda', { kind: 'event', cls: 't-md' });
  b += arrow([[610, 135], [650, 135]], 'ln-event', 'ah-event');
  outs.forEach((o, i) => {
    const y = 66 + i * 64;
    b += box(810, y, 130, 44, o, { kind: i === 2 ? 'plain' : 'bank', cls: 't-sm' });
    b += arrow([[770, 135], [790, 135], [790, y + 22], [810, y + 22]], 'ln-event', 'ah-event');
  });
  b += halo(720, 262, 'a listener down: it catches up later', 't-sm');
  return svg(960, 282, 'Left: if the card service called every interested service directly, it would have to know them all and would be stuck when one is slow. Right: it publishes one event to Redpanda, and each listener reads it in its own time, including services added later.', b);
}

/** A topic split into partitions by key. */
export function partitions() {
  let b = '';
  b += text(20, 26, 'card.lifecycle: 3 partitions, key = card_id', 't-md', 'start');
  const parts = [
    ['partition 0', [['A', 'ACTIVATED'], ['A', 'USED'], ['A', 'LOST']]],
    ['partition 1', [['B', 'USED'], ['C', 'ACTIVATED'], ['B', 'CLOSED']]],
    ['partition 2', [['D', 'USED'], ['D', 'USED']]],
  ];
  parts.forEach(([p, msgs], i) => {
    const y = 50 + i * 62;
    b += text(20, y + 28, p, 't-sm t-muted', 'start');
    b += `<rect class="box-plain" x="110" y="${y}" width="620" height="46" rx="8"/>`;
    msgs.forEach(([k, e], j) => {
      const x = 122 + j * 150;
      b += `<rect class="box-event" x="${x}" y="${y + 7}" width="138" height="32" rx="6"/>`;
      b += mono(x + 69, y + 28, `card ${k} · ${e}`, { size: 11.5 });
    });
  });
  b += arrow([[122, 252], [700, 252]], 'ln-faint', 'ah');
  b += text(410, 272, 'order is kept within a partition, oldest first', 't-sm t-muted');
  b += text(750, 80, 'every event for', 't-sm', 'start');
  b += text(750, 98, 'one card lands in', 't-sm', 'start');
  b += text(750, 116, 'the same partition,', 't-sm', 'start');
  b += text(750, 134, 'so it stays in order', 't-sm', 'start');
  return svg(900, 286, 'card.lifecycle has three partitions. Each event is placed by its key, the card_id, so all of card A’s events are in one partition in the order they were published. Different cards may share a partition, and there is no order across partitions.', b);
}

/** Why "save, then publish" is not safe. */
export function dualWrite() {
  let b = '';
  const panel = (x, title, steps, bad) => {
    b += text(x, 26, title, 't-lg', 'start');
    steps.forEach(([s, k], i) => {
      const y = 46 + i * 56;
      b += `<rect class="box-${k}" x="${x}" y="${y}" width="380" height="42" rx="8"/>`;
      b += text(x + 16, y + 26, s, 't-sm', 'start');
      if (i < steps.length - 1) b += arrow([[x + 30, y + 42], [x + 30, y + 56]], 'ln-faint', 'ah');
    });
    b += text(x, 46 + steps.length * 56 + 14, bad, 't-sm t-muted', 'start');
  };
  panel(20, 'Save, then publish', [['Save the card as LOST', 'bank'], ['Process crashes here', 'stop'], ['Publish CARD_LOST: never happens', 'plain']], 'The card is lost, but nobody is told.');
  panel(460, 'Publish, then save', [['Publish CARD_LOST', 'event'], ['Save fails, transaction rolls back', 'stop'], ['The card is still ACTIVE', 'plain']], 'Everyone was told something untrue.');
  return svg(860, 230, 'Two ways to write to the database and publish an event, and how each fails. Saving first can lose the event if the process crashes in between. Publishing first can announce a change that then rolls back.', b);
}

/** The transactional outbox: one transaction, then a relay. */
export function outboxFlow() {
  let b = '';
  b += `<rect class="zone" x="20" y="20" width="420" height="200" rx="14"/>`;
  b += mono(40, 44, 'ONE DATABASE TRANSACTION', { size: 11, anchor: 'start', ink: false });
  b += box(40, 60, 380, 56, 'UPDATE cards SET status = LOST', { kind: 'bank', cls: 't-md' });
  b += box(40, 136, 380, 56, 'INSERT INTO outbox (CARD_LOST event)', { kind: 'event', cls: 't-md' });
  b += text(230, 244, 'both are saved, or neither is', 't-sm t-muted');
  b += arrow([[440, 164], [520, 164]], 'ln', 'ah');
  b += box(520, 130, 170, 68, 'relay', { kind: 'plain', sub: 'background task' });
  b += arrow([[690, 164], [770, 164]], 'ln-event', 'ah-event');
  b += box(770, 136, 150, 56, 'Redpanda', { kind: 'event', cls: 't-md' });
  const steps = ['take the oldest unsent row per key', 'publish it', 'mark it sent; on failure, wait and retry'];
  steps.forEach((s, i) => { b += text(520, 236 + i * 20, `${i + 1}. ${s}`, 't-sm', 'start'); });
  return svg(940, 300, 'In one database transaction the service changes the card and inserts an outbox row holding the event. A background relay later takes the oldest unsent row for each key, publishes it to Redpanda, and marks it sent, retrying on failure.', b);
}

/** What a consumer does with each message. */
export function consumerFlow() {
  let b = '';
  b += box(20, 120, 150, 56, 'next message', { kind: 'event', cls: 't-md' });
  b += arrow([[170, 148], [230, 148]], 'ln', 'ah');
  b += `<rect class="box" x="230" y="118" width="170" height="60" rx="10"/>`;
  b += text(315, 144, 'valid envelope', 't-md');
  b += text(315, 164, 'and schema?', 't-md');
  // malformed path
  b += arrow([[315, 178], [315, 240]], 'ln', 'ah');
  b += halo(328, 214, 'no', 't-sm', 'start');
  b += `<rect class="box-stop" x="210" y="240" width="210" height="64" rx="10"/>`;
  b += text(315, 266, 'retry 3 times, then', 't-sm');
  b += mono(315, 288, 'send to the DLQ', { size: 12 });
  // valid path
  b += arrow([[400, 148], [470, 148]], 'ln', 'ah');
  b += halo(435, 140, 'yes', 't-sm');
  b += `<rect class="box" x="470" y="118" width="170" height="60" rx="10"/>`;
  b += text(555, 144, 'already', 't-md');
  b += text(555, 164, 'applied?', 't-md');
  b += arrow([[555, 118], [555, 60]], 'ln', 'ah');
  b += halo(568, 92, 'yes', 't-sm', 'start');
  b += `<rect class="box-plain" x="470" y="16" width="170" height="44" rx="10"/>`;
  b += text(555, 43, 'skip it', 't-md');
  b += arrow([[640, 148], [700, 148]], 'ln', 'ah');
  b += halo(670, 140, 'no', 't-sm');
  b += box(700, 120, 150, 56, 'apply it', { kind: 'bank', cls: 't-md' });
  b += arrow([[775, 176], [775, 240]], 'ln', 'ah');
  b += halo(788, 214, 'error', 't-sm', 'start');
  b += `<rect class="box-event" x="670" y="240" width="210" height="64" rx="10"/>`;
  b += text(775, 266, 'wait and retry,', 't-sm');
  b += text(775, 286, 'with growing delays', 't-sm');
  b += arrow([[850, 148], [900, 148], [900, 340], [95, 340], [95, 176]], 'ln-faint', 'ah');
  b += halo(500, 344, 'done: commit the offset, move to the next message', 't-sm');
  return svg(920, 362, 'For each message the consumer checks the envelope and schema. A malformed message is retried three times and then sent to the dead-letter topic. A valid message that was already applied is skipped: enrollment and wallet-txn recognise its event_id, and card compares versions. Otherwise it is applied; an error there is retried with growing delays. When the message is done, the offset is committed.', b);
}
