// The framework explorer: every file of the API suite, browsable, linked to the lessons that quote it.
import { readdirSync, statSync } from 'node:fs';
import { page } from '../../src/layout.mjs';
import { esc, highlight, quotes, suiteFile, suiteRoute, suiteUrl } from '../../src/components.mjs';
import { site, allLessons, lessonUrl } from '../site.mjs';

const ROOT = new URL('../../data/suite/', import.meta.url);

/** Every file under data/suite, as repository-relative paths, folders first then files. */
export function suitePaths() {
  const walk = (rel) => {
    const here = new URL(rel, ROOT);
    const names = readdirSync(here).sort((a, b) => a.localeCompare(b));
    const dirs = names.filter((n) => statSync(new URL(n, here)).isDirectory());
    const files = names.filter((n) => !dirs.includes(n));
    return [...dirs.flatMap((d) => walk(`${rel}${d}/`)), ...files.map((f) => `${rel}${f}`)];
  };
  return walk('');
}

function langOf(p) {
  if (p.endsWith('.py')) return 'python';
  if (p.endsWith('.toml')) return 'toml';
  if (p.endsWith('.yml') || p.endsWith('.yaml')) return 'yaml';
  if (/\.env$|\.example$/.test(p)) return 'ini';
  return 'text';
}

/** The first line of a Python module's docstring, as a one-line summary. */
function summary(p) {
  const src = suiteFile(p) || '';
  const m = src.match(/^"""(.+?)(?:"""|\n)/);
  return m ? m[1].replace(/``/g, '').replace(/\.$/, '') : '';
}

const lessonTitle = (() => {
  const all = Object.fromEntries(allLessons().map((l) => [l.id, l]));
  return (id) => all[id];
})();

/** Which lessons quote a file, in lesson order. */
function lessonsFor(p) {
  const order = allLessons().map((l) => l.id);
  const ids = new Set(quotes.files.filter((q) => q.path === p).map((q) => q.lesson));
  return order.filter((id) => ids.has(id)).map(lessonTitle);
}

const short = (p) => p.replace(/^tests\/api\//, '');

function tree(paths, current) {
  // Nested <details> per folder; the current file's folders start open.
  const root = {};
  for (const p of paths) {
    const parts = short(p).split('/');
    let node = root;
    for (const d of parts.slice(0, -1)) node = node[d] ||= {};
    (node['\0files'] ||= []).push(p);
  }
  const render = (node, prefix) => {
    const dirs = Object.keys(node).filter((k) => k !== '\0files');
    const out = dirs.map((d) => {
      const path = `${prefix}${d}/`;
      const open = current && short(current).startsWith(path) ? ' open' : '';
      return `<li><details${open}><summary>${esc(d)}/</summary><ul>${render(node[d], path)}</ul></details></li>`;
    });
    for (const p of node['\0files'] || []) {
      const name = p.split('/').pop();
      const quoted = quotes.files.some((q) => q.path === p) ? '<span class="dot" title="Quoted in a lesson"></span>' : '';
      out.push(`<li><a href="${suiteUrl(p)}"${p === current ? ' aria-current="page"' : ''}>${esc(name)}${quoted}</a></li>`);
    }
    return out.join('');
  };
  return `<ul class="tree">${render(root, '')}</ul>`;
}

function frame(paths, current, main) {
  return `<div class="frame explorer">
<aside class="ex-side" aria-label="Suite files">
<p class="ex-side-head"><a href="/suite/">Suite files</a></p>${tree(paths, current)}</aside>
<div class="ex-main">
<details class="ex-mobile"><summary>All files</summary>${tree(paths, current)}</details>
${main}
</div></div>`;
}

export function suitePages() {
  const paths = suitePaths();
  const pages = [];

  // Index
  const order = allLessons().map((l) => l.id);
  const starts = [...quotes.tests]
    .filter((t) => t.line > 0)
    .sort((a, b) => order.indexOf(a.lesson) - order.indexOf(b.lesson) || a.line - b.line);
  const seen = new Set();
  const startRows = starts.filter((t) => !seen.has(t.path + t.test) && seen.add(t.path + t.test)).map((t) => {
    const l = lessonTitle(t.lesson);
    return `<li><a class="mono" href="${suiteUrl(t.path, t.line)}">${esc(t.test)}</a><span class="where">${esc(short(t.path))}</span><a class="chip-link" href="${lessonUrl(l.id)}">${esc(l.title)}</a></li>`;
  }).join('');
  const framework = paths.filter((p) => p.includes('/src/cardvault_tests/') && !p.includes('/clients/') && !p.includes('/models/') && !p.endsWith('__init__.py'));
  const fwRows = framework.map((p) => `<li><a class="mono" href="${suiteUrl(p)}">${esc(p.split('/').pop())}</a><span>${esc(summary(p))}</span></li>`).join('');
  const testFiles = paths.filter((p) => /\/tests\/.+\/test_\w+\.py$/.test(p));
  const testCount = testFiles.reduce((n, p) => n + ((suiteFile(p) || '').match(/^def test_/gm) || []).length, 0);
  pages.push({ route: 'suite', html: page({
    title: 'The test suite · CardVault Learn',
    description: 'Browse every file of CardVault’s API test suite, linked to the lessons that explain it.',
    active: 'suite',
    body: frame(paths, null, `<div class="page-head ex-head">
<p class="eyebrow"><span class="chip">Explorer</span><span>API test suite at <a href="${site.cardvaultRepo}/tree/${site.suiteCommit}/tests/api">${site.suiteCommit}</a></span></p>
<h1>The test suite, file by file</h1>
<p class="lede">This is the whole API suite the lessons teach: the framework code, the fixtures, the settings and all ${testCount} test functions in ${testFiles.length} files. Open any file from the file list. Files with a gold dot are quoted in a lesson, and each file page says which lessons explain it.</p>
</div>
<h2>Start here</h2>
<p>These are the tests the lessons walk through, in the order they appear. Reading them in this order is the learning path through the suite; everything else follows the same patterns.</p>
<ol class="ex-start">${startRows}</ol>
<h2>The framework, in one list</h2>
<p>The code the tests import lives in <code>src/cardvault_tests/</code>. Each line is the first line of that file’s own description. The <code>clients/</code> folder holds one class per API area and <code>models/</code> the response shapes.</p>
<ul class="ex-files">${fwRows}</ul>`),
  }) });

  // One page per file
  for (const p of paths) {
    const src = suiteFile(p).replace(/\n$/, '');
    const lines = highlight(src, langOf(p)).split('\n');
    // Keep open spans balanced per line, so each line can stand alone in the gutter layout.
    let open = [];
    const rows = lines.map((ln, i) => {
      const prefix = open.join('');
      for (const m of ln.matchAll(/<span[^>]*>|<\/span>/g)) {
        if (m[0] === '</span>') open.pop(); else open.push(m[0]);
      }
      const html = prefix + ln + '</span>'.repeat(open.length);
      return `<tr id="L${i + 1}"><td class="ln"><a href="#L${i + 1}">${i + 1}</a></td><td class="lc">${html || ' '}</td></tr>`;
    }).join('');
    const taught = lessonsFor(p);
    const taughtHtml = taught.length
      ? `<p class="ex-taught"><span>Explained in</span>${taught.map((l) => `<a class="chip-link" href="${lessonUrl(l.id)}">${esc(l.title)}</a>`).join('')}</p>`
      : '';
    const tests = [...src.matchAll(/^def (test_\w+)/gm)].map((m) => {
      const line = src.slice(0, m.index).split('\n').length;
      const q = quotes.tests.find((t) => t.path === p && t.test === m[1]);
      return `<li><a class="mono" href="#L${line}">${esc(m[1])}</a>${q ? `<a class="badge" href="${lessonUrl(q.lesson)}">lesson</a>` : ''}</li>`;
    });
    const testsHtml = tests.length
      ? `<details class="ex-tests"${tests.length <= 12 ? ' open' : ''}><summary>${tests.length} test${tests.length > 1 ? 's' : ''} in this file</summary><ul>${tests.join('')}</ul></details>`
      : '';
    const crumbs = p.split('/');
    pages.push({ route: suiteRoute(p), html: page({
      title: `${crumbs.at(-1)} · The test suite · CardVault Learn`,
      description: `${p} in CardVault’s API test suite.`,
      active: 'suite',
      body: frame(paths, p, `<p class="ex-crumbs mono">${crumbs.map(esc).join('<span>/</span>')}</p>
${taughtHtml}${testsHtml}
<div class="code ex-code wide-ok"><div class="code-head"><span>${esc(crumbs.at(-1))} · ${src.split('\n').length} lines</span><a class="code-open" href="${site.cardvaultRepo}/blob/${site.suiteCommit}/${p}">On GitHub</a></div>
<table class="ex-lines"><tbody>${rows}</tbody></table></div>`),
    }) });
  }
  return pages;
}
