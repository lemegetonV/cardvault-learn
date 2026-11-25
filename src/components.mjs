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

// ---------------------------------------------------------------- The API suite's own files

const SUITE_DIR = new URL('../data/suite/', import.meta.url);
/** What lessons quote from the suite: filled while lessons are built, read by the explorer. */
export const quotes = { lesson: null, files: [], tests: [], problems: [] };

export function suiteFile(rel) {
  const f = new URL(rel, SUITE_DIR);
  return existsSync(f) ? readFileSync(f, 'utf8') : null;
}

/** For an excerpt titled with a suite path: its file, first line, and the tests it shows. */
function locateExcerpt(title, src) {
  const m = title.match(/^((?:tests\/api|\.github\/workflows)\/\S+)/);
  if (!m) return null;
  const rel = m[1];
  const file = suiteFile(rel);
  const where = quotes.lesson || '?';
  if (file === null) { quotes.problems.push(`${where}: ${rel} is not in data/suite`); return null; }
  const lines = file.split('\n');
  const wanted = src.split('\n').map((l) => l.trim()).filter((l) => l && !/^(\.\.\.|…)$/.test(l));
  // Every excerpt line must appear in the file, in order (lines may be left out, never changed).
  let at = -1, first = -1;
  for (const w of wanted) {
    const found = lines.findIndex((l, i) => i > at && l.trim() === w);
    if (found < 0) { quotes.problems.push(`${where}: excerpt line not in ${rel}: ${w}`); break; }
    if (first < 0) first = found;
    at = found;
  }
  quotes.files.push({ lesson: quotes.lesson, path: rel, line: first + 1 });
  for (const t of src.matchAll(/^def (test_\w+)/gm)) {
    const line = lines.findIndex((l) => l.startsWith(`def ${t[1]}(`)) + 1;
    quotes.tests.push({ lesson: quotes.lesson, path: rel, test: t[1], line });
  }
  return { rel, line: first + 1, last: at + 1 };
}

/** Where a suite file is served. Leading dots become underscores, because static hosts often skip dot-files. */
export const suiteRoute = (rel) => `suite/${rel.replace(/(^|\/)\./g, '$1_')}`;
export const suiteUrl = (rel, line, last) => `/${suiteRoute(rel)}/${line ? `#L${line}${last && last > line ? `-L${last}` : ''}` : ''}`;

export function code({ src, lang = 'python', title = '' }) {
  const clean = src.replace(/^\n/, '').replace(/\s+$/, '');
  const body = hljs.highlight(clean, { language: lang }).value;
  const at = title ? locateExcerpt(title, clean) : null;
  const open = at ? `<a class="code-open" href="${suiteUrl(at.rel, at.line, at.last)}">Open in the explorer</a>` : `<span>${esc(lang === 'text' ? '' : lang)}</span>`;
  return `<div class="code wide-ok"><div class="code-head"><span>${esc(title)}</span>${open}</div>`
    + `<pre><code>${body}</code></pre></div>`;
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
