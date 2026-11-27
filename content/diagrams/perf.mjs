// Diagrams for the performance testing lessons.
import { svg, text } from '../../src/components.mjs';

const path = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

/** Four small charts: how many users each kind of performance test applies over time. */
export function loadShapes() {
  const W = 170, H = 120, gap = 22;
  const panels = [
    { title: 'Load', sub: 'expected traffic', pts: [[0, 1], [0.15, 0.55], [0.85, 0.55], [1, 0.55]] },
    { title: 'Stress', sub: 'more until it breaks', pts: [[0, 1], [0.25, 0.75], [0.5, 0.5], [0.75, 0.25], [1, 0.05]], steps: true },
    { title: 'Spike', sub: 'a sudden jump', pts: [[0, 0.75], [0.4, 0.75], [0.45, 0.08], [0.6, 0.08], [0.65, 0.75], [1, 0.75]] },
    { title: 'Soak', sub: 'normal load, for hours', pts: [[0, 1], [0.06, 0.55], [1, 0.55]], long: true },
  ];
  let body = '';
  panels.forEach((p, i) => {
    const x0 = 20 + i * (W + gap), y0 = 40, ph = H - 30;
    let pts = p.pts;
    if (p.steps) {
      pts = [];
      p.pts.forEach(([x, y], j) => {
        if (j) pts.push([x, p.pts[j - 1][1]]);
        pts.push([x, y]);
      });
    }
    const xy = pts.map(([x, y]) => [x0 + 12 + x * (W - 20), y0 + 8 + y * (ph - 10)]);
    body += `<rect class="box-plain" x="${x0}" y="${y0 - 34}" width="${W}" height="${H + 44}" rx="10"/>`;
    body += text(x0 + W / 2, y0 - 14, p.title, 't-lg');
    body += `<path class="ln-faint" d="M${x0 + 12} ${y0 + 4} L${x0 + 12} ${y0 + ph} L${x0 + W - 8} ${y0 + ph}"/>`;
    body += `<path class="ln-accent" d="${path(xy)}"/>`;
    body += text(x0 + W / 2, y0 + ph + 18, p.sub, 't-sm t-muted');
    if (p.long) body += text(x0 + W - 12, y0 + ph - 6, 'hours →', 't-mono', 'end');
  });
  body += text(20, 186, 'Each chart: users (up) over time (across).', 't-mono', 'start');
  return svg(20 + 4 * (W + gap) - gap + 20, 196, 'Four load shapes: load holds steady, stress climbs in steps, spike jumps up and back, soak holds steady for hours', body);
}

/** Twenty response times, sorted, with the median, the 95th percentile and the average marked. */
export function percentiles() {
  // 20 made-up response times in ms: most fast, two slow.
  const times = [8, 8, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 13, 13, 14, 15, 16, 180, 240];
  const avg = times.reduce((a, b) => a + b, 0) / times.length; // 31.05
  const x0 = 60, y0 = 30, w = 600, h = 200;
  const scale = (ms) => y0 + h - (ms / 250) * h;
  const bw = w / times.length;
  let body = '';
  [0, 50, 100, 150, 200, 250].forEach((ms) => {
    body += `<path class="ln-faint" d="M${x0} ${scale(ms)} L${x0 + w} ${scale(ms)}"/>`;
    body += text(x0 - 8, scale(ms) + 4, `${ms}`, 't-mono', 'end');
  });
  body += text(x0 - 8, y0 - 12, 'ms', 't-mono', 'end');
  times.forEach((ms, i) => {
    const cls = i === 9 ? 'bar-hold' : i === 18 ? 'bar-hold' : 'bar-avail';
    const x = x0 + i * bw + 4;
    body += `<rect class="${i >= 18 ? 'bar-spent' : cls}" x="${x}" y="${scale(ms)}" width="${bw - 8}" height="${y0 + h - scale(ms)}" rx="2"/>`;
  });
  // median: between the 10th and 11th values (both 11); p95: the 19th value (180)
  const mx = x0 + 10 * bw;
  body += `<path class="ln-event" d="M${mx} ${y0} L${mx} ${y0 + h}"/>`;
  body += text(mx + 6, y0 + 14, 'median: 11 ms', 't-md t-event t-halo', 'start');
  body += `<path class="ln" d="M${x0} ${scale(avg)} L${x0 + w} ${scale(avg)}" stroke-dasharray="3 4"/>`;
  body += text(x0 + 6, scale(avg) - 8, 'average: 31 ms (no request took this long)', 't-md t-halo', 'start');
  const px = x0 + 18 * bw + bw / 2;
  body += text(px - 4, scale(180) - 8, 'p95: 180 ms', 't-md t-stop t-halo', 'end');
  body += text(x0 + w / 2, y0 + h + 22, '20 requests, fastest to slowest', 't-sm t-muted');
  return svg(700, 270, 'Twenty response times sorted from fastest to slowest: eighteen between 8 and 16 ms, two at 180 and 240 ms. The median is 11 ms, the 95th percentile 180 ms, and the average 31 ms', body);
}
