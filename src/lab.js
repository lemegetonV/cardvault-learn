// The live lab in the browser: "Try it" panels, the reset button and the test run panel.
// They all talk to /vm/*, which the site's Worker forwards to the live CardVault.
// Nothing here runs unless the page has a lab element on it.
(function () {
  const VARS_KEY = 'cv-lab-vars';
  const store = {
    get(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, value); } catch (e) { /* not remembered */ } },
    del(key) { try { sessionStorage.removeItem(key); } catch (e) { /* nothing to do */ } },
  };

  const el = (tag, attrs = {}, ...kids) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const kid of kids) node.append(kid);
    return node;
  };

  // ------------------------------------------------------------ talking to the lab

  // The site's Worker adds the lab's key, so the page needs no password.
  const labFetch = (path, options = {}) => fetch(`/vm/${path}`, options);

  // ------------------------------------------------------------ saved values ({{token}} and friends)

  const loadVars = () => { try { return JSON.parse(store.get(VARS_KEY) || '{}'); } catch (e) { return {}; } };
  let vars = loadVars();
  const saveVars = () => { store.set(VARS_KEY, JSON.stringify(vars)); renderVars(); };

  function renderVars() {
    const names = Object.keys(vars);
    document.querySelectorAll('.tryit-vars').forEach((node) => {
      node.textContent = '';
      if (!names.length) { node.append(el('span', { class: 'muted', text: 'Nothing saved yet' })); return; }
      node.append(el('span', { class: 'muted', text: 'Saved: ' }));
      names.forEach((n) => node.append(el('code', { text: `{{${n}}}`, title: `From ${vars[n].from}` })));
      const clear = el('button', { type: 'button', class: 'link-btn', text: 'Clear' });
      clear.onclick = () => { vars = {}; saveVars(); };
      node.append(clear);
    });
  }

  const pick = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

  function fill(text) {
    const missing = [];
    const out = text.replace(/\{\{(\w+)\}\}/g, (whole, name) => {
      if (vars[name]) return vars[name].value;
      missing.push(name);
      return whole;
    });
    return { out, missing };
  }

  // ------------------------------------------------------------ JSON display

  const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  function jsonHtml(text) {
    let pretty = text;
    try { pretty = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { return escHtml(text); }
    return escHtml(pretty).replace(
      /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (m, str, colon, lit, num) => {
        if (str) return colon ? `<span class="hljs-attr">${str}</span>${colon}` : `<span class="hljs-string">${str}</span>`;
        if (lit) return `<span class="hljs-literal">${lit}</span>`;
        return `<span class="hljs-number">${num}</span>`;
      },
    );
  }

  // ------------------------------------------------------------ Try it panels

  const BODY_METHODS = new Set(['POST', 'PATCH', 'PUT']);

  function setupRequest(block) {
    const method = block.querySelector('.tr-method');
    const service = block.querySelector('.tr-service');
    const path = block.querySelector('.tr-path');
    const headers = block.querySelector('.tr-headers');
    const body = block.querySelector('.tr-body');
    const bodyWrap = block.querySelector('.tr-body-wrap');
    const send = block.querySelector('.tr-send');
    const result = block.querySelector('.tr-result');
    const syncBody = () => { bodyWrap.hidden = !BODY_METHODS.has(method.value); };
    method.addEventListener('change', syncBody);
    syncBody();
    let original = { method: method.value, service: service.value, path: path.value, headers: headers.value, body: body.value };
    const apply = (r) => {
      method.value = r.method; service.value = r.service; path.value = r.path;
      headers.value = r.headers; body.value = r.body;
      headers.rows = Math.max(1, r.headers.split('\n').length);
      body.rows = Math.max(2, Math.min(12, r.body.split('\n').length));
      syncBody();
    };
    block.querySelector('.tr-restore')?.addEventListener('click', () => apply(original));
    // The lab page loads its examples into the form with this event.
    block.addEventListener('tr-load', (event) => {
      original = event.detail;
      block.dataset.save = JSON.stringify(event.detail.save || {});
      apply(original);
      result.hidden = true;
    });

    send.disabled = false;
    send.addEventListener('click', async () => {
      result.hidden = false;
      result.className = 'tr-result';
      result.textContent = '';
      const p = fill(path.value.trim());
      const h = fill(headers.value);
      const b = fill(BODY_METHODS.has(method.value) ? body.value : '');
      const missing = [...new Set([...p.missing, ...h.missing, ...b.missing])];
      if (missing.length) {
        result.classList.add('note');
        result.textContent = `This request uses ${missing.map((m) => `{{${m}}}`).join(', ')}, which is not saved yet. Send the request above that creates it first.`;
        return;
      }
      const headerMap = {};
      h.out.split('\n').map((l) => l.trim()).filter(Boolean).forEach((line) => {
        const at = line.indexOf(':');
        if (at > 0) headerMap[line.slice(0, at).trim()] = line.slice(at + 1).trim();
      });
      send.disabled = true;
      send.textContent = 'Sending…';
      try {
        const res = await labFetch('request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ service: service.value, method: method.value, path: p.out, headers: headerMap, body: b.out }),
        });
        const data = await res.json();
        if (!res.ok) { result.classList.add('error'); result.textContent = data.error || `The lab answered ${res.status}.`; return; }
        showResponse(result, data);
        let parsed = null;
        try { parsed = JSON.parse(data.body); } catch (e) { /* not JSON */ }
        if (parsed && data.status < 300) {
          const save = JSON.parse(block.dataset.save || '{}');
          const found = {};
          if (parsed.access_token) found.token = parsed.access_token;
          if (parsed.refresh_token) found.refresh_token = parsed.refresh_token;
          for (const [name, where] of Object.entries(save)) {
            const v = pick(parsed, where);
            if (v !== undefined && v !== null) found[name] = String(v);
          }
          const from = `${method.value} ${p.out}`;
          for (const [name, value] of Object.entries(found)) vars[name] = { value, from };
          if (Object.keys(found).length) {
            saveVars();
            result.prepend(el('p', { class: 'tr-saved', text: `Saved for the next requests: ${Object.keys(found).map((n) => `{{${n}}}`).join(', ')}` }));
          }
        }
      } catch (e) {
        result.classList.add('error');
        result.textContent = 'The live lab is not reachable right now. Try again later.';
      } finally {
        send.disabled = false;
        send.textContent = 'Send';
      }
    });
  }

  function showResponse(target, data) {
    const ok = data.status < 400;
    const head = el('div', { class: 'tr-status' },
      el('span', { class: `pill ${ok ? 'ok' : 'bad'}`, text: `${data.status} ${data.reason || ''}`.trim() }),
      el('span', { class: 'muted', text: `${data.ms} ms` }));
    const shown = Object.entries(data.headers)
      .filter(([k]) => !/^(date|server|connection|content-length)$/i.test(k));
    const hdr = el('details', { class: 'tr-headers-out' },
      el('summary', { text: `Response headers (${shown.length})` }),
      el('pre', { text: shown.map(([k, v]) => `${k}: ${v}`).join('\n') }));
    const pre = el('pre', { class: 'tr-body-out' });
    pre.innerHTML = data.body ? jsonHtml(data.body) : '<span class="muted">(empty body)</span>';
    target.append(head, hdr, pre);
    if (data.truncated) target.append(el('p', { class: 'muted', text: 'The body was long, so only the first part is shown.' }));
  }

  // ------------------------------------------------------------ reset and status

  async function doReset(btn, msg) {
    btn.disabled = true;
    const started = performance.now();
    if (msg) msg.textContent = 'Resetting every service…';
    try {
      const res = await labFetch('reset', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      const secs = ((performance.now() - started) / 1000).toFixed(1);
      if (res.ok) {
        vars = {};
        saveVars();
        if (msg) msg.textContent = `Back to the starting data (${secs} s). Saved tokens were cleared, so log in again.`;
      } else if (msg) {
        msg.textContent = res.status === 409 ? 'A test run is in progress. Try again when it finishes.' : (data.error || 'The reset did not finish.');
      }
    } catch (e) {
      if (msg) msg.textContent = 'The live lab is not reachable right now.';
    } finally {
      btn.disabled = false;
    }
  }

  function setupReset(btn) {
    btn.addEventListener('click', () => doReset(btn, btn.parentElement.querySelector('.lab-reset-msg')));
  }

  async function loadStatus(box) {
    box.innerHTML = '<span class="muted">Checking…</span>';
    try {
      const res = await labFetch('health');
      const data = await res.json();
      box.textContent = '';
      for (const [name, state] of Object.entries(data.services)) {
        box.append(el('span', { class: `svc-dot ${state === 'up' ? 'up' : 'down'}`, text: name, title: state }));
      }
    } catch (e) {
      box.innerHTML = '<span class="muted">The live lab is not reachable right now.</span>';
    }
  }

  // ------------------------------------------------------------ test runner: the side panel

  // A Run button opens a panel on the right that shows each step of the test as it
  // happens: every API request and response, database query and event.
  const PHASES = { setup: 'Set-up: the fixtures prepare data', call: 'The test', teardown: 'Clean-up' };
  let running = false;
  let current = null; // the node id shown in the panel
  let again = null; // what "Run again" runs
  let panel = null;
  let runButtons = [];

  function pill(kind, text) { return el('span', { class: `pill ${kind}`, text }); }
  const statusKind = (s) => (s < 300 ? 'ok' : s < 400 ? 'info' : 'bad');
  const testName = (nodeId) => nodeId.split('::')[1] || `All tests in ${nodeId.replace(/^tests\//, '')}`;

  function block(label, text, json = false) {
    if (text === null || text === undefined || text === '') return null;
    const pre = el('pre');
    if (json) pre.innerHTML = jsonHtml(text); else pre.textContent = text;
    return el('div', { class: 'tp-part' }, el('p', { class: 'tp-label', text: label }), pre);
  }
  const headerText = (h) => Object.entries(h || {}).map(([k, v]) => `${k}: ${v}`).join('\n');

  function buildPanel() {
    const node = el('aside', { class: 'tp', 'aria-label': 'Test run', hidden: '' });
    node.innerHTML = `<div class="tp-head">
<div class="tp-titles"><p class="tp-eyebrow">Test run on the live app <span class="tp-state"></span></p><h2 class="tp-title"></h2><p class="tp-file"></p></div>
<button type="button" class="tp-close" aria-label="Close the panel">×</button></div>
<div class="tp-bar"><button type="button" class="btn primary tp-again">Run again</button><button type="button" class="btn tp-reset">Reset the app</button><span class="tp-reset-msg muted" aria-live="polite"></span></div>
<div class="tp-body" aria-live="polite"></div>`;
    document.body.append(node);
    node.querySelector('.tp-close').addEventListener('click', closePanel);
    node.querySelector('.tp-again').addEventListener('click', () => again && again());
    const resetBtn = node.querySelector('.tp-reset');
    resetBtn.addEventListener('click', () => doReset(resetBtn, node.querySelector('.tp-reset-msg')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !node.hidden) closePanel(); });
    return node;
  }

  function openPanel(title, file, eyebrow = 'Test run on the live app') {
    panel = panel || buildPanel();
    panel.hidden = false;
    document.documentElement.classList.add('tp-open');
    panel.querySelector('.tp-eyebrow').firstChild.textContent = `${eyebrow} `;
    panel.querySelector('.tp-title').textContent = title;
    panel.querySelector('.tp-file').textContent = file;
    panel.querySelector('.tp-close').focus({ preventScroll: true });
  }

  function closePanel() {
    if (!panel) return;
    panel.hidden = true;
    document.documentElement.classList.remove('tp-open');
  }

  function setState(kind, text) {
    const s = panel.querySelector('.tp-state');
    s.textContent = '';
    s.append(pill(kind, text));
  }

  // One run's view: tests, each with its phases and steps, then the raw pytest output.
  function runView(body) {
    const intro = el('p', { class: 'tp-intro', text: 'Each row is one real step the test took, in order: the calls it made and, marked CHECK, each assert it tested. Open a row to see what was sent and what came back, or what a check compared.' });
    const tests = el('div', { class: 'tp-tests' });
    const logPre = el('pre');
    const log = el('details', { class: 'tp-log' }, el('summary', { text: 'pytest output' }), logPre);
    body.append(intro, tests, log);
    let test = null; // { list, phase, last, n }

    function startTest(nodeId) {
      const head = el('div', { class: 'tp-test-head' }, pill('run', 'running'), el('code', { text: nodeId.split('::')[1] || nodeId }));
      const section = el('section', { class: 'tp-test' }, head);
      tests.append(section);
      test = { section, head, list: null, phase: null, last: null, n: 0 };
    }

    function listFor(phase) {
      if (!test) startTest(current);
      if (test.phase !== phase) {
        test.section.append(el('p', { class: 'tp-phase', text: PHASES[phase] || phase }));
        test.list = el('ol', { class: 'tp-steps' });
        test.section.append(test.list);
        test.phase = phase;
        test.last = null;
      }
      return test.list;
    }

    function step(phase, kind, summaryKids, detailKids, key) {
      const list = listFor(phase);
      // Polling asks the same question several times: show it once, with a count.
      if (key && test.last && test.last.key === key) {
        test.last.count += 1;
        const row = test.last.row;
        row.querySelector('summary').replaceChildren(...summaryKids, el('span', { class: 'tp-count', text: `asked ${test.last.count} times` }));
        row.querySelector('.tp-detail').replaceChildren(...detailKids.filter(Boolean));
        return;
      }
      test.n += 1;
      const details = el('details', { class: `tp-step ${kind}` },
        el('summary', {}, ...summaryKids),
        el('div', { class: 'tp-detail' }, ...detailKids.filter(Boolean)));
      list.append(el('li', {}, details));
      test.last = { key, row: details, count: 1 };
    }

    function onHttp(d) {
      const summary = [el('span', { class: 'tp-m', text: d.method }), el('span', { class: 'tp-svc', text: d.service }), el('code', { class: 'tp-path', text: d.path })];
      if (d.error) summary.push(pill('bad', 'no answer'));
      else summary.push(pill(statusKind(d.status), String(d.status)));
      summary.push(el('span', { class: 'tp-ms', text: `${d.ms} ms` }));
      const detail = [
        block('Request headers', headerText(d.request_headers)),
        block('Request body', d.request_body, true),
        d.error ? block('Error', d.error) : block(`Response · ${d.status} ${d.reason || ''}`, headerText(d.response_headers)),
        block('Response body', d.response_body, true),
      ];
      step(d.phase, 'http', summary, detail, `${d.phase} ${d.method} ${d.service} ${d.path}`);
    }

    function onDb(d) {
      const summary = [el('span', { class: 'tp-m db', text: 'SQL' }), el('span', { class: 'tp-svc', text: `${d.database} database` }),
        el('code', { class: 'tp-path', text: d.sql.replace(/\s+/g, ' ') })];
      if (d.error) summary.push(pill('bad', 'error'));
      else summary.push(pill('ok', d.row ? '1 row' : 'no row'));
      step(d.phase, 'db', summary, [
        block('Query (read-only user)', d.sql),
        block('Values for %s', (d.values || []).join('\n')),
        d.error ? block('Error', d.error) : block('Row', JSON.stringify(d.row), true),
      ]);
    }

    function onEvent(d) {
      if (d.type === 'watch') {
        step(d.phase, 'event', [el('span', { class: 'tp-m ev', text: 'KAFKA' }), el('span', { class: 'tp-svc', text: 'Start watching' }), el('code', { class: 'tp-path', text: d.topic })],
          [el('p', { class: 'tp-note', text: 'From here on the test sees every new event on this topic. Older events are skipped.' })]);
      } else if (d.type === 'topics') {
        step(d.phase, 'event', [el('span', { class: 'tp-m ev', text: 'KAFKA' }), el('span', { class: 'tp-svc', text: 'List topics' }), pill('ok', `${d.topics.length} topics`)],
          [block('Topics on the broker', d.topics.join('\n'))]);
      } else {
        const summary = [el('span', { class: 'tp-m ev', text: 'KAFKA' }), el('span', { class: 'tp-svc', text: d.found ? 'Event received' : 'No event' }),
          el('code', { class: 'tp-path', text: `${d.topic} · ${d.field} = ${d.value}` }),
          d.found ? pill('ok', 'matched') : pill('bad', 'timed out'), el('span', { class: 'tp-ms', text: `${d.ms} ms` })];
        step(d.phase, 'event', summary, [d.found ? block('The event', d.event, true)
          : el('p', { class: 'tp-note', text: `No event with ${d.field} = ${d.value} arrived on ${d.topic} in time.` })]);
      }
    }

    // One assert line: the code, whether it held, and the values pytest compared.
    function onAssert(d) {
      const summary = [el('span', { class: 'tp-m chk', text: 'CHECK' }), el('code', { class: 'tp-path', text: d.code || 'assert' }),
        d.passed ? pill('ok', 'holds') : pill('bad', 'fails')];
      const first = (d.values || '').split('\n')[0];
      const detail = [
        el('p', { class: 'tp-note', text: `Line ${d.line} of ${d.file}. ${d.passed
          ? 'The comparison was true, so the test carried on.'
          : 'The comparison was false, so pytest stopped the test here and marked it failed.'}` }),
        block(d.passed ? 'What pytest compared' : 'What pytest compared (left: what the app gave, right: what the test expects)', d.values),
      ];
      if (!d.passed && first.includes(' == ')) {
        const [got, want] = first.split(' == ');
        detail.splice(1, 0, el('dl', { class: 'tp-cmp' }, el('dt', { text: 'Expected' }), el('dd', {}, el('code', { text: want })),
          el('dt', { text: 'Got' }), el('dd', {}, el('code', { text: got }))));
      }
      step(d.phase, d.passed ? 'assert' : 'assert bad', summary, detail);
      if (!d.passed) test.last.row.open = true;
    }

    function onOutcome(d) {
      if (!test) startTest(d.nodeid);
      const kind = d.outcome === 'passed' ? 'ok' : d.outcome === 'skipped' ? 'info' : 'bad';
      const label = d.outcome === 'failed' && d.when !== 'call' ? `error in ${d.when}` : d.outcome;
      test.head.replaceChildren(pill(kind, label), el('code', { text: d.nodeid.split('::')[1] || d.nodeid }), el('span', { class: 'tp-ms', text: `${d.seconds} s` }));
      if (test.n === 0) test.section.append(el('p', { class: 'tp-note', text: 'This test made no API calls.' }));
      if (d.message) test.section.append(el('div', { class: `tp-why ${kind}` }, el('p', { class: 'tp-label', text: d.outcome === 'failed' ? 'Why it failed' : 'Note' }), el('pre', { text: d.message })));
      test = null;
    }

    return {
      handle(d) {
        if (d.type === 'log') { logPre.append(colourLine(d.line), '\n'); return; }
        if (d.type === 'test') { startTest(d.nodeid); return; }
        if (d.type === 'http') onHttp(d);
        else if (d.type === 'db') onDb(d);
        else if (d.type === 'assert') onAssert(d);
        else if (d.type === 'watch' || d.type === 'event' || d.type === 'topics') onEvent(d);
        else if (d.type === 'outcome') onOutcome(d);
      },
      logLine(line) { logPre.append(colourLine(line), '\n'); },
      openLog() { log.open = true; intro.remove(); },
    };
  }

  function colourLine(line) {
    const span = el('span', { text: line });
    if (/\bPASSED\b|\d+ passed/.test(line) && !/failed|error/i.test(line)) span.className = 'run-pass';
    else if (/\bFAILED\b|\bERROR\b|\d+ failed|^E\s/.test(line)) span.className = 'run-fail';
    return span;
  }

  async function readLines(res, onLine) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      lines.forEach(onLine);
    }
    if (buffer) onLine(buffer);
  }

  async function runTest(nodeId) {
    if (running) { openPanel(panel.querySelector('.tp-title').textContent, panel.querySelector('.tp-file').textContent); return; }
    current = nodeId;
    again = () => runTest(nodeId);
    openPanel(testName(nodeId), nodeId.split('::')[0]);
    const body = panel.querySelector('.tp-body');
    body.textContent = '';
    running = true;
    runButtons.forEach((b) => { b.disabled = true; });
    panel.querySelector('.tp-again').disabled = true;
    setState('run', 'running');
    const view = runView(body);
    let exitCode = null;
    try {
      const post = (path) => labFetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ node_id: nodeId }) });
      let res = await post('trace');
      if (res.status === 404) {
        // An older lab without step recording: show pytest's output instead.
        res = await post('run');
        if (res.ok) { view.openLog(); await readLines(res, view.logLine); setState('info', 'finished'); return; }
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        body.append(el('p', { class: 'tp-why bad', text: data.error || `The lab answered ${res.status}.` }));
        setState('bad', 'not run');
        return;
      }
      await readLines(res, (line) => {
        let d;
        try { d = JSON.parse(line); } catch (e) { return; }
        if (d.type === 'done') exitCode = d.exit_code;
        else view.handle(d);
      });
      setState(exitCode === 0 ? 'ok' : 'bad', exitCode === 0 ? 'passed' : exitCode === null ? 'stopped' : 'failed');
    } catch (e) {
      body.append(el('p', { class: 'tp-why bad', text: 'The connection to the live lab was lost.' }));
      setState('bad', 'stopped');
    } finally {
      running = false;
      runButtons.forEach((b) => { b.disabled = false; });
      panel.querySelector('.tp-again').disabled = false;
    }
  }


  // ------------------------------------------------------------ Playwright runs

  // Built-in fixtures that only start the browser: hidden, with every step inside them.
  const QUIET_FIXTURE = /^Fixture "(browser|browserName|context|page|playwright|request|_.*)"$/;
  const UI_PHASES = { setup: 'Before the test: hooks and fixtures', call: 'The test', teardown: 'After the test' };
  const STEP_KIND = {
    'pw:api': ['ACTION', 'act'], expect: ['CHECK', 'chk'], 'test.step': ['STEP', 'stp'], hook: ['HOOK', 'hk'], fixture: ['FIXTURE', 'hk'],
  };
  const fileUrl = (run, rel) => `/vm/ui-files/${run}/${rel.split('/').map(encodeURIComponent).join('/')}`;

  function uiRunView(body) {
    const intro = el('p', { class: 'tp-intro', text: 'Each row is one thing the test did in the browser, in order: ACTION rows act on the page, CHECK rows are expect() checks. Open a row to see the line of code it came from. When the test ends, its screenshot, video and trace appear below it.' });
    const tests = el('div', { class: 'tp-tests' });
    const logPre = el('pre');
    const log = el('details', { class: 'tp-log' }, el('summary', { text: 'Playwright output' }), logPre);
    body.append(intro, tests, log);
    const byTest = new Map(); // test id -> { section, head, lists, phase }
    const steps = new Map(); // step id -> { row, depth, phase, hidden }
    let run = null;

    function startTest(d) {
      const head = el('div', { class: 'tp-test-head' }, pill('run', 'running'), el('code', { text: d.title }));
      const section = el('section', { class: 'tp-test' }, head);
      if (d.project === 'setup') section.append(el('p', { class: 'tp-note', text: 'The setup project runs first: it signs alice in and saves the login for the tests that need it.' }));
      tests.append(section);
      byTest.set(d.id, { section, head, list: null, phase: null, n: 0 });
    }

    function listFor(t, phase) {
      if (t.phase !== phase) {
        t.section.append(el('p', { class: 'tp-phase', text: UI_PHASES[phase] }));
        t.list = el('ol', { class: 'tp-steps' });
        t.section.append(t.list);
        t.phase = phase;
      }
      return t.list;
    }

    function onStep(d) {
      const t = byTest.get(d.test);
      if (!t) return;
      const parent = d.parent ? steps.get(d.parent) : null;
      // "Before Hooks" and "After Hooks" become the section titles, not rows.
      if (d.category === 'hook' && !parent && /^Worker Cleanup$/.test(d.title)) {
        steps.set(d.id, { hidden: true, depth: -1 });
        return;
      }
      if (d.category === 'hook' && !parent && /^(Before|After) Hooks$/.test(d.title)) {
        steps.set(d.id, { group: d.title.startsWith('Before') ? 'setup' : 'teardown', depth: -1 });
        return;
      }
      const phase = parent ? parent.phase || parent.group : 'call';
      const hidden = (parent && parent.hidden) || (d.category === 'fixture' && QUIET_FIXTURE.test(d.title));
      const depth = parent && !parent.hidden ? parent.depth + 1 : 0;
      const info = { phase, hidden, depth, row: null };
      steps.set(d.id, info);
      if (hidden) return;
      const [label, cls] = STEP_KIND[d.category] || ['STEP', 'stp'];
      // Actions and checks show their line of code, which says more than "Click".
      const useCode = d.at && d.at.code && (d.category === 'pw:api' || d.category === 'expect');
      const text = useCode ? d.at.code.replace(/^await\s+/, '').replace(/;$/, '') : d.title;
      const summary = el('summary', {}, el('span', { class: `tp-m ${cls}`, text: label }),
        el(useCode ? 'code' : 'span', { class: 'tp-path', text }), pill('run', '…'));
      const detail = el('div', { class: 'tp-detail' });
      if (d.at) {
        detail.append(el('p', { class: 'tp-note', text: `${useCode ? `Playwright step “${d.title}”, from line` : 'Line'} ${d.at.line} of ${d.at.file}` }));
        if (d.at.code && !useCode) detail.append(el('pre', { class: 'tp-src', text: d.at.code }));
      } else {
        detail.append(el('p', { class: 'tp-note', text: 'Done by Playwright itself, not by a line of the test.' }));
      }
      const row = el('details', { class: `tp-step ui ${d.category === 'expect' ? 'assert' : ''}` }, summary, detail);
      const li = el('li', { style: `--depth:${depth}` }, row);
      listFor(t, phase).append(li);
      t.n += 1;
      info.row = row;
    }

    function onStepEnd(d) {
      const info = steps.get(d.id);
      if (!info || !info.row) return;
      const summary = info.row.querySelector('summary');
      const isCheck = info.row.classList.contains('assert');
      summary.lastChild.replaceWith(d.error ? pill('bad', isCheck ? 'fails' : 'failed') : pill('ok', isCheck ? 'holds' : 'done'));
      summary.append(el('span', { class: 'tp-ms', text: `${d.ms} ms` }));
      if (d.error) {
        info.row.classList.add('bad');
        info.row.querySelector('.tp-detail').append(block('Error', d.error.split('\nCall log:')[0].trim()));
        info.row.open = true;
      }
    }

    function onOutcome(d) {
      const t = byTest.get(d.id);
      if (!t) return;
      const ok = d.status === d.expected;
      const kind = ok ? (d.status === 'skipped' ? 'info' : 'ok') : 'bad';
      t.head.replaceChildren(pill(kind, d.status === 'timedOut' ? 'timed out' : d.status), el('code', { text: d.title }), el('span', { class: 'tp-ms', text: `${d.seconds} s` }));
      if (d.error) {
        const where = d.at ? ` (line ${d.at.line} of ${d.at.file})` : '';
        t.section.append(el('div', { class: 'tp-why bad' }, el('p', { class: 'tp-label', text: `Why it failed${where}` }), el('pre', { text: d.error })));
      }
      if (!run || !d.files.length) return;
      const media = el('div', { class: 'tp-media' });
      const links = el('p', { class: 'tp-links' });
      for (const f of d.files) {
        const url = fileUrl(run, f.path);
        if (f.type.startsWith('image/')) {
          media.append(el('figure', {}, el('a', { href: url, target: '_blank', rel: 'noopener' }, el('img', { src: url, alt: `The page when “${d.title}” ended`, loading: 'lazy' })), el('figcaption', { text: 'The page when the test ended' })));
        } else if (f.type.startsWith('video/')) {
          media.append(el('figure', {}, el('video', { src: `${url}#t=0.1`, controls: '', preload: 'metadata', muted: '' }), el('figcaption', { text: 'A video of the whole test' })));
        } else if (f.name === 'trace') {
          const viewer = `/vm/ui-files/${run}/report/trace/index.html?trace=${encodeURIComponent(location.origin + url)}`;
          links.append(el('a', { class: 'btn', href: viewer, target: '_blank', rel: 'noopener', text: 'Open the trace' }), ' ');
        }
      }
      t.section.append(media);
      if (links.childNodes.length) t.section.append(links);
    }

    return {
      handle(d) {
        if (d.type === 'start') run = d.run;
        else if (d.type === 'log') logPre.append(colourLine(d.line), '\n');
        else if (d.type === 'pw-test') startTest(d);
        else if (d.type === 'pw-step') onStep(d);
        else if (d.type === 'pw-step-end') onStepEnd(d);
        else if (d.type === 'pw-outcome') onOutcome(d);
      },
      finish(done) {
        if (done && done.report) {
          body.insertBefore(el('p', { class: 'tp-links' }, el('a', { class: 'btn', href: done.report, target: '_blank', rel: 'noopener', text: 'Open the full HTML report' })), log);
        }
      },
    };
  }

  async function runUiTest(nodeId, title) {
    if (running) { openPanel(panel.querySelector('.tp-title').textContent, panel.querySelector('.tp-file').textContent); return; }
    current = nodeId;
    again = () => runUiTest(nodeId, title);
    const [file, line] = nodeId.split(':');
    openPanel(title || (line ? `The test on line ${line}` : `All tests in ${file}`), `tests/ui/${file}`, 'UI test run on the live app');
    const body = panel.querySelector('.tp-body');
    body.textContent = '';
    running = true;
    runButtons.forEach((b) => { b.disabled = true; });
    panel.querySelector('.tp-again').disabled = true;
    setState('run', 'running');
    const view = uiRunView(body);
    let done = null;
    try {
      const res = await labFetch('ui-trace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ node_id: nodeId }) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        body.append(el('p', { class: 'tp-why bad', text: data.error || `The lab answered ${res.status}.` }));
        setState('bad', 'not run');
        return;
      }
      await readLines(res, (text) => {
        let d;
        try { d = JSON.parse(text); } catch (e) { return; }
        if (d.type === 'done') done = d;
        else view.handle(d);
      });
      view.finish(done);
      const code = done ? done.exit_code : null;
      setState(code === 0 ? 'ok' : 'bad', code === 0 ? 'passed' : code === null ? 'stopped' : 'failed');
    } catch (e) {
      body.append(el('p', { class: 'tp-why bad', text: 'The connection to the live lab was lost.' }));
      setState('bad', 'stopped');
    } finally {
      running = false;
      runButtons.forEach((b) => { b.disabled = false; });
      panel.querySelector('.tp-again').disabled = false;
    }
  }

  // ------------------------------------------------------------ the load test (Locust)

  const PERF_FILE = 'tests/perf/locustfile.py';

  function perfView(body, seconds) {
    body.append(el('p', { class: 'tp-intro', text: `Locust starts simulated customers who log in and browse, and measures every request. This run is kept small because the server is shared, so it shows how a load test works, not how much load CardVault can take.` }));
    const bar = el('div', { class: 'pf-bar' }, el('span'));
    const nums = el('dl', { class: 'pf-nums' });
    const live = el('section', { class: 'pf-live' }, el('p', { class: 'tp-label', text: 'While it runs' }), bar, nums);
    const results = el('section', { class: 'pf-results' });
    const logPre = el('pre');
    const log = el('details', { class: 'tp-log' }, el('summary', { text: 'Locust output' }), logPre);
    body.append(live, results, log);
    let verdict = null;

    function showNums(pairs) {
      nums.replaceChildren(...pairs.map(([k, v]) => el('div', { class: 'pf-num' }, el('dt', { text: k }), el('dd', { text: v }))));
    }
    showNums([['seconds', '0'], ['requests', '0'], ['failures', '0'], ['median', '–'], ['requests/s', '–']]);

    return {
      handle(d) {
        if (d.type === 'log') {
          logPre.append(colourLine(d.line), '\n');
          if (/^(PASSED|FAILED):/.test(d.line)) verdict = d.line;
        } else if (d.type === 'tick') {
          bar.firstChild.style.width = `${Math.min(100, (d.second / seconds) * 100)}%`;
          showNums([['seconds', `${d.second} of ${seconds}`], ['requests', String(d.requests)], ['failures', String(d.failures)], ['median', d.requests ? `${d.median} ms` : '–'], ['requests/s', String(d.rps)]]);
        } else if (d.type === 'stats') {
          bar.firstChild.style.width = '100%';
          const head = el('tr', {}, ...['Request', 'Count', 'Failed', 'Median', '95%', 'Slowest'].map((t) => el('th', { text: t })));
          const rows = d.rows.map((r) => el('tr', { class: r.method ? '' : 'pf-total' },
            el('td', { text: r.method ? `${r.method} ${r.name}` : r.name }),
            el('td', { text: String(r.requests) }),
            el('td', { text: String(r.failures) }),
            el('td', { text: r.median === null ? '–' : `${r.median} ms` }),
            el('td', { text: r.p95 === null ? '–' : `${r.p95} ms` }),
            el('td', { text: `${r.max} ms` })));
          results.append(el('p', { class: 'tp-label', text: 'Results' }),
            el('div', { class: 'pf-table' }, el('table', {}, el('thead', {}, head), el('tbody', {}, ...rows))));
          if (verdict) {
            const ok = verdict.startsWith('PASSED');
            results.append(el('div', { class: `tp-why ${ok ? 'ok' : 'bad'}` },
              el('p', { class: 'tp-label', text: ok ? 'Within the budgets' : 'Over a budget' }),
              el('pre', { text: verdict })));
          }
          results.append(el('p', { class: 'tp-note', text: 'The budgets in the locustfile: 95% of requests faster than 500 ms, and at most 1% failed. Logging in is the slowest request because checking a password is slow by design.' }));
        }
      },
    };
  }

  async function runPerf() {
    if (running) { openPanel(panel.querySelector('.tp-title').textContent, panel.querySelector('.tp-file').textContent); return; }
    current = null;
    again = runPerf;
    openPanel('5 customers for 20 seconds', PERF_FILE, 'Load test on the live app');
    const body = panel.querySelector('.tp-body');
    body.textContent = '';
    running = true;
    runButtons.forEach((b) => { b.disabled = true; });
    panel.querySelector('.tp-again').disabled = true;
    setState('run', 'running');
    let exitCode = null;
    try {
      const res = await labFetch('perf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        body.append(el('p', { class: 'tp-why bad', text: data.error || `The lab answered ${res.status}.` }));
        setState('bad', 'not run');
        return;
      }
      let view = null;
      await readLines(res, (line) => {
        let d;
        try { d = JSON.parse(line); } catch (e) { return; }
        if (d.type === 'start') view = perfView(body, d.seconds);
        else if (d.type === 'done') exitCode = d.exit_code;
        else if (view) view.handle(d);
      });
      setState(exitCode === 0 ? 'ok' : 'bad', exitCode === 0 ? 'passed' : exitCode === null ? 'stopped' : 'failed');
    } catch (e) {
      body.append(el('p', { class: 'tp-why bad', text: 'The connection to the live lab was lost.' }));
      setState('bad', 'stopped');
    } finally {
      running = false;
      runButtons.forEach((b) => { b.disabled = false; });
      panel.querySelector('.tp-again').disabled = false;
    }
  }

  // ------------------------------------------------------------ start

  const hasLab = document.querySelector('[data-tryit], [data-lab-reset], [data-run], [data-run-ui], [data-lab-status], [data-run-select], [data-run-ui-select], [data-perf]');
  if (!hasLab) return;

  document.querySelectorAll('.tryit-req').forEach(setupRequest);
  document.querySelectorAll('[data-lab-reset]').forEach(setupReset);
  document.querySelectorAll('[data-lab-status]').forEach(loadStatus);

  runButtons = [...document.querySelectorAll('[data-run], [data-run-ui], [data-run-select], [data-run-ui-select], [data-perf]')];
  document.querySelectorAll('[data-run]').forEach((btn) => {
    btn.disabled = false;
    btn.addEventListener('click', () => runTest(btn.dataset.run));
  });
  document.querySelectorAll('[data-run-ui]').forEach((btn) => {
    btn.disabled = false;
    btn.addEventListener('click', () => runUiTest(btn.dataset.runUi, btn.dataset.title));
  });
  document.querySelectorAll('[data-run-ui-select]').forEach((btn) => {
    const select = document.querySelector(btn.dataset.runUiSelect);
    btn.disabled = false;
    btn.addEventListener('click', () => {
      const option = select.selectedOptions[0];
      runUiTest(select.value, option && option.value.includes(':') ? option.textContent : '');
    });
  });
  document.querySelectorAll('[data-perf]').forEach((btn) => {
    btn.disabled = false;
    btn.addEventListener('click', runPerf);
  });
  document.querySelectorAll('[data-run-select]').forEach((btn) => {
    const select = document.querySelector(btn.dataset.runSelect);
    btn.disabled = false;
    btn.addEventListener('click', () => runTest(select.value));
  });

  renderVars();
}());
