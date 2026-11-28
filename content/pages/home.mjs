import { page } from '../../src/layout.mjs';
import { esc } from '../../src/components.mjs';
import { tracks, lessonUrl } from '../site.mjs';

export function homePage() {
  const code = { pytest: '/suite/', playwright: '/suite/ui/' };
  const trackSection = (t, i) => {
    let n = 0;
    const mods = t.modules.map((m) => {
      const items = m.lessons.map(([id, title, ready]) => {
        n += 1;
        const num = `<span class="n">${String(n).padStart(2, '0')}</span>`;
        return ready
          ? `<li><a href="${lessonUrl(id)}">${num}<span>${esc(title)}</span></a></li>`
          : `<li><span class="soon">${num}<span>${esc(title)} <em>soon</em></span></span></li>`;
      }).join('');
      return `<div class="module-card"><h3>${esc(m.title)}</h3><p>${esc(m.blurb)}</p><ol class="lesson-list">${items}</ol></div>`;
    }).join('');
    return `<section class="track" id="${t.id}"><div class="track-head"><p class="eyebrow"><span class="chip">Track ${i + 1}</span></p><h2>${esc(t.title)}</h2><p>${esc(t.blurb)}</p>${code[t.id] ? `<p class="track-code"><a href="${code[t.id]}">Browse the suite’s code, file by file</a></p>` : ''}</div><div class="modules">${mods}</div></section>`;
  };

  const body = `<div class="frame">
<section class="hero">
<p class="eyebrow"><span class="chip">Interview prep</span><span>QA and SDET</span></p>
<h1>Learn a real app, then learn to test it.</h1>
<p class="lede">CardVault is a bank’s card and wallet app: a web app in front of a handful of backend services. Get to know it the way you would know a product you worked on, then build simple, readable API tests in Python and UI tests in TypeScript against it.</p>
<div class="cta"><a class="btn primary" href="${lessonUrl('what-is-cardvault')}">Start with the app</a></div>
</section>

<div class="how">
<div><b>1</b><p><strong>Know the app.</strong> What it does, its screens, its services, and how to explain the architecture.</p></div>
<div><b>2</b><p><strong>API testing.</strong> Python from zero, then a small pytest framework, file by file, reports, a Locust load test and live coding practice.</p></div>
<div><b>3</b><p><strong>UI testing.</strong> TypeScript from zero, every core Playwright concept, then a Playwright framework for the web app.</p></div>
</div>
<p class="how-note">Each lesson is a short read and ends with how to say it in an interview. The <a href="/drill/">Interview drill</a> collects every one of those questions in one place, and <a href="/suite/">The code</a> shows every file of both test suites.</p>

${tracks.map(trackSection).join('')}
</div>`;
  return page({ title: 'CardVault Learn', active: 'home', body });
}
