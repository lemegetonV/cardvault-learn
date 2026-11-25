// Builds the whole site into dist/. Run: node build.mjs
import { mkdir, writeFile, readFile, cp, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { page, rail } from './src/layout.mjs';
import { esc, quotes } from './src/components.mjs';
import { site, allLessons, lessonUrl } from './content/site.mjs';
import { homePage } from './content/pages/home.mjs';
import { mapPage } from './content/pages/map.mjs';
import { apisPage, apiPage } from './content/pages/apis.mjs';
import { eventsPage } from './content/pages/events.mjs';
import { suitePages, suitePaths } from './content/pages/suite.mjs';
import { suiteFile } from './src/components.mjs';

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
await cp(path.join(root, 'src/favicon.svg'), path.join(dist, 'favicon.svg'));
// OpenAPI documents, minus the endpoint that lists seeded-bug flags (the site never shows those).
await mkdir(path.join(dist, 'openapi'), { recursive: true });
for (const f of await readdir(path.join(root, 'data/openapi'))) {
  const spec = JSON.parse(await readFile(path.join(root, 'data/openapi', f), 'utf8'));
  for (const p of Object.keys(spec.paths || {})) if (/bug/i.test(p)) delete spec.paths[p];
  if (/bug/i.test(JSON.stringify(spec))) problems.push(`openapi/${f}: still mentions bugs`);
  await writeFile(path.join(dist, 'openapi', f), JSON.stringify(spec));
}
const sw = path.join(root, 'node_modules/swagger-ui-dist');
await mkdir(path.join(dist, 'vendor/swagger-ui'), { recursive: true });
for (const f of ['swagger-ui.css', 'swagger-ui-bundle.js']) {
  await cp(path.join(sw, f), path.join(dist, 'vendor/swagger-ui', f));
}

// Lessons
const lessons = allLessons();
const ready = lessons.filter((l) => l.ready && (!process.env.DRAFT || existsSync(path.join(root, 'content/lessons', `${l.id}.mjs`))));
for (const [i, l] of ready.entries()) {
  const file = path.join(root, 'content/lessons', `${l.id}.mjs`);
  if (!existsSync(file)) { problems.push(`missing lesson file for ${l.id}`); continue; }
  quotes.lesson = l.id;
  const mod = (await import(pathToFileURL(file).href)).default;
  const prev = ready[i - 1], next = ready[i + 1];
  const pager = `<nav class="pager" aria-label="Lessons">`
    + (prev ? `<a class="prev" href="${lessonUrl(prev.id)}"><small>Previous</small><span>${esc(prev.title)}</span></a>` : '<span></span>')
    + (next ? `<a class="next" href="${lessonUrl(next.id)}"><small>Next</small><span>${esc(next.title)}</span></a>` : '')
    + `</nav>`;
  const body = `<div class="frame lesson-frame">
<aside class="rail" aria-label="Lessons">${rail(l.id)}</aside>
<article class="article">
<details class="rail-mobile"><summary>All lessons</summary><nav class="rail">${rail(l.id)}</nav></details>
<p class="eyebrow"><span class="chip">Lesson ${String(l.n).padStart(2, '0')}</span><span>${l.track === 'understand' ? '' : `${esc(l.trackTitle)} · `}Module ${l.moduleNo} · ${esc(l.module)}</span></p>
<h1>${esc(l.title)}</h1>
<p class="lede">${mod.lede}</p>
<div class="meta-row"><span>About ${mod.minutes} minutes</span><span>${esc(mod.youWill)}</span></div>
${softenLinks(l.id, mod.body, lessons)}
${pager}
</article></div>`;
  await out(`learn/${l.id}`, page({ title: `${l.title} · CardVault Learn`, description: mod.lede.replace(/<[^>]+>/g, ''), active: 'learn', body }));
}

await out('', homePage());
await out('learn', homePage());
await out('map', mapPage());
await out('apis', apisPage());
for (const p of apiPage()) await out(`apis/${p.slug}`, p.html);
await out('events', await eventsPage(root));
for (const p of suitePages()) await out(p.route, p.html);
problems.push(...quotes.problems);
// The explorer shows whole files, so none of them may mention seeded bugs.
for (const p of suitePaths()) if (/bug/i.test(suiteFile(p))) problems.push(`data/suite/${p}: mentions bugs`);

// 404 page
await writeFile(path.join(dist, '404.html'), page({ title: 'Page not found · CardVault Learn', body: `<div class="frame"><div class="page-head"><h1>That page does not exist</h1><p class="lede">It may be a lesson that is not written yet. <a href="/">Go to the start</a>.</p></div></div>` }));

/** Links to lessons not yet written become plain text marked "soon"; unknown ids are errors. */
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
console.log(`Built ${ready.length} lessons and ${quotes.files.length} suite excerpts into dist/.`);
