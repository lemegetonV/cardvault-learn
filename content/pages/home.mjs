import { page } from '../../src/layout.mjs';
import { esc, figure } from '../../src/components.mjs';
import { tracks, lessonUrl } from '../site.mjs';
import { actors } from '../diagrams/basics.mjs';

const icon = {
  map: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="15" width="12" height="10" rx="2" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.5"/><rect x="25" y="5" width="12" height="10" rx="2" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.5"/><rect x="25" y="25" width="12" height="10" rx="2" fill="var(--event-soft)" stroke="var(--event)" stroke-width="1.5"/><path d="M15 20h5V10h5M20 20v10h5" fill="none" stroke="var(--ink-2)" stroke-width="1.5"/></svg>`,
  api: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="4" y="6" width="32" height="28" rx="4" fill="var(--surface)" stroke="var(--line)" stroke-width="1.5"/><rect x="9" y="12" width="9" height="5" rx="1.5" fill="var(--accent)"/><path d="M21 14.5h10M9 22h22M9 27h15" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  events: `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="4" y="13" width="9" height="14" rx="2" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.5"/><rect x="27" y="13" width="9" height="14" rx="2" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.5"/><path d="M13 20h14" stroke="var(--event)" stroke-width="2" stroke-dasharray="4 3"/><circle cx="20" cy="20" r="3.5" fill="var(--event)"/></svg>`,
};

export function homePage() {
  const moduleCards = (t) => t.modules.map((m, i) => {
    const first = m.lessons.find((l) => l[2]);
    const readyCount = m.lessons.filter((l) => l[2]).length;
    const foot = readyCount ? `${m.lessons.length} lessons` : `${m.lessons.length} lessons · coming soon`;
    const inner = `<span class="num">MODULE ${i + 1}</span><h3>${esc(m.title)}</h3><p>${esc(m.blurb)}</p><span class="foot">${foot}</span>`;
    return first ? `<a class="module-card" href="${lessonUrl(first[0])}">${inner}</a>` : `<div class="module-card later">${inner}</div>`;
  }).join('');
  const open = tracks.filter((t) => !t.later);
  const sections = open.map((t) => `<div><div class="track-head"><h2>${esc(t.title)}</h2><span>${esc(t.blurb)}</span></div><div class="modules">${moduleCards(t)}</div></div>`).join('');
  const later = tracks.filter((t) => t.later).map((t) => `<div class="module-card later"><span class="num">LATER</span><h3>${esc(t.title)}</h3><p>${esc(t.blurb)}</p></div>`).join('');

  const body = `<div class="frame">
<section class="hero">
<p class="eyebrow"><span class="chip">Free learning material</span><span>Built around CardVault</span></p>
<h1>Learn how a bank wallet works, from the inside.</h1>
<p class="lede">CardVault is a small but realistic banking system, built for practising test automation. This site explains it one idea at a time, in plain language and pictures, so that when you test it you know what should happen and why.</p>
<div class="cta"><a class="btn primary" href="${lessonUrl('what-is-cardvault')}">Start with lesson 1</a><a class="btn" href="/map/">Explore the service map</a></div>
</section>
<div class="home-figure">${figure({ svg: actors(), caption: 'The whole story in one picture. The bank sits in the middle and is what you test. The wallet operator and the card network are outside companies, played by mocks you can control.' })}</div>

<h2 class="section-title">The learning path</h2>
<div class="tracks">
${sections}
${later ? `<div><div class="track-head"><h2>Still to come</h2><span>More tracks follow.</span></div><div class="modules">${later}</div></div>` : ''}
</div>

<h2 class="section-title">Open any time</h2>
<div class="tools">
<a class="tool" href="/map/">${icon.map}<h3>Service map</h3><p>Click any part of the system to see its job, its data and who it talks to.</p></a>
<a class="tool" href="/apis/">${icon.api}<h3>APIs</h3><p>The OpenAPI reference for all five services and both mocks.</p></a>
<a class="tool" href="/events/">${icon.events}<h3>Events</h3><p>Every topic: who sends it, who listens, and what is inside.</p></a>
</div>
</div>`;
  return page({ title: 'CardVault Learn', active: 'learn', body });
}
