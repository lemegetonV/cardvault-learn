// The live lab in the browser: "Try it" panels, the reset button and the test runner.
// They all talk to /vm/*, which the site's Worker forwards to the live CardVault.
// Nothing here runs unless the page has a lab element on it.
(function () {
  const AUTH_KEY = 'cv-lab-auth';
  const VARS_KEY = 'cv-lab-vars';
  const store = {
    get(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } },
    set(key, value) { try { sessionStorage.setItem(key, value); } catch (e) { /* not remembered */ } },
    del(key) { try { sessionStorage.removeItem(key); } catch (e) { /* nothing to do */ } },
  };
  let memoryAuth = null;
  const getAuth = () => memoryAuth || store.get(AUTH_KEY);

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

  // ------------------------------------------------------------ password

  class Locked extends Error {}

  async function labFetch(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const auth = getAuth();
    if (auth) headers.set('Authorization', `Basic ${auth}`);
    const res = await fetch(`/vm/${path}`, { ...options, headers });
    if (res.status === 401) {
      memoryAuth = null;
      store.del(AUTH_KEY);
      refreshLockState();
      throw new Locked('locked');
    }
    return res;
  }

  let dialog;
  function unlockDialog() {
    if (dialog) return dialog;
    dialog = el('dialog', { class: 'lab-dialog', 'aria-labelledby': 'lab-dialog-title' });
    dialog.innerHTML = `<form method="dialog">
<h2 id="lab-dialog-title">Unlock the live lab</h2>
<p>The lab sends real requests to the CardVault running on the server, so it has a password. Use the one for your CardVault tools.</p>
<label>Username<input name="user" autocomplete="username" required></label>
<label>Password<input name="pass" type="password" autocomplete="current-password" required></label>
<p class="lab-dialog-msg" aria-live="polite"></p>
<div class="lab-dialog-actions"><button type="submit" class="btn primary">Unlock</button><button type="button" class="btn" data-cancel>Cancel</button></div>
</form>`;
    document.body.append(dialog);
    return dialog;
  }

  /** Resolves once the lab is unlocked; rejects if the reader cancels. */
  function ensureUnlocked() {
    if (getAuth()) return Promise.resolve();
    const d = unlockDialog();
    const form = d.querySelector('form');
    const msg = d.querySelector('.lab-dialog-msg');
    msg.textContent = '';
    return new Promise((resolve, reject) => {
      const cleanup = () => { form.onsubmit = null; d.querySelector('[data-cancel]').onclick = null; };
      d.querySelector('[data-cancel]').onclick = () => { cleanup(); d.close(); reject(new Locked('cancelled')); };
      form.onsubmit = async (event) => {
        event.preventDefault();
        const auth = btoa(unescape(encodeURIComponent(`${form.user.value}:${form.pass.value}`)));
        msg.textContent = 'Checking…';
        try {
          const res = await fetch('/vm/health', { headers: { Authorization: `Basic ${auth}` } });
          if (res.status === 401) { msg.textContent = 'That username or password is not right.'; return; }
          if (!res.ok) { msg.textContent = 'The live lab is not reachable right now. Try again later.'; return; }
          memoryAuth = auth;
          store.set(AUTH_KEY, auth);
          form.pass.value = '';
          cleanup();
          d.close();
          refreshLockState();
          document.querySelectorAll('[data-lab-status]').forEach(loadStatus);
          resolve();
        } catch (e) {
          msg.textContent = 'The live lab is not reachable right now. Try again later.';
        }
      };
      d.showModal();
      form.user.focus();
    });
  }

  function refreshLockState() {
    const unlocked = Boolean(getAuth());
    document.querySelectorAll('[data-lab-lock]').forEach((node) => {
      node.textContent = unlocked ? 'Unlocked' : 'Locked';
      node.classList.toggle('on', unlocked);
    });
    document.querySelectorAll('[data-lab-unlock]').forEach((b) => { b.hidden = unlocked; });
    document.querySelectorAll('[data-lab-lockout]').forEach((b) => { b.hidden = !unlocked; });
  }

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
      try { await ensureUnlocked(); } catch (e) { result.hidden = true; return; }
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
        result.textContent = e instanceof Locked
          ? 'The lab is locked again. Press Send to unlock it.'
          : 'The live lab is not reachable right now. Try again later.';
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

  function setupReset(btn) {
    const msg = btn.parentElement.querySelector('.lab-reset-msg');
    btn.addEventListener('click', async () => {
      try { await ensureUnlocked(); } catch (e) { return; }
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
        if (msg) msg.textContent = e instanceof Locked ? 'The lab is locked. Press Reset to unlock it.' : 'The live lab is not reachable right now.';
      } finally {
        btn.disabled = false;
      }
    });
  }

  async function loadStatus(box) {
    if (!getAuth()) { box.innerHTML = '<span class="muted">Unlock the lab to see whether each service is up.</span>'; return; }
    box.innerHTML = '<span class="muted">Checking…</span>';
    try {
      const res = await labFetch('health');
      const data = await res.json();
      box.textContent = '';
      for (const [name, state] of Object.entries(data.services)) {
        box.append(el('span', { class: `svc-dot ${state === 'up' ? 'up' : 'down'}`, text: name, title: state }));
      }
    } catch (e) {
      box.innerHTML = '<span class="muted">Unlock the lab to see whether each service is up.</span>';
    }
  }

  // ------------------------------------------------------------ test runner

  let running = false;
  function colourLine(line) {
    const span = el('span', { text: line });
    if (/\bPASSED\b|\d+ passed/.test(line) && !/failed|error/i.test(line)) span.className = 'run-pass';
    else if (/\bFAILED\b|\bERROR\b|\d+ failed|^E\s/.test(line)) span.className = 'run-fail';
    return span;
  }

  async function runTest(nodeId, out, buttons) {
    if (running) { out.hidden = false; out.textContent = 'A test is already running. Wait for it to finish.'; return; }
    try { await ensureUnlocked(); } catch (e) { return; }
    running = true;
    buttons.forEach((b) => { b.disabled = true; });
    out.hidden = false;
    out.textContent = '';
    out.classList.add('running');
    const pre = el('pre');
    out.append(pre);
    try {
      const res = await labFetch('run', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ node_id: nodeId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        pre.textContent = data.error || `The lab answered ${res.status}.`;
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        lines.forEach((l) => pre.append(colourLine(l), '\n'));
        out.scrollTop = out.scrollHeight;
      }
      if (buffer) pre.append(colourLine(buffer));
    } catch (e) {
      pre.append(e instanceof Locked ? 'The lab is locked. Press Run to unlock it.' : '\nThe connection to the live lab was lost.');
    } finally {
      running = false;
      out.classList.remove('running');
      buttons.forEach((b) => { b.disabled = false; });
    }
  }

  function outputFor(btn) {
    const sel = btn.dataset.out;
    if (sel) return document.querySelector(sel);
    const host = btn.closest('.code, .run-host') || btn.parentElement;
    let out = host.nextElementSibling;
    if (!out || !out.classList.contains('run-out')) {
      out = el('div', { class: 'run-out', 'aria-live': 'polite' });
      host.after(out);
    }
    return out;
  }

  // ------------------------------------------------------------ start

  const hasLab = document.querySelector('[data-tryit], [data-lab-reset], [data-run], [data-lab-status], [data-run-select]');
  if (!hasLab) return;

  document.querySelectorAll('.tryit-req').forEach(setupRequest);
  document.querySelectorAll('[data-lab-reset]').forEach(setupReset);
  document.querySelectorAll('[data-lab-unlock]').forEach((b) => b.addEventListener('click', () => {
    ensureUnlocked().catch(() => {});
  }));
  document.querySelectorAll('[data-lab-lockout]').forEach((b) => b.addEventListener('click', () => {
    memoryAuth = null; store.del(AUTH_KEY); refreshLockState();
    document.querySelectorAll('[data-lab-status]').forEach(loadStatus);
  }));
  document.querySelectorAll('[data-lab-status]').forEach(loadStatus);

  const runButtons = [...document.querySelectorAll('[data-run], [data-run-select]')];
  document.querySelectorAll('[data-run]').forEach((btn) => {
    btn.disabled = false;
    btn.addEventListener('click', () => runTest(btn.dataset.run, outputFor(btn), runButtons));
  });
  document.querySelectorAll('[data-run-select]').forEach((btn) => {
    const select = document.querySelector(btn.dataset.runSelect);
    btn.disabled = false;
    btn.addEventListener('click', () => runTest(select.value, outputFor(btn), runButtons));
  });

  renderVars();
  refreshLockState();
}());
