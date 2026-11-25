import { readFileSync } from 'node:fs';
import { page } from '../../src/layout.mjs';
import { esc } from '../../src/components.mjs';
import { components } from '../services.mjs';

const withSpec = components.filter((c) => c.spec);
const stageDocs = (c) => `https://${c.docs}-docs.140-245-206-220.sslip.io/docs`;
const localDocs = (c) => `http://localhost:${c.port}/docs`;

function countOps(spec) {
  const d = JSON.parse(readFileSync(new URL(`../../data/openapi/${spec}.json`, import.meta.url)));
  let all = 0, test = 0;
  for (const [p, ops] of Object.entries(d.paths)) {
    const n = Object.keys(ops).length;
    all += n;
    if (p.startsWith('/test') || p.startsWith('/v1/test')) test += n;
  }
  return { all, test };
}

export function apisPage() {
  const cards = withSpec.map((c) => {
    const n = countOps(c.spec);
    return `<div class="api-card${c.kind === 'mock' ? ' mock' : ''}">
<span class="meta">${c.kind === 'mock' ? 'MOCK' : 'BANK SERVICE'} · PORT ${c.port} · ${n.all} OPERATIONS</span>
<h3>${esc(c.name)}</h3><p>${esc(c.job)}</p>
<div class="links"><a href="/apis/${c.docs}/">Read the reference</a><a href="${stageDocs(c)}">Stage docs</a><a href="${localDocs(c)}">Your local docs</a></div>
</div>`;
  }).join('');
  const body = `<div class="frame">
<div class="page-head"><p class="eyebrow"><span class="chip">Reference</span></p><h1>The APIs</h1>
<p class="lede">Each service describes its own API in an OpenAPI document. Here you can read all seven, generated from CardVault’s code.</p></div>
<div class="article" style="margin-bottom:36px">
<aside class="callout key"><span class="label">Where you can send requests</span>
<p>The reference on this site is for reading. It cannot send requests, because a public website is not allowed to call services running on your computer.</p>
<p>To try requests, run CardVault locally and open <strong>Your local docs</strong>: each service serves the same reference at <code>localhost:&lt;port&gt;/docs</code>, where <strong>Try it out</strong> works. <strong>Stage docs</strong> opens the hosted copy on the stage server, which is read-only.</p></aside>
</div>
<div class="api-grid">${cards}</div>
</div>`;
  return page({ title: 'APIs · CardVault Learn', active: 'apis', body });
}

export function apiPage() {
  return withSpec.map((c) => {
    const tabs = withSpec.map((o) => `<a href="/apis/${o.docs}/"${o.id === c.id ? ' aria-current="page"' : ''}>${esc(o.name)}</a>`).join('');
    const body = `<div class="frame">
<div class="page-head"><p class="eyebrow"><a href="/apis/">APIs</a><span>${c.kind === 'mock' ? 'Mock' : 'Bank service'} · port ${c.port}</span></p>
<h1>${esc(c.name)}</h1><p class="lede">${esc(c.job)}</p>
<div class="cta"><a class="btn" href="${stageDocs(c)}">Stage docs</a><a class="btn" href="${localDocs(c)}">Your local docs (Try it out)</a><a class="btn" href="/openapi/${c.spec}.json">openapi.json</a></div></div>
<nav class="tabs" aria-label="Services">${tabs}</nav>
<div class="swagger-wrap"><div id="swagger"><p style="padding:16px">Loading the API reference…</p></div></div>
</div>`;
    const head = `<link rel="stylesheet" href="/vendor/swagger-ui/swagger-ui.css">`;
    const scripts = `<script src="/vendor/swagger-ui/swagger-ui-bundle.js"></script>
<script>
window.addEventListener('DOMContentLoaded', function () {
  SwaggerUIBundle({
    url: '/openapi/${c.spec}.json',
    dom_id: '#swagger',
    supportedSubmitMethods: [],
    docExpansion: 'list',
    defaultModelsExpandDepth: 0,
    deepLinking: true,
    tryItOutEnabled: false
  });
});
</script>`;
    return { slug: c.docs, html: page({ title: `${c.name} API · CardVault Learn`, active: 'apis', body, head, scripts }) };
  });
}
