import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { page } from '../../src/layout.mjs';
import { esc, code, svg, box, text } from '../../src/components.mjs';
import { topics, dlqs } from '../services.mjs';

function typeOf(p) {
  if (p.anyOf) return p.anyOf.map(typeOf).join(' or ');
  if (p.enum) return 'one of: ' + p.enum.map((v) => `<code>${esc(v)}</code>`).join(' ');
  if (p.const !== undefined) return `always <code>${esc(p.const)}</code>`;
  let t = p.type || 'object';
  if (p.format) t += ` (${p.format})`;
  if (t === 'null') t = 'null';
  return esc(t);
}

function envelopeFigure() {
  let b = '';
  b += `<rect class="box-plain" x="10" y="10" width="620" height="200" rx="14"/>`;
  b += text(30, 38, 'Envelope: the same for every event', 't-md t-muted', 'start');
  const f = [['event_id', 'unique ID, used to ignore duplicates'], ['event_type', 'the topic name'], ['version', 'schema version, 1 today'], ['occurred_at', 'when it happened (UTC)'], ['correlation_id', 'follows the original request']];
  f.forEach(([k, v], i) => {
    b += `<text class="t-mono" x="30" y="${66 + i * 26}" style="fill:var(--ink)">${k}</text>`;
    b += text(160, 66 + i * 26, v, 't-sm t-muted', 'start');
  });
  b += `<rect class="box-event" x="400" y="52" width="210" height="140" rx="12"/>`;
  b += text(505, 80, 'payload', 't-lg t-event');
  b += text(505, 104, 'different for each topic', 't-sm t-muted');
  b += text(505, 140, 'card_id, status, amount…', 't-mono');
  b += text(505, 166, 'see each topic below', 't-sm t-muted');
  return `<figure class="wide"><div class="fig">${svg(640, 220, 'Every event is an envelope with five fixed fields around a topic-specific payload.', b)}</div><figcaption>Every event has the same outer envelope. Only the <strong>payload</strong> changes from topic to topic.</figcaption></figure>`;
}

export async function eventsPage(root) {
  const sections = [];
  for (const t of topics) {
    const schema = JSON.parse(await readFile(path.join(root, 'data/events', `${t.name}.schema.json`), 'utf8'));
    const payload = Object.values(schema.$defs)[0];
    const req = new Set(payload.required || []);
    const rows = Object.entries(payload.properties).map(([k, p]) =>
      `<tr><td>${esc(k)}${req.has(k) ? '' : ' <span style="color:var(--muted)">(optional)</span>'}</td><td>${typeOf(p)}${p.description ? `<br><span style="color:var(--muted)">${esc(p.description)}</span>` : ''}</td></tr>`).join('');
    sections.push(`<section class="topic" id="${t.name}">
<div class="topic-head"><h2>${t.name}</h2><span class="mono" style="color:var(--muted)">key: ${t.key}</span></div>
<div class="topic-flow"><span class="pill bank">${esc(t.from)}</span><span class="arrow" aria-hidden="true">→</span><span class="pill topic-pill">${t.name}</span><span class="arrow" aria-hidden="true">→</span>${t.to.map((x) => `<span class="pill bank">${esc(x)}</span>`).join('')}</div>
<p>${esc(t.why)}</p>
<div class="table-wrap"><table class="fields"><thead><tr><th>Payload field</th><th>Type</th></tr></thead><tbody>${rows}</tbody></table></div>
<details class="raw"><summary>Show the full JSON Schema</summary>${code({ src: JSON.stringify(schema, null, 2), lang: 'json', title: `docs/events/${t.name}.schema.json` })}</details>
</section>`);
  }
  const body = `<div class="frame">
<div class="page-head"><p class="eyebrow"><span class="chip">Reference</span></p><h1>The events</h1>
<p class="lede">Five topics carry news between services. Each one has a single producer, a key that keeps related events in order, and a fixed schema.</p></div>
<div class="article">
${envelopeFigure()}
<p>The key decides which partition an event lands in. Events with the same key stay in order, so every event about one card arrives in the order it happened. Lessons in the Events module explain topics, partitions and keys step by step.</p>
<hr>
${sections.join('\n')}
<section class="topic" id="dead-letters"><div class="topic-head"><h2>Dead-letter topics</h2></div>
<p>When a consumer cannot read an event at all (it fails the schema, or has an unknown version), it tries 3 times and then moves the event to a dead-letter topic, with the original topic, partition, offset and error attached. That keeps one broken event from blocking every event behind it.</p>
<ul>${dlqs.map((d) => `<li><code>${d.name}</code>: ${esc(d.why)}</li>`).join('')}</ul></section>
</div></div>`;
  return page({ title: 'Events · CardVault Learn', active: 'events', body });
}
