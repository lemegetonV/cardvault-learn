import { page } from '../../src/layout.mjs';
import { esc } from '../../src/components.mjs';
import { serviceMap } from '../diagrams/map.mjs';
import { components, topics } from '../services.mjs';
import { lessonUrl, allLessons } from '../site.mjs';

const lessonTitle = Object.fromEntries(allLessons().map((l) => [l.id, l]));

function detail(c) {
  const list = (title, items) => items && items.length
    ? `<h3>${title}</h3><ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '';
  const code = (s) => `<code>${esc(s)}</code>`;
  const kind = c.kind === 'mock' ? 'Mock · not under test' : c.kind === 'bank' ? 'Bank service · under test' : 'Outside the bank';
  const lessons = (c.lessons || []).map((id) => lessonTitle[id]).filter((l) => l && l.ready)
    .map((l) => `<a href="${lessonUrl(l.id)}">${esc(l.title)}</a>`);
  return `<p class="kind">${kind}${c.port ? ` · port ${c.port}` : ''}</p><h2>${esc(c.name)}</h2>`
    + `<p>${esc(c.job)}</p>`
    + (c.owns ? `<h3>Keeps</h3><p>${esc(c.owns)}</p>` : '')
    + list('Main endpoints', (c.serves || []).map(code))
    + list('Sends events', (c.sends || []).map((t) => `<a href="/events/#${t}">${code(t)}</a>`))
    + list('Listens for events', (c.receives || []).map((t) => `<a href="/events/#${t}">${code(t)}</a>`))
    + list('Also talks to', (c.talksTo || []).map(esc))
    + (c.spec ? `<h3>API</h3><p><a href="/apis/${c.docs}/">Open the ${esc(c.name)} API reference</a></p>` : '')
    + list('Learn more', lessons)
    + `<p style="margin-top:18px"><button type="button" class="btn" data-clear>Show everything</button></p>`;
}

export function mapPage() {
  const info = Object.fromEntries(components.map((c) => [c.id, detail(c)]));
  info.postgres = `<p class="kind">Infrastructure</p><h2>Postgres</h2><p>One Postgres 16 server holds a separate database for each service, plus a small <code>testsupport</code> database for the shared clock. No service can read another service’s tables, so data moves between services only through APIs and events.</p><p style="margin-top:18px"><button type="button" class="btn" data-clear>Show everything</button></p>`;
  info.redpanda = `<p class="kind">Infrastructure</p><h2>Redpanda</h2><p>A Kafka-compatible message broker. Every gold arrow on the map is an event that travels through it. It keeps five topics and two dead-letter topics.</p><h3>Topics</h3><ul>${topics.map((t) => `<li><a href="/events/#${t.name}"><code>${t.name}</code></a></li>`).join('')}</ul><p style="margin-top:18px"><button type="button" class="btn" data-clear>Show everything</button></p>`;

  const picks = ['web', 'auth', 'profile', 'card', 'enrollment', 'wallet-txn', 'network', 'operator', 'postgres', 'redpanda']
    .map((id) => `<button type="button" data-pick="${id}">${esc(components.find((c) => c.id === id)?.name || (id === 'postgres' ? 'Postgres' : 'Redpanda'))}</button>`).join('');

  const legendLine = (cls, dash) => `<svg viewBox="0 0 44 14" aria-hidden="true"><line x1="2" y1="7" x2="42" y2="7" stroke="var(${cls})" stroke-width="2" ${dash ? `stroke-dasharray="${dash}"` : ''}/></svg>`;
  const legendBox = (fill, stroke, dash) => `<svg viewBox="0 0 44 14" aria-hidden="true"><rect x="2" y="1" width="40" height="12" rx="3" fill="var(${fill})" stroke="var(${stroke})" stroke-width="1.5" ${dash ? `stroke-dasharray="${dash}"` : ''}/></svg>`;

  const overview = `<p class="kind">Pick a component</p><h2>Who does what</h2>`
    + `<p>Click any box on the map, or a name below, to see its job, what it keeps, its endpoints and the events it sends and receives. The lines that do not touch it fade away.</p>`
    + `<div class="pick">${picks}</div>`
    + `<div class="legend">`
    + `<div>${legendBox('--accent-soft', '--accent')}Bank service, under test</div>`
    + `<div>${legendBox('--mock-soft', '--mock', '5 4')}Mock, plays an outside company</div>`
    + `<div>${legendLine('--ink-2')}HTTP call, waits for a response</div>`
    + `<div>${legendLine('--event', '6 5')}Event through Redpanda, no waiting</div>`
    + `<div>${legendLine('--accent')}Signed (HMAC) traffic with the operator</div>`
    + `</div>`;

  const body = `<div class="frame">
<div class="page-head"><p class="eyebrow"><span class="chip">Interactive</span></p><h1>The service map</h1>
<p class="lede">Every part of CardVault on one screen. Pick a component to follow its connections.</p></div>
<div class="map-layout">
<div class="map-fig">${serviceMap({ interactive: true })}</div>
<aside class="panel" aria-live="polite">${overview}</aside>
</div>
<script type="application/json" id="map-data">${JSON.stringify(info).replace(/</g, '\\u003c')}</script>
</div>`;
  return page({ title: 'Service map · CardVault Learn', active: 'map', body });
}
