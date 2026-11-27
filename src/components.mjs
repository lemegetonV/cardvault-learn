// Building blocks that lessons and pages use. Each returns an HTML string.
import hljs from 'highlight.js/lib/core';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import http from 'highlight.js/lib/languages/http';
import sql from 'highlight.js/lib/languages/sql';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import plaintext from 'highlight.js/lib/languages/plaintext';
import ini from 'highlight.js/lib/languages/ini';
import typescript from 'highlight.js/lib/languages/typescript';


import { readFileSync, existsSync } from 'node:fs';

hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('http', http);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('text', plaintext);
hljs.registerLanguage('toml', ini);
hljs.registerLanguage('ini', ini);
hljs.registerLanguage('typescript', typescript);

export const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline markup for short strings: `code` and **bold**. Input is trusted lesson text. */
export const md = (s) => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

// ---------------------------------------------------------------- SVG primitives

/** A polyline with an arrowhead at its last point. points: [[x,y], ...] */
export function arrow(points, cls = 'ln', head = 'ah', { halo = false, start = false } = {}) {
  const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const tip = (a, b) => {
    const [x1, y1] = a, [x2, y2] = b;
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const L = 9, W = 4.5;
    const bx = x2 - L * Math.cos(ang), by = y2 - L * Math.sin(ang);
    const px = -Math.sin(ang) * W, py = Math.cos(ang) * W;
    return `<polygon class="${head}" points="${x2},${y2} ${(bx + px).toFixed(1)},${(by + py).toFixed(1)} ${(bx - px).toFixed(1)},${(by - py).toFixed(1)}"/>`;
  };
  const n = points.length;
  return (halo ? `<path class="ln-halo" d="${d}"/>` : '')
    + `<path class="${cls}" d="${d}"/>`
    + tip(points[n - 2], points[n - 1])
    + (start ? tip(points[1], points[0]) : '');
}

/** A labelled box. kind: bank | mock | event | plain | stop | (default) */
export function box(x, y, w, h, label, { kind = '', sub = '', rx = 10, cls = 't-lg' } = {}) {
  const k = kind ? `box-${kind}` : 'box';
  const cy = sub ? y + h / 2 - 3 : y + h / 2 + 5;
  return `<rect class="${k}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`
    + `<text class="${cls}" x="${x + w / 2}" y="${cy}" text-anchor="middle">${esc(label)}</text>`
    + (sub ? `<text class="t-mono" x="${x + w / 2}" y="${cy + 17}" text-anchor="middle">${esc(sub)}</text>` : '');
}

export const text = (x, y, s, cls = 't-sm', anchor = 'middle') =>
  `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(s)}</text>`;

export const svg = (w, h, label, body) =>
  `<svg class="d" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;

// ---------------------------------------------------------------- Page blocks

export function figure({ svg: s, caption, size = 'wide', narrow = false }) {
  return `<figure class="${size === 'wide' ? 'wide' : ''}"><div class="fig${narrow ? ' narrow' : ''}">${s}</div>`
    + (caption ? `<figcaption>${caption}</figcaption>` : '') + `</figure>`;
}

export function callout(kind, label, html) {
  return `<aside class="callout ${kind}"><span class="label">${esc(label)}</span>${html}</aside>`;
}
export const keyIdea = (html, label = 'Key idea') => callout('key', label, html);
export const testerEye = (html) => callout('tester', 'Through a tester’s eyes', html);
export const realWorld = (html) => callout('real', 'In a real bank', html);

// ---------------------------------------------------------------- Code, screenshots, interview corner

// Excerpts titled with a suite path (tests/api/..., tests/perf/... or tests/ui/...) are checked against the copy in data/suite/.
export const excerptProblems = [];
const SUITE = new URL('../data/suite/', import.meta.url);

function checkExcerpt(title, src) {
  const m = title.match(/^(tests\/(?:api|perf|ui)\/\S+)/);
  if (!m) return;
  const file = new URL(m[1], SUITE);
  if (!existsSync(file)) { excerptProblems.push(`${m[1]} is not in data/suite`); return; }
  const lines = readFileSync(file, 'utf8').split('\n');
  let at = -1;
  for (const want of src.split('\n').map((l) => l.trim()).filter((l) => l && l !== '...')) {
    const found = lines.findIndex((l, i) => i > at && l.trim() === want);
    if (found < 0) { excerptProblems.push(`excerpt line not in ${m[1]}: ${want}`); return; }
    at = found;
  }
}

/** A code block. title names the file it comes from; note is a short line on the right. */
export function code({ src, lang = 'python', title = '', note = '' }) {
  const clean = src.replace(/^\n/, '').replace(/\s+$/, '');
  checkExcerpt(title, clean);
  const body = hljs.highlight(clean, { language: lang }).value;
  // A suite file gets a link to the full file, and a test file a Run button per test shown.
  const suite = title.match(/^(tests\/api\/\S+)/);
  let right = esc(note || (lang === 'text' ? '' : lang));
  let runs = '';
  if (suite) {
    right = `<a href="/suite/#${esc(suite[1])}">Full file</a>`;
    if (/^tests\/api\/tests\/test_\w+\.py$/.test(suite[1])) {
      const names = [...clean.matchAll(/^def (test_\w+)\(/gm)].map((m) => m[1]);
      runs = names.map((t) => runButton(`${nodeFile(suite[1])}::${t}`, names.length > 1 ? `Run ${t}` : 'Run this test on the live app')).join('');
    }
  }
  return `<div class="code wide-ok"><div class="code-head"><span>${esc(title)}</span><span>${right}</span></div>`
    + `<pre><code>${body}</code></pre>${runs ? `<div class="code-runs">${runs}</div>` : ''}</div>`;
}

/**
 * A folder tree with a one-line job for each entry.
 * rows: [[name, depth, job], ...]; a name ending in / is a folder.
 */
export function tree(rows, title = '') {
  const body = rows.map(([name, depth, job]) => `<div class="tree-row" style="--d:${depth}">`
    + `<span class="tree-name${name.endsWith('/') ? ' dir' : ''}">${esc(name)}</span>`
    + `<span class="tree-job">${md(job || '')}</span></div>`).join('');
  return `<div class="tree wide-ok">${title ? `<div class="code-head"><span>${esc(title)}</span><span></span></div>` : ''}<div class="tree-body">${body}</div></div>`;
}

/** A screenshot of the real app, from content/images/. */
export function shot({ src, alt, caption = '', phone = false }) {
  return `<figure class="shot${phone ? ' phone' : ' wide'}"><div class="shot-frame"><img src="/images/${esc(src)}" alt="${esc(alt)}" loading="lazy"></div>`
    + (caption ? `<figcaption>${caption}</figcaption>` : '') + `</figure>`;
}

/**
 * "How to say it in an interview": a short spoken answer, then likely questions
 * whose model answers open on demand. qa: [[question, answerHtml], ...]
 */
/** A block that stays closed until the reader opens it: a hint or a model solution. */
export function reveal(label, html, kind = 'hint') {
  return `<details class="reveal ${kind}"><summary>${md(label)}</summary><div class="reveal-body">${html}</div></details>`;
}

/** An exercise brief: what to build, before any hint. */
export const task = (html, label = 'Your task') => callout('task', label, html);

export const interviewLog = [];
export const buildContext = { lesson: null };

export function interview({ say, qa = [] }) {
  if (buildContext.lesson) interviewLog.push({ lesson: buildContext.lesson, say, qa });
  const qs = qa.map(([q, a]) => `<details class="qa"><summary>${md(q)}</summary><div>${a}</div></details>`).join('');
  return `<section class="interview"><p class="label">How to say it in an interview</p>`
    + `<blockquote class="say">${say}</blockquote>`
    + (qs ? `<p class="label sub">Questions you may get</p>${qs}` : '') + `</section>`;
}

export function highlight(src, lang) {
  return hljs.highlight(src, { language: lang }).value;
}

/** Terminal commands with optional output lines. */
export function terminal(lines, title = 'Terminal') {
  const body = lines.map(([cmd, out]) =>
    `<span class="prompt">$ </span>${esc(cmd)}` + (out ? `\n<span class="out">${esc(out)}</span>` : '')).join('\n');
  return `<div class="code"><div class="code-head"><span>${esc(title)}</span><span>shell</span></div><pre><code>${body}</code></pre></div>`;
}

export function table(head, rows) {
  return `<div class="table-wrap"><table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>`
    + `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${md(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function terms(list) {
  return `<dl class="terms">${list.map(([t, d]) => `<div class="term"><dt>${esc(t)}</dt><dd>${md(d)}</dd></div>`).join('')}</dl>`;
}

export function recap(items) {
  return `<ul class="recap">${items.map((i) => `<li>${md(i)}</li>`).join('')}</ul>`;
}

/** A self-contained multiple-choice question with an explanation. answer is a zero-based index. */
export function check({ q, options, answer, why }) {
  return `<div class="check" data-answer="${answer}"><p class="q">${md(q)}</p><div class="options">`
    + options.map((o, i) => `<button type="button" class="opt" data-i="${i}">${md(o)}</button>`).join('')
    + `</div><div class="why" hidden>${why}</div></div>`;
}

// ---------------------------------------------------------------- Step-through sequence diagram

/**
 * actors: [{ id, label, kind }]   kind: bank | mock | plain | event
 * steps:  [{ from, to, label, note, kind }]  kind: call | reply | event | self
 */
export function sequence({ id, label, actors, steps, caption }) {
  const colW = 168, left = 20, headH = 46, top = 16, rowH = 54, firstRow = top + headH + 40;
  const cx = Object.fromEntries(actors.map((a, i) => [a.id, left + colW * i + colW / 2]));
  let W = left * 2 + colW * actors.length;
  for (const s of steps) {
    if (s.kind === 'self' || s.from === s.to) W = Math.max(W, cx[s.from] + 44 + s.label.length * 6.8 + 12);
  }
  W = Math.ceil(W);
  const H = firstRow + rowH * steps.length + 8;
  let body = '';
  for (const a of actors) {
    const x = cx[a.id];
    body += `<line class="life" x1="${x}" y1="${top + headH}" x2="${x}" y2="${H - 6}"/>`;
    body += box(x - colW / 2 + 10, top, colW - 20, headH, a.label, { kind: a.kind || 'plain', cls: 't-md' });
  }
  steps.forEach((s, i) => {
    const y = firstRow + rowH * i;
    const kind = s.kind || 'call';
    const cls = kind === 'event' ? 'ln-event' : kind === 'reply' ? 'ln-mock' : 'ln';
    const head = kind === 'event' ? 'ah-event' : kind === 'reply' ? 'ah-mock' : 'ah';
    let g = '';
    if (kind === 'self' || s.from === s.to) {
      const x = cx[s.from];
      g += arrow([[x, y - 8], [x + 34, y - 8], [x + 34, y + 12], [x + 4, y + 12]], 'ln', 'ah');
      g += text(x + 44, y + 7, s.label, 't-sm', 'start');
      g += numDot(x - 16, y + 2, i + 1);
    } else {
      const x1 = cx[s.from], x2 = cx[s.to];
      const dir = x2 > x1 ? 1 : -1;
      g += arrow([[x1 + dir * 4, y], [x2 - dir * 4, y]], cls, head);
      g += text((x1 + x2) / 2, y - 9, s.label, 't-sm');
      g += numDot(x1 - dir * 16, y, i + 1);
    }
    body += `<g class="msg" data-step="${i}">${g}</g>`;
  });
  const svgStr = svg(W, H, label, body);
  const list = steps.map((s) => `<li>${md(s.note)}</li>`).join('');
  return `<figure class="stepper wide" id="${id}"><div class="fig">${svgStr}</div>`
    + `<div class="controls"><button type="button" class="primary" data-act="next">Start</button>`
    + `<button type="button" data-act="prev" disabled>Back</button><button type="button" data-act="all">Show all</button>`
    + `<span class="count">${steps.length} steps</span></div>`
    + `<div class="note" aria-live="polite"><b>How to use this</b>Press Start to walk through the ${steps.length} messages one at a time. Each step explains what travels and why.</div>`
    + `<ol class="steps-list">${list}</ol>`
    + `<script type="application/json" class="steps-data">${JSON.stringify(steps.map((s) => ({ label: s.label, note: md(s.note) }))).replace(/</g, '\\u003c')}</script>`
    + (caption ? `<figcaption>${caption}</figcaption>` : '') + `</figure>`;
}

function numDot(x, y, n) {
  return `<circle class="num" cx="${x}" cy="${y}" r="9" stroke-width="1.5"/><text class="t-mono num-t" x="${x}" y="${y + 4}" text-anchor="middle" style="font-size:10px">${n}</text>`;
}

// ---------------------------------------------------------------- Live lab (talks to the real app through /vm/*)

export const LAB_SERVICES = [
  ['auth', 'Login · auth-service'],
  ['cards', 'Cards · card-service'],
  ['wallet', 'Wallet · enrollment-service'],
  ['transactions', 'Transactions · wallet-txn-service'],
  ['profile', 'Profile · profile-service'],
];
const LAB_METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];

/** One editable request: the form inside a tryIt panel and on the lab page. */
export function labRequest({ label = '', note = '', method = 'GET', service = 'auth', path = '/', headers = {}, body = '', save = {} }, n = 0) {
  const headerText = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n');
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  const rows = (s, min) => Math.max(min, s.split('\n').length);
  const opts = (list, current) => list.map(([v, l]) => `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${esc(l)}</option>`).join('');
  return `<div class="tryit-req" data-save="${esc(JSON.stringify(save))}">`
    + (label ? `<p class="tr-label">${n ? `<b>${n}</b>` : ''}<span>${md(label)}</span></p>` : '')
    + (note ? `<p class="tr-note">${md(note)}</p>` : '')
    + `<div class="tr-line"><select class="tr-method" aria-label="Method">${opts(LAB_METHODS.map((m) => [m, m]), method)}</select>`
    + `<select class="tr-service" aria-label="Service">${opts(LAB_SERVICES, service)}</select>`
    + `<input class="tr-path" aria-label="Path" value="${esc(path)}" spellcheck="false" autocomplete="off"></div>`
    + `<label class="tr-field"><span>Headers</span><textarea class="tr-headers" rows="${rows(headerText, 1)}" spellcheck="false" placeholder="Name: value, one per line">${esc(headerText)}</textarea></label>`
    + `<label class="tr-field tr-body-wrap"><span>Body</span><textarea class="tr-body" rows="${rows(bodyText, 2)}" spellcheck="false">${esc(bodyText)}</textarea></label>`
    + `<div class="tr-actions"><button type="button" class="btn primary tr-send" disabled>Send</button><button type="button" class="link-btn tr-restore">Undo my edits</button></div>`
    + `<div class="tr-result" hidden aria-live="polite"></div></div>`;
}

/**
 * "Try it": real requests to the live CardVault, editable before sending.
 * requests: [{ label, note, method, service, path, headers, body, save }]
 * A login response saves {{token}}; save: { name: 'path.in.json' } saves more values.
 */
export function tryIt({ title = 'Try it on the live app', requests, foot = '' }) {
  return `<div class="tryit wide-ok" data-tryit><div class="code-head"><span>${esc(title)}</span><span class="tryit-vars"></span></div>`
    + `<div class="tryit-body">${requests.map((r, i) => labRequest(r, requests.length > 1 ? i + 1 : 0)).join('')}</div>`
    + `<p class="tryit-foot">${foot ? `${foot} ` : ''}These are real requests to CardVault on the server. If a demo changes something, <a href="/lab/">the Live lab page</a> puts the app back to its starting data.</p></div>`;
}

/** The pytest node id of a suite file, as the runner wants it (relative to tests/api). */
export const nodeFile = (suitePath) => suitePath.replace(/^tests\/api\//, '');

/** A button that runs one test (or a whole file) on the live app and shows its steps in the side panel. */
export function runButton(nodeId, label = 'Run on the live app') {
  return `<button type="button" class="run-btn" data-run="${esc(nodeId)}" disabled title="pytest ${esc(nodeId)}">${runIcon}${esc(label)}</button>`;
}
/** A button that runs the suite's small Locust load test on the live app, results in the side panel. */
export function perfButton(label = 'Run the load test on the live app') {
  return `<button type="button" class="run-btn" data-perf disabled title="locust --headless --users 5 --run-time 20s">${runIcon}${esc(label)}</button>`;
}
const runIcon = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 3v10l8-5z" fill="currentColor"/></svg>';
