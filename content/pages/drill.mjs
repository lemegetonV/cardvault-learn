// The interview drill: every interview corner from every lesson on one page, to revise from.
import { page } from '../../src/layout.mjs';
import { esc, md } from '../../src/components.mjs';
import { lessonUrl } from '../site.mjs';

export function drillPage(log) {
  const modules = [];
  for (const entry of log) {
    const key = `${entry.lesson.trackTitle} · ${entry.lesson.module}`;
    if (!modules.includes(key)) modules.push(key);
  }
  const count = log.reduce((n, e) => n + e.qa.length, 0);
  const options = modules.map((m, i) => `<option value="${i}">${esc(m)}</option>`).join('');

  const cards = log.map((entry) => {
    const mod = modules.indexOf(`${entry.lesson.trackTitle} · ${entry.lesson.module}`);
    const qas = entry.qa.map(([q, a]) => `<details class="qa dr-q" data-module="${mod}"><summary>${md(q)}</summary><div>${a}<p class="dr-from">From <a href="${lessonUrl(entry.lesson.id)}">${esc(entry.lesson.title)}</a></p></div></details>`).join('');
    return `<section class="dr-lesson interview" data-module="${mod}">
<h2><a href="${lessonUrl(entry.lesson.id)}">${esc(entry.lesson.title)}</a> <small>${esc(entry.lesson.module)}</small></h2>
<details class="dr-say"><summary>The spoken answer</summary><blockquote class="say">${entry.say}</blockquote></details>
${qas}
</section>`;
  }).join('');

  const body = `<div class="frame drill-frame">
<div class="page-head">
<p class="eyebrow"><span class="chip">Revise</span><span>${count} questions from ${log.length} lessons</span></p>
<h1>Interview drill</h1>
<p class="lede">Every interview corner from the lessons, on one page. Try to answer each question out loud before you open it. Use one-at-a-time mode for a quick mock interview.</p>
</div>

<div class="dr-tools">
<label><span>Show</span><select id="dr-module"><option value="all">All modules</option>${options}</select></label>
<button type="button" class="btn primary" id="dr-one">One at a time</button>
<button type="button" class="btn" id="dr-close-all">Close all answers</button>
</div>

<section class="dr-card" id="dr-card" hidden>
<p class="tp-label" id="dr-count"></p>
<p class="dr-card-q" id="dr-card-q"></p>
<div class="dr-card-a" id="dr-card-a" hidden></div>
<div class="dr-card-bar"><button type="button" class="btn primary" id="dr-reveal">Show the answer</button><button type="button" class="btn" id="dr-next">Next question</button><button type="button" class="btn" id="dr-stop">Back to the list</button></div>
</section>

<div id="dr-list">${cards}</div>
</div>`;

  const scripts = `<script>
(function () {
  var pick = document.getElementById('dr-module');
  var list = document.getElementById('dr-list');
  var card = document.getElementById('dr-card');
  var deck = [];
  var at = 0;
  function visible() {
    var all = Array.prototype.slice.call(list.querySelectorAll('.dr-q'));
    return all.filter(function (q) { return pick.value === 'all' || q.dataset.module === pick.value; });
  }
  function filter() {
    list.querySelectorAll('.dr-lesson').forEach(function (s) {
      s.hidden = !(pick.value === 'all' || s.dataset.module === pick.value);
    });
  }
  function shuffle(items) {
    for (var i = items.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = items[i]; items[i] = items[j]; items[j] = t;
    }
    return items;
  }
  function show() {
    var q = deck[at];
    document.getElementById('dr-count').textContent = 'Question ' + (at + 1) + ' of ' + deck.length;
    document.getElementById('dr-card-q').textContent = q.querySelector('summary').textContent;
    var answer = document.getElementById('dr-card-a');
    answer.innerHTML = q.querySelector('div').innerHTML;
    answer.hidden = true;
    document.getElementById('dr-reveal').hidden = false;
  }
  pick.addEventListener('change', function () { filter(); if (!card.hidden) start(); });
  function start() {
    deck = shuffle(visible());
    at = 0;
    if (!deck.length) return;
    card.hidden = false;
    list.hidden = true;
    show();
    card.scrollIntoView({ block: 'nearest' });
  }
  document.getElementById('dr-one').addEventListener('click', start);
  document.getElementById('dr-reveal').addEventListener('click', function () {
    document.getElementById('dr-card-a').hidden = false;
    this.hidden = true;
  });
  document.getElementById('dr-next').addEventListener('click', function () {
    at = (at + 1) % deck.length;
    if (at === 0) deck = shuffle(deck);
    show();
  });
  document.getElementById('dr-stop').addEventListener('click', function () { card.hidden = true; list.hidden = false; });
  document.getElementById('dr-close-all').addEventListener('click', function () {
    list.querySelectorAll('details').forEach(function (d) { d.open = false; });
  });
}());
</script>`;
  return page({ title: 'Interview drill · CardVault Learn', active: 'drill', body, scripts });
}
