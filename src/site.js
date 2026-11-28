// Small enhancements. Every page reads fully without this script.
(function () {
  // Header menu on small screens
  const menu = document.querySelector('.menu-btn');
  const nav = document.querySelector('.site-nav');
  if (menu && nav) {
    menu.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
    });
  }

  // Light/dark switch. Starts from the browser's setting; a click is remembered.
  const themeBtn = document.querySelector('.theme-btn');
  if (themeBtn) {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const current = () => root.dataset.theme || (media.matches ? 'dark' : 'light');
    const label = () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      themeBtn.setAttribute('aria-label', `Switch to ${next} mode`);
      themeBtn.title = `Switch to ${next} mode`;
    };
    themeBtn.addEventListener('click', () => {
      const next = current() === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode: not remembered */ }
      label();
    });
    media.addEventListener('change', label);
    label();
  }

  // Step-through sequence diagrams
  document.querySelectorAll('.stepper').forEach((fig) => {
    const data = JSON.parse(fig.querySelector('.steps-data').textContent);
    const msgs = [...fig.querySelectorAll('.msg')];
    const note = fig.querySelector('.note');
    const count = fig.querySelector('.count');
    const next = fig.querySelector('[data-act="next"]');
    const prev = fig.querySelector('[data-act="prev"]');
    const all = fig.querySelector('[data-act="all"]');
    let i = -1;
    fig.classList.add('enhanced');
    const render = () => {
      if (i < 0) {
        fig.classList.remove('active');
        msgs.forEach((m) => m.classList.remove('now', 'past'));
        note.innerHTML = `<b>How to use this</b>Press Start to walk through the ${data.length} messages one at a time. Each step explains what travels and why.`;
        count.textContent = `${data.length} steps`;
        next.textContent = 'Start';
        prev.disabled = true;
        next.disabled = false;
        return;
      }
      fig.classList.add('active');
      msgs.forEach((m, k) => {
        m.classList.toggle('now', k === i);
        m.classList.toggle('past', k < i);
      });
      note.innerHTML = `<b>Step ${i + 1} · ${escapeHtml(data[i].label)}</b>${data[i].note}`;
      count.textContent = `Step ${i + 1} of ${data.length}`;
      next.textContent = i === data.length - 1 ? 'Finished' : 'Next';
      next.disabled = i === data.length - 1;
      prev.disabled = false;
    };
    next.addEventListener('click', () => { if (i < data.length - 1) { i += 1; render(); } });
    prev.addEventListener('click', () => { i -= 1; render(); });
    all.addEventListener('click', () => { i = -1; render(); });
    fig.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' && i < data.length - 1) { i += 1; render(); }
      if (e.key === 'ArrowLeft' && i >= 0) { i -= 1; render(); }
    });
  });

  // Check-yourself questions
  document.querySelectorAll('.check').forEach((box) => {
    const answer = Number(box.dataset.answer);
    const why = box.querySelector('.why');
    box.querySelectorAll('.opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        const picked = Number(btn.dataset.i);
        box.querySelectorAll('.opt').forEach((b) => {
          b.disabled = true;
          if (Number(b.dataset.i) === answer) b.classList.add('right');
        });
        if (picked !== answer) btn.classList.add('wrong');
        why.hidden = false;
        why.insertAdjacentHTML('afterbegin', `<strong>${picked === answer ? 'Right.' : 'Not quite.'}</strong> `);
      });
    });
  });

  // Interactive service map
  const map = document.querySelector('svg.map.interactive');
  const panel = document.querySelector('.panel');
  const infoEl = document.getElementById('map-data');
  if (map && panel && infoEl) {
    const info = JSON.parse(infoEl.textContent);
    const overview = panel.innerHTML;
    const nodes = [...map.querySelectorAll('.map-node')];
    const edges = [...map.querySelectorAll('.edge')];
    const select = (id) => {
      if (!id) {
        map.classList.remove('has-sel');
        nodes.forEach((n) => n.classList.remove('sel', 'near'));
        edges.forEach((e) => e.classList.remove('on'));
        panel.innerHTML = overview;
        bindPick();
        history.replaceState(null, '', location.pathname);
        return;
      }
      map.classList.add('has-sel');
      const near = new Set([id]);
      edges.forEach((e) => {
        const on = e.dataset.a === id || e.dataset.b === id;
        e.classList.toggle('on', on);
        if (on) { near.add(e.dataset.a); near.add(e.dataset.b); }
      });
      nodes.forEach((n) => {
        n.classList.toggle('sel', n.dataset.id === id);
        n.classList.toggle('near', near.has(n.dataset.id));
      });
      panel.innerHTML = info[id] || overview;
      const back = panel.querySelector('[data-clear]');
      if (back) back.addEventListener('click', () => select(null));
      history.replaceState(null, '', '#' + id);
    };
    const bindPick = () => panel.querySelectorAll('[data-pick]').forEach((b) =>
      b.addEventListener('click', () => select(b.dataset.pick)));
    bindPick();
    nodes.forEach((n) => {
      n.addEventListener('click', () => select(n.classList.contains('sel') ? null : n.dataset.id));
      n.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n.dataset.id); }
        if (e.key === 'Escape') select(null);
      });
    });
    const start = location.hash.slice(1);
    if (start && info[start]) select(start);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // Framework explorer: highlight the line or range in the address (#L12 or #L12-L30)
  const lines = document.querySelector('.ex-lines');
  if (lines) {
    const mark = () => {
      lines.querySelectorAll('tr.hit').forEach((r) => r.classList.remove('hit'));
      const m = location.hash.match(/^#L(\d+)(?:-L(\d+))?$/);
      if (!m) return;
      const from = Number(m[1]), to = Number(m[2] || m[1]);
      for (let n = from; n <= to; n += 1) document.getElementById(`L${n}`)?.classList.add('hit');
      document.getElementById(`L${from}`)?.scrollIntoView({ block: 'start' });
    };
    mark();
    window.addEventListener('hashchange', mark);
  }

  // "On this page": highlight the section being read.
  const tocLinks = [...document.querySelectorAll('.toc a')];
  if (tocLinks.length) {
    const heads = tocLinks.map((a) => document.getElementById(a.getAttribute('href').slice(1)));
    let queued = false;
    const update = () => {
      queued = false;
      let current = -1;
      heads.forEach((h, k) => { if (h && h.getBoundingClientRect().top < window.innerHeight * 0.35) current = k; });
      tocLinks.forEach((a, k) => a.classList.toggle('here', k === current));
    };
    window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // Screenshots: click or tap to see one full size; click again or press Escape to close.
  document.addEventListener('click', (e) => {
    const img = e.target.closest && e.target.closest('.shot img');
    if (!img) return;
    const layer = document.createElement('div');
    layer.className = 'zoom';
    layer.setAttribute('role', 'dialog');
    layer.setAttribute('aria-label', img.alt || 'Screenshot');
    const big = document.createElement('img');
    big.src = img.currentSrc || img.src;
    big.alt = img.alt;
    layer.appendChild(big);
    const close = () => { layer.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (k) => { if (k.key === 'Escape') close(); };
    layer.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(layer);
  });
})();
