/* HaploReg v5 — hero art: a procedural linkage-disequilibrium landscape.
 *
 * Haploview's LD triangle, extruded: every point is a pair of simulated variants, placed between
 * them along the chromosome and set back by their distance, with height equal to r². Recombination
 * hotspots between haplotype blocks slowly strengthen and relax, so blocks merge and split.
 * Pure canvas 2D, no dependencies. Drag to turn it; hover a point to read its r². */
(function () {
  'use strict';

  var canvas = document.querySelector('canvas[data-ld-art]');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------ simulated haplotype structure */

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var R = rng(20261028);
  var N = 120;          // variants along the locus
  var SPAN = 30;        // pairs up to this many variants apart, as in a long-region LD plot
  var maf = [], gap = [], hot = [], phase = [];
  for (var i = 0; i < N; i++) maf.push(0.08 + R() * 0.42);
  for (var k = 0; k < N - 1; k++) {
    hot.push(R() < 0.085);
    gap.push(hot[k] ? 1.2 + R() * 2.4 : 0.002 + R() * 0.012);
    phase.push(R() * Math.PI * 2);
  }
  // x: position along the locus (-1..1); z: pair separation (0 = adjacent variants, 1 = SPAN apart).
  var pairs = [], rows = [];
  for (var s = 1; s <= SPAN; s++) rows.push([]);
  for (var a = 0; a < N; a++) {
    for (var b = a + 1; b < N && b - a <= SPAN; b++) {
      var pr = { i: a, j: b, x: ((a + b) / 2) / (N - 1) * 2 - 1, z: (b - a) / SPAN, n: 0.975 + R() * 0.025, h: 0, sx: 0, sy: 0, d: 0 };
      pairs.push(pr);
      rows[b - a - 1].push(pr);   // one ridge per pair separation, ordered along the locus
    }
  }
  var cum = new Float64Array(N);

  // r² from D' (decays with the recombination between the two variants) and the allele-frequency ceiling.
  function computeLD(t) {
    cum[0] = 0;
    for (var k = 0; k < N - 1; k++) {
      var g = gap[k];
      if (hot[k]) g *= 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.22 + phase[k]));
      cum[k + 1] = cum[k] + g;
    }
    for (var p = 0; p < pairs.length; p++) {
      var q = pairs[p];
      var dprime = Math.exp(-(cum[q.j] - cum[q.i]));
      var lo = Math.min(maf[q.i], maf[q.j]), hi = Math.max(maf[q.i], maf[q.j]);
      var rmax = (lo * (1 - hi)) / (hi * (1 - lo));
      q.h = dprime * dprime * (0.86 + 0.14 * rmax) * q.n;
    }
  }

  /* ------------------------------------------------------------ view */

  var W = 0, H = 0, dpr = 1, fg = '#000', bg = '#fff';
  var yaw = -0.3, pitch = 0.52, dragYaw = 0, dragPitch = 0, parX = 0, parY = 0;
  var LEN = 1.3, DEPTH = 0.72;    // world size of the ribbon: length along the locus, depth of the pair band
  var HEIGHT = 0.3;               // world height of r² = 1
  var start = null, running = true, visible = true, raf = 0;
  var pointer = null, dragging = null, hovered = null;

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    fg = cs.getPropertyValue('--fg').trim() || '#000';
    bg = cs.getPropertyValue('--bg').trim() || '#fff';
  }

  function resize() {
    var r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (!running || reduceMotion) draw(performance.now());
  }

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function ease(x) { return 1 - Math.pow(1 - clamp(x, 0, 1), 3); }

  function draw(now) {
    if (start == null) start = now;
    var t = reduceMotion ? 12 : (now - start) / 1000;
    computeLD(5 + t);

    var intro = reduceMotion ? 1 : (now - start) / 1900;
    var yw = yaw + dragYaw + parX * 0.06 + (reduceMotion ? 0 : 0.16 * Math.sin(t * 0.09));
    var pt = clamp(pitch + dragPitch + parY * 0.04, 0.18, 1.05);
    var cyw = Math.cos(yw), syw = Math.sin(yw), cp = Math.cos(pt), sp = Math.sin(pt);
    var scale = Math.min(W * 0.5, H * 1.15);
    var cx = W / 2, cy = H * 0.62, F = 3.0;
    var sweep = reduceMotion ? -9 : ((t * 0.08) % 1.6) * 2 - 1.3; // a slow scan along the locus

    function project(x, y, z, out) {
      // The variant axis runs along the back; pairs further apart come toward the viewer.
      var X = x * LEN, D = (0.5 - z) * DEPTH;
      var X2 = X * cyw - D * syw, D2 = X * syw + D * cyw;
      var up = y * cp + D2 * sp, depth = D2 * cp - y * sp;
      var kz = F / (F + depth);
      out.sx = cx + X2 * kz * scale; out.sy = cy - up * kz * scale; out.k = kz; out.d = depth;
      return out;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = fg; ctx.strokeStyle = fg;

    var tmp = {}, g = {};
    // Ground: the chromosome axis with one tick per variant.
    ctx.globalAlpha = 0.18; ctx.lineWidth = 1;
    ctx.beginPath();
    project(-1, 0, 0, tmp); ctx.moveTo(tmp.sx, tmp.sy);
    project(1, 0, 0, tmp); ctx.lineTo(tmp.sx, tmp.sy);
    ctx.stroke();
    for (var v = 0; v < N; v++) {
      project(v / (N - 1) * 2 - 1, 0, 0, tmp);
      ctx.globalAlpha = 0.4;
      ctx.fillRect(tmp.sx - 0.6, tmp.sy - 2.5 * tmp.k, 1.2, 5 * tmp.k);
    }

    for (var p = 0; p < pairs.length; p++) {
      var q = pairs[p];
      var rise = ease(intro * 1.5 - ((q.x + 1) / 2) * 0.5 - q.z * 0.3);
      q.hh = q.h * rise;
      project(q.x, q.hh * HEIGHT, q.z, q);
    }

    // Ridges are drawn from the back forward. Each first paints the page colour beneath itself,
    // hiding whatever lies behind it, then strokes its line: hidden-line terrain.
    var order = rows.map(function (row) { return { row: row, d: row[row.length >> 1].d }; })
      .sort(function (A, B) { return B.d - A.d; });
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    var step = 2 / (N - 1);
    for (var o = 0; o < order.length; o++) {
      var row = order[o].row, first = row[0], last = row[row.length - 1];
      var fade = clamp(1.3 - (order[o].d + 0.85) * 0.55, 0.22, 1);
      ctx.beginPath();
      ctx.moveTo(first.sx, first.sy);
      for (var m = 1; m < row.length; m++) ctx.lineTo(row[m].sx, row[m].sy);
      project(last.x, 0, last.z, g); ctx.lineTo(g.sx, g.sy);
      project(first.x, 0, first.z, g); ctx.lineTo(g.sx, g.sy);
      ctx.closePath();
      ctx.globalAlpha = 1; ctx.fillStyle = bg; ctx.fill();

      ctx.beginPath();
      ctx.moveTo(first.sx, first.sy);
      for (var m2 = 1; m2 < row.length; m2++) ctx.lineTo(row[m2].sx, row[m2].sy);
      ctx.globalAlpha = 0.78 * fade; ctx.strokeStyle = fg; ctx.lineWidth = 1;
      ctx.stroke();

      // The scan: one bright point per ridge, travelling along the locus.
      for (var m3 = 0; m3 < row.length; m3++) {
        if (Math.abs(row[m3].x - sweep) < step / 2) {
          ctx.globalAlpha = 0.95 * fade; ctx.fillStyle = fg;
          ctx.beginPath(); ctx.arc(row[m3].sx, row[m3].sy, 1.7 * row[m3].k, 0, Math.PI * 2); ctx.fill();
          break;
        }
      }
    }
    ctx.fillStyle = fg;

    // Hover read-out.
    hovered = null;
    if (pointer && !dragging) {
      var best = 18 * 18;
      for (var p3 = 0; p3 < pairs.length; p3++) {
        var c = pairs[p3], dx = c.sx - pointer.x, dy = c.sy - pointer.y, dd = dx * dx + dy * dy;
        if (dd < best && c.hh > 0.04) { best = dd; hovered = c; }
      }
    }
    if (hovered) {
      var hx = hovered.sx, hy = hovered.sy;
      ctx.globalAlpha = 1; ctx.lineWidth = 1.25;
      ctx.beginPath(); ctx.arc(hx, hy, 7, 0, Math.PI * 2); ctx.stroke();
      project(hovered.x, 0, hovered.z, g);
      ctx.globalAlpha = 0.5; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(g.sx, g.sy); ctx.lineTo(hx, hy); ctx.stroke(); ctx.setLineDash([]);
      var label = 'r² ' + hovered.h.toFixed(2) + '   variants ' + (hovered.i + 1) + '–' + (hovered.j + 1);
      ctx.font = '500 11.5px "Geist Mono", ui-monospace, monospace';
      var tw = ctx.measureText(label).width, lx = clamp(hx + 14, 8, W - tw - 24), ly = hy - 16;
      ctx.globalAlpha = 0.92; ctx.fillStyle = bg;
      ctx.fillRect(lx - 7, ly - 13, tw + 14, 21);
      ctx.globalAlpha = 1; ctx.fillStyle = fg;
      ctx.fillText(label, lx, ly + 2);
    }
    ctx.globalAlpha = 1;
  }

  function loop(now) {
    raf = 0;
    if (!running || !visible) return;
    draw(now);
    raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf && running && visible && !reduceMotion) raf = requestAnimationFrame(loop); }
  function redrawStatic() { if (reduceMotion || !visible) draw(performance.now()); }

  /* ------------------------------------------------------------ interaction */

  canvas.addEventListener('pointerdown', function (e) {
    dragging = { x: e.clientX, y: e.clientY, yaw: dragYaw, pitch: dragPitch, id: e.pointerId };
    canvas.classList.add('dragging');
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ }
  });
  canvas.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    parX = (pointer.x / W - 0.5) * 2; parY = (pointer.y / H - 0.5) * 2;
    if (dragging) {
      dragYaw = dragging.yaw + (e.clientX - dragging.x) * 0.006;
      dragPitch = clamp(dragging.pitch + (e.clientY - dragging.y) * 0.004, -0.3, 0.5);
    }
    redrawStatic();
  });
  function endDrag() { dragging = null; canvas.classList.remove('dragging'); }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', function () { pointer = null; parX = parY = 0; redrawStatic(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      kick();
    }).observe(canvas);
  }
  document.addEventListener('visibilitychange', function () { running = !document.hidden; kick(); });
  document.addEventListener('hr5-theme', function () { readColors(); redrawStatic(); });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', function () { readColors(); redrawStatic(); });
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize);

  readColors();
  resize();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawStatic);
  if (reduceMotion) draw(performance.now()); else kick();
})();
