// The suite browser: every file of the API suite, with Run buttons for the tests.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { page } from '../../src/layout.mjs';
import { esc, highlight, runButton, nodeFile } from '../../src/components.mjs';
import { lessonUrl } from '../site.mjs';

const SUITE_ROOT = fileURLToPath(new URL('../../data/suite/tests/api/', import.meta.url));

// Root files in reading order, then the folders.
const ROOT_ORDER = ['README.md', 'requirements.txt', 'pytest.ini', 'config.py', 'conftest.py', 'helpers.py'];
const SKIP = new Set(['.gitignore', '__pycache__', '.pytest_cache', '.venv']);
const LANGS = { '.py': 'python', '.ini': 'ini', '.txt': 'text', '.md': 'text' };

/** Every file under tests/api, as suite paths like tests/api/tests/test_cards.py. */
export function suiteFiles() {
  const walk = (dir) => readdirSync(dir).filter((n) => !SKIP.has(n)).flatMap((n) => {
    const full = path.join(dir, n);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
  const rel = walk(SUITE_ROOT).map((f) => `tests/api/${path.relative(SUITE_ROOT, f).split(path.sep).join('/')}`);
  const rank = (p) => {
    const name = p.slice('tests/api/'.length);
    const i = ROOT_ORDER.indexOf(name);
    if (i >= 0) return [0, String(i).padStart(2, '0')];
    return [1, name];
  };
  return rel.sort((a, b) => {
    const [ga, ka] = rank(a), [gb, kb] = rank(b);
    return ga - gb || ka.localeCompare(kb);
  });
}

/** The test functions in a suite test file, in file order. */
export function testsIn(suitePath) {
  const src = readFileSync(path.join(SUITE_ROOT, suitePath.slice('tests/api/'.length)), 'utf8');
  return [...src.matchAll(/^def (test_\w+)\(/gm)].map((m) => m[1]);
}

export const isTestFile = (p) => /^tests\/api\/tests\/test_\w+\.py$/.test(p);

function fileSection(p) {
  const full = path.join(SUITE_ROOT, p.slice('tests/api/'.length));
  const ext = path.extname(p);
  const head = `<div class="code-head"><span>${esc(p)}</span><span>${esc(LANGS[ext] || 'file')}</span></div>`;
  if (!LANGS[ext]) {
    const size = statSync(full).size;
    return `<section class="sf" data-path="${esc(p)}"><div class="code">${head}<p class="sf-binary">A small file the upload tests send (${size} bytes). It is not text, so it is not shown.</p></div></section>`;
  }
  let src = readFileSync(full, 'utf8').replace(/\s+$/, '');
  // The local test key and database password are not shown on the site.
  src = src.replace(/(TEST_KEY = os\.getenv\("TEST_KEY", )"[^"]*"\)/, '$1"…")')
    .replace(/(DB_READONLY_PASSWORD = os\.getenv\("DB_READONLY_PASSWORD", )"[^"]*"\)/, '$1"…")');
  let runs = '';
  if (isTestFile(p)) {
    const tests = testsIn(p);
    const items = tests.map((t) => `<li><code>${esc(t)}</code>${runButton(`${nodeFile(p)}::${t}`, 'Run')}</li>`).join('');
    runs = `<div class="sf-tests run-host"><div class="sf-tests-head"><b>${tests.length} test${tests.length === 1 ? '' : 's'} in this file</b>${runButton(nodeFile(p), 'Run the whole file')}</div><ul>${items}</ul></div>`;
  }
  return `<section class="sf" data-path="${esc(p)}">${runs}<div class="code wide-ok">${head}<pre><code>${highlight(src, LANGS[ext])}</code></pre></div></section>`;
}

function treeNav(files) {
  let lastDir = '';
  return files.map((p) => {
    const rel = p.slice('tests/api/'.length);
    const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/') + 1) : '';
    const name = rel.slice(dir.length);
    let out = '';
    if (dir !== lastDir) {
      // Print each folder level that starts here.
      const parts = dir.split('/').filter(Boolean);
      const prev = lastDir.split('/').filter(Boolean);
      parts.forEach((part, i) => {
        if (prev[i] !== part) out += `<li class="st-dir" style="--d:${i}">${esc(part)}/</li>`;
      });
      lastDir = dir;
    }
    const depth = dir.split('/').filter(Boolean).length;
    return `${out}<li style="--d:${depth}"><a href="#${esc(p)}">${esc(name)}</a></li>`;
  }).join('');
}

export function suitePage() {
  const files = suiteFiles();
  const body = `<div class="frame suite-frame">
<div class="page-head">
<p class="eyebrow"><span class="chip">API suite</span><span>Python and pytest</span></p>
<h1>The suite, file by file</h1>
<p class="lede">Every file of the API test suite that the Python lessons teach. Test files list their tests with a Run button, which runs that test on the live app and opens a panel with every API call it made, request and response. Start from <a href="${lessonUrl('py-framework-map')}">the framework map</a> if you want each file’s job first.</p>
</div>
<div class="suite">
<nav class="suite-tree" aria-label="Suite files"><p class="st-root">tests/api/</p><ul>${treeNav(files)}</ul></nav>
<div class="suite-files">${files.map(fileSection).join('')}</div>
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
  return page({ title: 'The API suite · CardVault Learn', active: 'suite', body, scripts });
}
