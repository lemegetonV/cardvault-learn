// The suite browsers: every file of the API suite (with Run buttons) and of the Playwright suite.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { page } from '../../src/layout.mjs';
import { esc, highlight, runButton, nodeFile } from '../../src/components.mjs';
import { lessonUrl } from '../site.mjs';

const DATA = fileURLToPath(new URL('../../data/suite/', import.meta.url));

// The two suites. root is the folder inside data/suite; url is where its browser lives.
export const SUITES = {
  api: {
    root: 'tests/api', url: '/suite/', route: 'suite',
    order: ['README.md', 'requirements.txt', 'pytest.ini', 'config.py', 'conftest.py', 'helpers.py'],
    langs: { '.py': 'python', '.ini': 'ini', '.txt': 'text', '.md': 'text' },
    tab: 'API suite · pytest', chip: 'API suite', lang: 'Python and pytest', title: 'The API suite · CardVault Learn',
    lede: `Every file of the API test suite that the Python lessons teach. Test files list their tests with a Run button, which runs that test on the live app and opens a panel with every API call it made, request and response. Start from <a href="${lessonUrl('py-framework-map')}">the framework map</a> if you want each file’s job first.`,
  },
  ui: {
    root: 'tests/ui', url: '/suite/ui/', route: 'suite/ui',
    order: ['README.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'playwright.config.ts', 'visual.config.ts', 'config.ts', 'fixtures.ts'],
    langs: { '.ts': 'typescript', '.json': 'json', '.md': 'text' },
    tab: 'UI suite · Playwright', chip: 'UI suite', lang: 'TypeScript and Playwright', title: 'The Playwright suite · CardVault Learn',
    lede: `Every file of the Playwright suite that the UI testing lessons teach. <code>learn/</code> holds one small spec per Part 1 lesson; <code>pages/</code>, <code>components/</code>, <code>api/</code>, <code>fixtures.ts</code> and <code>tests/</code> are the framework from Part 2. Start from <a href="${lessonUrl('pw-framework-map')}">the framework map</a> if you want each file’s job first. These tests run on your own computer with <code>npx playwright test</code>; the site shows their code.`,
  },
};

const SKIP = new Set(['.gitignore', '__pycache__', '.pytest_cache', '.venv', 'node_modules', '.auth', 'test-results', 'playwright-report']);

const fullPath = (p) => path.join(DATA, p);

/** Every file of a suite, as paths like tests/api/tests/test_cards.py, root files first. */
export function suiteFiles(s = SUITES.api) {
  const base = fullPath(s.root);
  const walk = (dir) => readdirSync(dir).filter((n) => !SKIP.has(n)).flatMap((n) => {
    const full = path.join(dir, n);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
  const rel = walk(base).map((f) => `${s.root}/${path.relative(base, f).split(path.sep).join('/')}`);
  const rank = (p) => {
    const name = p.slice(s.root.length + 1);
    const i = s.order.indexOf(name);
    if (i >= 0) return [0, String(i).padStart(2, '0')];
    // Inside each folder, its files come before its subfolders.
    const parts = name.split('/');
    return [1, parts.map((x, j) => (j === parts.length - 1 ? '0' : '1') + x).join('/')];
  };
  return rel.sort((a, b) => {
    const [ga, ka] = rank(a), [gb, kb] = rank(b);
    return ga - gb || ka.localeCompare(kb);
  });
}

/** The test functions in an API suite test file, in file order. */
export function testsIn(suitePath) {
  return [...readFileSync(fullPath(suitePath), 'utf8').matchAll(/^def (test_\w+)\(/gm)].map((m) => m[1]);
}

export const isTestFile = (p) => /^tests\/api\/tests\/test_\w+\.py$/.test(p);

function fileSection(s, p) {
  const full = fullPath(p);
  const ext = path.extname(p);
  const lang = s.langs[ext];
  const head = `<div class="code-head"><span>${esc(p)}</span><span>${esc(lang || (ext === '.png' ? 'image' : 'file'))}</span></div>`;
  if (ext === '.png') {
    const what = p.includes('-snapshots/')
      ? (p.includes('credit-card') ? 'The saved screenshot (baseline) that the visual test compares the card with. The pink bar is the masked part, which the comparison ignores.' : 'The saved screenshot (baseline) that the visual test compares the page with.')
      : 'A small picture that the upload tests attach as a receipt.';
    return `<section class="sf" data-path="${esc(p)}"><div class="code">${head}<figure class="sf-image"><img src="/suite-files/${esc(p)}" alt="${esc(what)}" loading="lazy"><figcaption>${esc(what)}</figcaption></figure></div></section>`;
  }
  if (!lang) {
    const size = statSync(full).size;
    return `<section class="sf" data-path="${esc(p)}"><div class="code">${head}<p class="sf-binary">A small file the upload tests send (${size} bytes). It is not text, so it is not shown.</p></div></section>`;
  }
  let src = readFileSync(full, 'utf8').replace(/\s+$/, '');
  // The local test key and database password are not shown on the site.
  src = src.replace(/(TEST_KEY = os\.getenv\("TEST_KEY", )"[^"]*"\)/, '$1"…")')
    .replace(/(DB_READONLY_PASSWORD = os\.getenv\("DB_READONLY_PASSWORD", )"[^"]*"\)/, '$1"…")')
    .replace(/(TEST_KEY = process\.env\.TEST_KEY \?\? )'[^']*'/, "$1'…'");
  let runs = '';
  if (isTestFile(p)) {
    const tests = testsIn(p);
    const items = tests.map((t) => `<li><code>${esc(t)}</code>${runButton(`${nodeFile(p)}::${t}`, 'Run')}</li>`).join('');
    runs = `<div class="sf-tests run-host"><div class="sf-tests-head"><b>${tests.length} test${tests.length === 1 ? '' : 's'} in this file</b>${runButton(nodeFile(p), 'Run the whole file')}</div><ul>${items}</ul></div>`;
  }
  return `<section class="sf" data-path="${esc(p)}">${runs}<div class="code wide-ok">${head}<pre><code>${highlight(src, lang)}</code></pre></div></section>`;
}

function treeNav(s, files) {
  let lastDir = '';
  return files.map((p) => {
    const rel = p.slice(s.root.length + 1);
    const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/') + 1) : '';
    const name = rel.slice(dir.length);
    let out = '';
    if (dir !== lastDir) {
      // Print each folder level that starts here.
      const parts = dir.split('/').filter(Boolean);
      const prev = lastDir.split('/').filter(Boolean);
      let changed = false;
      parts.forEach((part, i) => {
        if (changed || prev[i] !== part) { changed = true; out += `<li class="st-dir" style="--d:${i}">${esc(part)}/</li>`; }
      });
      lastDir = dir;
    }
    const depth = dir.split('/').filter(Boolean).length;
    return `${out}<li style="--d:${depth}"><a href="#${esc(p)}">${esc(name)}</a></li>`;
  }).join('');
}

/** The image files a suite browser shows, as [suite path, absolute source] pairs, for the build to copy. */
export function suiteImages() {
  return Object.values(SUITES).flatMap((s) => suiteFiles(s).filter((p) => p.endsWith('.png')).map((p) => [p, fullPath(p)]));
}

export function suitePage(key = 'api') {
  const s = SUITES[key];
  const files = suiteFiles(s);
  const tabs = Object.entries(SUITES).map(([k, x]) =>
    `<a href="${x.url}"${k === key ? ' aria-current="page"' : ''}>${esc(x.tab)}</a>`).join('');
  const body = `<div class="frame suite-frame">
<div class="page-head">
<nav class="suite-tabs" aria-label="Suites">${tabs}</nav>
<p class="eyebrow"><span class="chip">${esc(s.chip)}</span><span>${esc(s.lang)}</span></p>
<h1>The suite, file by file</h1>
<p class="lede">${s.lede}</p>
</div>
<div class="suite">
<nav class="suite-tree" aria-label="Suite files"><p class="st-root">${esc(s.root)}/</p><ul>${treeNav(s, files)}</ul></nav>
<div class="suite-files">${files.map((p) => fileSection(s, p)).join('')}</div>
</div>
</div>`;
  const scripts = `<script>
(function () {
  var sections = [].slice.call(document.querySelectorAll('.sf'));
  var links = [].slice.call(document.querySelectorAll('.suite-tree a'));
  if (!sections.length) return;
  document.querySelector('.suite').classList.add('one-file');
  function show() {
    var want = decodeURIComponent(location.hash.slice(1));
    var current = sections.find(function (s) { return s.dataset.path === want; }) || sections[0];
    sections.forEach(function (s) { s.hidden = s !== current; });
    links.forEach(function (a) {
      if (a.getAttribute('href') === '#' + current.dataset.path) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }
  window.addEventListener('hashchange', function () { show(); document.querySelector('.suite').scrollIntoView(); });
  show();
}());
</script>`;
  return page({ title: s.title, active: 'suite', body, scripts });
}
