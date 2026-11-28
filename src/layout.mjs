// The page shell shared by every page.
import { esc } from './components.mjs';
import { site, tracks, lessonUrl } from '../content/site.mjs';

const brandMark = `<svg class="brand-mark" viewBox="0 0 30 20" aria-hidden="true"><rect x="0.75" y="0.75" width="28.5" height="18.5" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="4.5" y="6" width="6.5" height="5" rx="1.2" fill="var(--event)"/><path d="M4.5 15h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

const themeButton = `<button class="theme-btn" type="button" aria-label="Switch to dark mode" title="Switch to dark mode"><svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg><svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>`;

const navItems = [
  ['home', '/', 'Start'],
  ...tracks.map((t) => [t.id, `/#${t.id}`, t.short]),
  ['drill', '/drill/', 'Interview drill'],
  ['lab', '/lab/', 'Live lab'],
];

export function page({ title, description = site.description, active = '', body, head = '', scripts = '' }) {
  const nav = navItems.map(([id, href, label]) =>
    `<a href="${href}"${id === active ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..700&family=Inter:wght@400;500;600;650&family=JetBrains+Mono:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/assets/styles.css">
<script>try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}</script>
${head}
</head>
<body>
<header class="site-header"><div class="bar">
<a class="brand" href="/">${brandMark}<span>CardVault</span><small>Learn</small></a>
<button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
<nav class="site-nav" id="site-nav" aria-label="Main">${nav}</nav>
${themeButton}
</div></header>
<main id="main">
${body}
</main>
<footer class="site-footer"><div class="inner">
<span>Describes <a href="${site.cardvaultRepo}">CardVault</a> at commit <a href="${site.cardvaultRepo}/commit/${site.cardvaultCommit}">${site.cardvaultCommit}</a>.</span>
<span>Every bank, card and person here is fictional.</span>
</div></footer>
<script src="/assets/site.js" defer></script>
<script src="/assets/lab.js" defer></script>
${scripts}
</body>
</html>
`;
}

/** The contents rail: every lesson of the current lesson's track, current one highlighted. */
export function rail(currentId) {
  const t = tracks.find((x) => x.modules.some((m) => m.lessons.some(([id]) => id === currentId))) || tracks[0];
  let n = 0;
  const mods = t.modules.map((m, mi) => {
    const items = m.lessons.map(([id, title, ready]) => {
      n += 1;
      const num = `<span class="n">${String(n).padStart(2, '0')}</span>`;
      if (!ready) return `<li><span class="soon">${num}<span>${esc(title)} <em>soon</em></span></span></li>`;
      return `<li><a href="${lessonUrl(id)}"${id === currentId ? ' aria-current="page"' : ''}>${num}<span>${esc(title)}</span></a></li>`;
    }).join('');
    // Only the current lesson's module starts open, so the rail stays short.
    const here = m.lessons.some(([id]) => id === currentId);
    return `<details class="module"${here ? ' open' : ''}><summary class="module-title"><span>M${mi + 1}</span>${esc(m.title)}</summary><ol>${items}</ol></details>`;
  }).join('');
  return `<h2>${esc(t.title)}</h2>${mods}`;
}
