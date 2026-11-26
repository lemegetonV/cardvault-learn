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
    node.querySelector('.tp-again').addEventListener('click', () => current && runTest(current));
    const resetBtn = node.querySelector('.tp-reset');
    resetBtn.addEventListener('click', () => doReset(resetBtn, node.querySelector('.tp-reset-msg')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !node.hidden) closePanel(); });
    return node;
  }

  function openPanel(nodeId) {
    panel = panel || buildPanel();
    panel.hidden = false;
    document.documentElement.classList.add('tp-open');
    panel.querySelector('.tp-title').textContent = testName(nodeId);
    panel.querySelector('.tp-file').textContent = nodeId.split('::')[0];
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
    const intro = el('p', { class: 'tp-intro', text: 'Each row is one real step the test took, in order. Open a row to see what was sent and what came back.' });
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
    current = nodeId;
    openPanel(nodeId);
    if (running) return;
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

  // ------------------------------------------------------------ start

  const hasLab = document.querySelector('[data-tryit], [data-lab-reset], [data-run], [data-lab-status], [data-run-select]');
  if (!hasLab) return;

  document.querySelectorAll('.tryit-req').forEach(setupRequest);
  document.querySelectorAll('[data-lab-reset]').forEach(setupReset);
  document.querySelectorAll('[data-lab-status]').forEach(loadStatus);

  runButtons = [...document.querySelectorAll('[data-run], [data-run-select]')];
  document.querySelectorAll('[data-run]').forEach((btn) => {
    btn.disabled = false;
    btn.addEventListener('click', () => runTest(btn.dataset.run));
  });
  document.querySelectorAll('[data-run-select]').forEach((btn) => {
    const select = document.querySelector(btn.dataset.runSelect);
    btn.disabled = false;
    btn.addEventListener('click', () => runTest(select.value));
  });

  renderVars();
}());
