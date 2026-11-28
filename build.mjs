// Builds the whole site into dist/. Run: node build.mjs
import { mkdir, writeFile, readFile, cp, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { page, rail } from './src/layout.mjs';
import { esc, excerptProblems, buildContext, interviewLog } from './src/components.mjs';
import { site, allLessons, lessonUrl } from './content/site.mjs';
import { homePage } from './content/pages/home.mjs';
import { labPage } from './content/pages/lab.mjs';
import { suitePage } from './content/pages/suite.mjs';
import { drillPage } from './content/pages/drill.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');
const problems = [];

async function out(route, html) {
  const file = path.join(dist, route, 'index.html');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
}

await rm(dist, { recursive: true, force: true });
await mkdir(path.join(dist, 'assets'), { recursive: true });
await cp(path.join(root, 'src/styles.css'), path.join(dist, 'assets/styles.css'));
await cp(path.join(root, 'src/site.js'), path.join(dist, 'assets/site.js'));
await cp(path.join(root, 'src/lab.js'), path.join(dist, 'assets/lab.js'));
await cp(path.join(root, 'src/favicon.svg'), path.join(dist, 'favicon.svg'));
await cp(path.join(root, 'content/images'), path.join(dist, 'images'), { recursive: true });

// Lessons
const lessons = allLessons();
const ready = lessons.filter((l) => l.ready && (!process.env.DRAFT || existsSync(path.join(root, 'content/lessons', `${l.id}.mjs`))));
for (const [i, l] of ready.entries()) {
  const file = path.join(root, 'content/lessons', `${l.id}.mjs`);
  if (!existsSync(file)) { problems.push(`missing lesson file for ${l.id}`); continue; }
  buildContext.lesson = l;
  const mod = (await import(pathToFileURL(file).href)).default;
  buildContext.lesson = null;
  const prev = ready[i - 1]?.track === l.track ? ready[i - 1] : null;
  const next = ready[i + 1]?.track === l.track ? ready[i + 1] : null;
  const pager = `<nav class="pager" aria-label="Lessons">`
    + (prev ? `<a class="prev" href="${lessonUrl(prev.id)}"><small>Previous</small><span>${esc(prev.title)}</span></a>` : '<span></span>')
    + (next ? `<a class="next" href="${lessonUrl(next.id)}"><small>Next</small><span>${esc(next.title)}</span></a>` : '')
    + `</nav>`;
  const sections = withSectionIds(softenLinks(l.id, mod.body, lessons));
  const body = `<div class="frame lesson-frame">
<aside class="rail" aria-label="Lessons">${rail(l.id)}</aside>
<article class="article">
<details class="rail-mobile"><summary>All lessons</summary><nav class="rail">${rail(l.id)}</nav></details>
<p class="eyebrow"><span class="chip">Lesson ${String(l.n).padStart(2, '0')}</span><span>${esc(l.trackTitle)} · ${esc(l.module)}</span></p>
<h1>${esc(l.title)}</h1>
<p class="lede">${mod.lede}</p>
<div class="meta-row"><span class="time">${mod.minutes} min read</span><span>${esc(mod.youWill)}</span></div>
${sections.html}
${pager}
</article>
${sections.toc}</div>`;
  await out(`learn/${l.id}`, page({ title: `${l.title} · CardVault Learn`, description: mod.lede.replace(/<[^>]+>/g, ''), active: l.track, body }));
}

await out('', homePage());
await out('learn', homePage());
await out('lab', labPage());
await out('suite', suitePage());
await out('drill', drillPage(interviewLog));

problems.push(...excerptProblems);

// 404 page
await writeFile(path.join(dist, '404.html'), page({ title: 'Page not found · CardVault Learn', body: `<div class="frame"><div class="page-head"><h1>That page does not exist</h1><p class="lede">It may be a lesson that is not written yet. <a href="/">Go to the start</a>.</p></div></div>` }));

/** Links to lessons not yet written become plain text marked "soon"; unknown ids are errors. */
/** Gives each section heading an id, and lists them for the "On this page" contents (wide screens only). */
function withSectionIds(html) {
  const used = new Set();
  const items = [];
  const out = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (m, inner) => {
    const label = inner.replace(/<[^>]+>/g, '').trim();
    let slug = label.toLowerCase().replace(/&[a-z#0-9]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
    while (used.has(slug)) slug += '-2';
    used.add(slug);
    items.push(`<li><a href="#${slug}">${label}</a></li>`);
    return `<h2 id="${slug}">${inner}</h2>`;
  });
  const toc = items.length > 2 ? `<nav class="toc" aria-label="On this page"><p>On this page</p><ol>${items.join('')}</ol></nav>` : '';
  return { html: out, toc };
}

function softenLinks(id, html, lessons) {
  return html.replace(/<a href="\/learn\/([^/"]+)\/">([\s\S]*?)<\/a>/g, (whole, target, label) => {
    const t = lessons.find((x) => x.id === target);
    if (!t) { problems.push(`${id}: link to unknown lesson ${target}`); return whole; }
    if (ready.includes(t)) return whole;
    return `<span class="later" title="A later lesson, not written yet">${label}<small>soon</small></span>`;
  });
}

if (problems.length) {
  console.error(`${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`Built ${ready.length} lessons into dist/.`);
