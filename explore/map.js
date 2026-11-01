/* HaploReg v5 — Map & reasoning: a Mantis-style evidence map with a replayable reasoning trace.
 *
 * The map places every variant of a locus by the similarity of its evidence profile (PCA of
 * per-tissue promoter/enhancer activity plus DNase, binding, motif, conservation, eQTL and GWAS
 * features). Tissues and evidence types appear as landmarks at their loadings, so a variant near a
 * landmark carries more of that evidence. The trace walks from the lead variant to the
 * best-supported candidate in seven logged steps, each drawn on the map. Everything is computed
 * in the browser with transparent rules: it is an explanation aid, not a causal estimate. */
(function (HR) {
  'use strict';

  var U = HR.util, esc = U.escape;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var HRMap = window.HRMap = {};

  var MECH = [
    { key: 'dnase', label: 'DNase', dot: 'var(--d-dnase)', term: 'dnase' },
    { key: 'bound', label: 'Bound', dot: 'var(--d-protein)', term: 'proteins' },
    { key: 'motif', label: 'Motif', dot: 'var(--d-motif)', term: 'motifs-changed' },
    { key: 'cons', label: 'Conserved', dot: 'var(--d-cons)', term: 'gerp' },
    { key: 'eqtl', label: 'eQTL', dot: 'var(--d-assoc)', term: 'eqtl' },
    { key: 'gwas', label: 'GWAS', dot: 'var(--d-assoc)', term: 'gwas' }
  ];
  var WEIGHTS = { reg: 0.30, acc: 0.15, bind: 0.15, motif: 0.15, cons: 0.10, expr: 0.15 };
  var PART_LABELS = { reg: 'regulatory', acc: 'open chromatin', bind: 'binding', motif: 'motif', cons: 'conservation', expr: 'eQTL' };

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  // Regulatory Build element names in running text: keep acronyms, lowercase the rest.
  function regNames(keys) { return keys.map(function (k) { return /^(CTCF|TF site)$/.test(k) ? k : k.toLowerCase(); }).join(', '); }
  function article(word) { return /^[aeiou]/i.test(word) ? 'an' : 'a'; }
  function fmt(x, d) { return (Math.round(x * Math.pow(10, d || 2)) / Math.pow(10, d || 2)).toFixed(d || 2); }

  /* ================================================================ evidence model */

  var TISSUE_SIZE = {};
  HR.EPIGENOMES.forEach(function (e) { TISSUE_SIZE[e.tissue] = (TISSUE_SIZE[e.tissue] || 0) + 1; });

  function profile(r, opts) {
    var v = r.v, s = r.s || HR.summarize(v, opts);
    var p = { tissue: {}, reg: {}, mech: {}, s: s };
    if (s.mode === 'epigenome') {
      var active = U.uniq(s.promoter.concat(s.enhancer));
      active.forEach(function (eid) {
        var t = HR.EPI_BY_ID[eid] ? HR.EPI_BY_ID[eid].tissue : null;
        if (t) p.tissue[t] = (p.tissue[t] || 0) + 1 / TISSUE_SIZE[t];
      });
      p.mech.dnase = clamp((v.dnase || []).length / 30, 0, 1);
    } else {
      (v.regfeatures || []).forEach(function (f) {
        var k = /promoter/.test(f.type) ? 'Promoter' : f.type === 'enhancer' ? 'Enhancer' : f.type === 'CTCF_binding_site' ? 'CTCF' :
          f.type === 'TF_binding_site' ? 'TF site' : null;
        if (k) p.reg[k] = 1;
        if (f.type === 'open_chromatin_region') p.mech.dnase = 1;
      });
      p.mech.dnase = p.mech.dnase || 0;
    }
    var motifs = v.motifs || [];
    var deltas = motifs.map(function (m) { return m.ref != null && m.alt != null ? Math.abs(m.alt - m.ref) : m.delta != null ? Math.abs(m.delta) * 4 : null; })
      .filter(function (x) { return x != null; });
    p.mech.motif = deltas.length ? clamp(Math.max.apply(null, deltas) / 8, 0, 1) : clamp(motifs.length / 3, 0, 1);
    p.mech.bound = s.proteins.length ? clamp(0.5 + 0.25 * s.proteins.length, 0, 1) : 0;
    p.mech.cons = v.gerpCons || v.siphyCons ? 1 : v.gerp == null ? 0 : clamp((v.gerp + 1) / 4, 0, 0.9);
    p.mech.eqtl = (v.eqtl || []).length ? clamp(0.6 + 0.1 * v.eqtl.length, 0, 1) : 0;
    p.mech.gwas = (v.gwas || []).length ? clamp(Math.log(1 + v.gwas.length) / Math.log(20), 0, 1) : 0;
    p.tissuesActive = Object.keys(p.tissue).length;
    p.regCount = Object.keys(p.reg).length;
    return p;
  }

  // Heuristic support for a candidate: LD with the lead times a weighted sum of independent evidence.
  function score(r, p) {
    var reg = p.s.mode === 'epigenome' ? clamp(p.tissuesActive / 3, 0, 1) : clamp(p.regCount, 0, 1);
    var parts = { reg: reg, acc: p.mech.dnase, bind: p.mech.bound, motif: p.mech.motif, cons: p.mech.cons, expr: p.mech.eqtl };
    var ev = 0;
    Object.keys(WEIGHTS).forEach(function (k) { ev += WEIGHTS[k] * parts[k]; });
    var coding = HR.funcClass(p.s.func) === 'nonsilent';
    if (coding) ev = Math.max(ev, 0.9);
    var ld = r.r2 == null ? 1 : r.r2;
    return { score: ld * ev, ev: ev, ld: ld, parts: parts, coding: coding };
  }

  function features(rows, profiles) {
    var mode = profiles[0].s.mode;
    var names = [];
    if (mode === 'epigenome') {
      var seen = {};
      profiles.forEach(function (p) { Object.keys(p.tissue).forEach(function (t) { seen[t] = 1; }); });
      Object.keys(seen).sort().forEach(function (t) { names.push({ key: t, label: t, kind: 'tissue', title: HR.TISSUE_NAMES[t] || t, term: 'tissue-code' }); });
    } else {
      ['Promoter', 'Enhancer', 'CTCF', 'TF site'].forEach(function (k) { names.push({ key: k, label: k, kind: 'reg', title: 'Regulatory Build: ' + k, term: 'regbuild' }); });
    }
    MECH.forEach(function (m) { names.push({ key: m.key, label: m.label, kind: 'mech', title: m.label, dot: m.dot, term: m.term }); });
    var X = profiles.map(function (p) {
      return names.map(function (f) {
        return f.kind === 'tissue' ? (p.tissue[f.key] || 0) : f.kind === 'reg' ? (p.reg[f.key] || 0) : (p.mech[f.key] || 0);
      });
    });
    // Drop features nobody has.
    var keep = names.map(function (f, j) { return X.some(function (row) { return row[j] > 0; }); });
    return {
      names: names.filter(function (f, j) { return keep[j]; }),
      X: X.map(function (row) { return row.filter(function (x, j) { return keep[j]; }); })
    };
  }

  /* ================================================================ PCA (2 components, power iteration) */

  function pca2(X) {
    var n = X.length, d = n ? X[0].length : 0;
    if (n < 3 || d < 2) return null;
    var mean = new Array(d).fill(0), sd = new Array(d).fill(0);
    X.forEach(function (row) { row.forEach(function (x, j) { mean[j] += x / n; }); });
    X.forEach(function (row) { row.forEach(function (x, j) { sd[j] += (x - mean[j]) * (x - mean[j]) / (n - 1); }); });
    sd = sd.map(function (v) { return Math.sqrt(v) || 1; });
    var Z = X.map(function (row) { return row.map(function (x, j) { return (x - mean[j]) / sd[j]; }); });
    var C = [];
    for (var a = 0; a < d; a++) {
      C.push(new Array(d).fill(0));
      for (var b = 0; b < d; b++) {
        var s = 0;
        for (var i = 0; i < n; i++) s += Z[i][a] * Z[i][b];
        C[a][b] = s / (n - 1);
      }
    }
    var total = 0;
    for (var t = 0; t < d; t++) total += C[t][t];
    function power(M) {
      var v = []; for (var j = 0; j < d; j++) v.push(1 / Math.sqrt(d) + j * 1e-3);
      var lam = 0;
      for (var it = 0; it < 300; it++) {
        var w = M.map(function (row) { return row.reduce(function (acc, x, k) { return acc + x * v[k]; }, 0); });
        var norm = Math.sqrt(w.reduce(function (acc, x) { return acc + x * x; }, 0));
        if (norm < 1e-12) return { v: v, lam: 0 };
        v = w.map(function (x) { return x / norm; });
        lam = norm;
      }
      if (v.reduce(function (acc, x) { return acc + x; }, 0) < 0) v = v.map(function (x) { return -x; });
      return { v: v, lam: lam };
    }
    var p1 = power(C);
    if (p1.lam < 1e-9) return null;
    var C2 = C.map(function (row, a2) { return row.map(function (x, b2) { return x - p1.lam * p1.v[a2] * p1.v[b2]; }); });
    var p2 = power(C2);
    var s1 = Z.map(function (row) { return row.reduce(function (acc, x, j) { return acc + x * p1.v[j]; }, 0); });
    var s2 = Z.map(function (row) { return row.reduce(function (acc, x, j) { return acc + x * p2.v[j]; }, 0); });
    return { s1: s1, s2: s2, v1: p1.v, v2: p2.v, var1: p1.lam / total, var2: p2.lam / total };
  }

  /* ================================================================ model + trace */

  function buildModel(block, opts) {
    var rows = block.rows.slice();
    var profiles = rows.map(function (r) { return profile(r, opts); });
    var scored = rows.map(function (r, i) { return score(r, profiles[i]); });
    var fs = features(rows, profiles);
    var pc = pca2(fs.X);
    var pts = rows.map(function (r, i) {
      var h = U.hash(r.v.id);
      return {
        id: r.v.id, row: r, prof: profiles[i], sc: scored[i],
        // Deterministic jitter so identical evidence profiles do not stack exactly.
        x: pc ? pc.s1[i] : (i / Math.max(1, rows.length - 1)) * 2 - 1,
        y: pc ? pc.s2[i] : scored[i].score * 2 - 1,
        jx: ((h & 255) / 255 - 0.5), jy: (((h >> 8) & 255) / 255 - 0.5)
      };
    });
    var landmarks = [];
    if (pc) {
      var maxS = Math.max.apply(null, pts.map(function (p) { return Math.max(Math.abs(p.x), Math.abs(p.y)); })) || 1;
      var mags = fs.names.map(function (f, j) { return Math.hypot(pc.v1[j], pc.v2[j]); });
      var maxL = Math.max.apply(null, mags) || 1;
      var order = mags.map(function (m, j) { return j; }).sort(function (a, b) { return mags[b] - mags[a]; });
      order.slice(0, 10).forEach(function (j) {
        if (mags[j] < maxL * 0.18) return;
        var f = fs.names[j];
        landmarks.push({ key: f.key, label: f.label, kind: f.kind, title: f.title, dot: f.dot, term: f.term,
          x: pc.v1[j] / maxL * maxS * 1.05, y: pc.v2[j] / maxL * maxS * 1.05 });
      });
    }
    return { block: block, opts: opts, pts: pts, byId: indexBy(pts), landmarks: landmarks, pc: pc, mode: profiles[0].s.mode,
      featureNames: fs.names };
  }

  function indexBy(pts) { var m = {}; pts.forEach(function (p) { m[p.id] = p; }); return m; }

  function buildTrace(model, opts, source) {
    var pts = model.pts;
    var lead = pts.filter(function (p) { return p.row.isQuery && model.block.queryId; })[0] || null;
    var thresh = opts.ldThresh === 'NA' ? null : parseFloat(opts.ldThresh);
    var steps = [];
    var ids = function (list) { return list.map(function (p) { return p.id; }); };

    steps.push({
      key: 'frame', title: 'Frame the question', tool: 'decompose(question)', out: '4 sub-questions',
      note: lead ? 'Which variant inherited with ' + lead.id + ' most plausibly drives the association, in which tissue, and by what mechanism?'
        : 'Which of these variants carries the strongest regulatory evidence, and where does it act?',
      list: ['Which variants travel with the lead?', 'Which sit in regulatory DNA?', 'In which tissues?', 'Through what mechanism?'],
      view: { active: [], dim: [] }
    });

    var cands = lead && thresh != null ? pts.filter(function (p) { return p.row.r2 != null && p.row.r2 >= thresh - 1e-9; }) : pts.slice();
    steps.push({
      key: 'retrieve', title: lead ? 'Retrieve the haplotype' : 'Gather the candidates', term: 'ld',
      tool: lead ? 'ld_neighborhood(' + lead.id + ', r² ≥ ' + opts.ldThresh + ', ' + opts.ldPop + ')' : 'collect(query set)',
      out: cands.length + ' variant' + (cands.length === 1 ? '' : 's'),
      note: lead ? 'Every variant correlated with the lead at r² ≥ ' + opts.ldThresh + ' is about equally consistent with the GWAS signal. Spokes show r² with the lead.'
        : 'Without a lead variant, every queried variant is a candidate.',
      view: { active: ids(cands), spokes: lead ? lead.id : null, hull: ids(cands), hullLabel: (lead ? 'haplotype · ' : 'candidates · ') + cands.length }
    });

    var reg = cands.filter(function (p) { return p.sc.parts.reg > 0 || p.sc.parts.acc > 0 || p.sc.parts.bind > 0 || p.sc.coding; });
    var kept = reg.length ? reg : cands;
    steps.push({
      key: 'filter', title: 'Keep regulatory candidates', term: 'bag', tool: 'filter(regulatory evidence)',
      out: kept.length + ' of ' + cands.length,
      note: reg.length ? 'Candidates with promoter, enhancer, open-chromatin, binding or coding evidence go into a bag; the rest fade.'
        : 'No candidate has regulatory evidence in this source, so all stay in the bag.',
      view: { active: ids(kept), dim: ids(pts.filter(function (p) { return kept.indexOf(p) < 0; })), hull: ids(kept), hullLabel: 'bag · regulatory candidates' }
    });

    // Tissue context: average the bag's profile and take the strongest tissues (or element types).
    var ctx = {};
    kept.forEach(function (p) {
      var src = model.mode === 'epigenome' ? p.prof.tissue : p.prof.reg;
      Object.keys(src).forEach(function (k) { ctx[k] = (ctx[k] || 0) + src[k] / kept.length; });
    });
    var ctxTop = Object.keys(ctx).sort(function (a, b) { return ctx[b] - ctx[a]; }).slice(0, 3)
      .map(function (k) { return { key: k, value: ctx[k] }; });
    steps.push({
      key: 'locate', title: 'Locate tissue context', term: 'landmark', tool: 'nearest_landmarks(bag)',
      out: ctxTop.length ? ctxTop.map(function (c) { return c.key + ' ' + fmt(c.value); }).join(' · ') : 'none',
      note: ctxTop.length ? (model.mode === 'epigenome'
        ? 'The bag leans toward ' + ctxTop.map(function (c) { return (HR.TISSUE_NAMES[c.key] || c.key).toLowerCase(); }).join(', ') + ': the share of those tissues’ epigenomes where the candidates sit in promoter or enhancer chromatin.'
        : 'The candidates overlap ' + regNames(ctxTop.map(function (c) { return c.key; })) + ' elements. The live source is not tissue-resolved; the v5 pipeline adds per-tissue states.')
        : 'No tissue or element context is available for these candidates.',
      view: { active: ids(kept), dim: ids(pts.filter(function (p) { return kept.indexOf(p) < 0; })), centroid: ids(kept), toLandmarks: ctxTop }
    });

    var ranked = kept.slice().sort(function (a, b) { return b.sc.score - a.sc.score; });
    var top = ranked[0];
    steps.push({
      key: 'fuse', title: 'Fuse evidence', term: 'evidence-score', tool: 'score(' + kept.length + ' candidate' + (kept.length === 1 ? '' : 's') + ')',
      out: top ? 'top ' + top.id + ' · ' + fmt(top.sc.score) : '—',
      note: 'Score = r² × weighted evidence: regulatory 30%, open chromatin 15%, binding 15%, motif 15%, eQTL 15%, conservation 10%. Point size now shows the score.',
      ranking: ranked.slice(0, 5),
      view: { active: ids(kept), dim: ids(pts.filter(function (p) { return kept.indexOf(p) < 0; })), sized: true, labels: ids(ranked.slice(0, 3)),
        evidence: top ? [top.id] : [] }
    });

    var path = [];
    if (lead) path.push(lead);
    ranked.slice(0, 3).reverse().forEach(function (p) { if (path.indexOf(p) < 0) path.push(p); });
    if (top && path[path.length - 1] !== top) { path = path.filter(function (p) { return p !== top; }); path.push(top); }
    steps.push({
      key: 'journey', title: 'Walk the evidence', term: 'journey', tool: 'journey(' + ids(path).join(' → ') + ')',
      out: path.length + ' waypoint' + (path.length === 1 ? '' : 's'),
      note: top ? summary(top, lead, model, source) : 'No candidate to walk to.',
      view: { active: ids(path), dim: ids(pts.filter(function (p) { return path.indexOf(p) < 0; })), sized: true, labels: ids(path), path: ids(path) }
    });

    var checks = [];
    if (top) {
      var t = top.row, p0 = top.prof;
      checks.push({ ok: lead ? (t.r2 != null && t.r2 >= 0.8) || top === lead : true,
        text: lead ? (top === lead ? 'It is the lead variant itself' : 'Strong LD with the lead (r² ' + fmt(t.r2) + ')') : 'Queried directly' });
      var tissues = Object.keys(p0.tissue);
      checks.push({ ok: tissues.length > 0 || p0.regCount > 0,
        text: tissues.length ? 'Regulatory chromatin in ' + tissues.length + ' tissue' + (tissues.length === 1 ? '' : 's') + ' (' + tissues.slice(0, 4).join(', ') + (tissues.length > 4 ? ', …' : '') + ')'
          : p0.regCount ? 'Overlaps ' + regNames(Object.keys(p0.reg)) + ' (Regulatory Build)' : 'No promoter or enhancer evidence' });
      var mech = [];
      if (p0.mech.motif > 0) mech.push('alters ' + (t.v.motifs || []).slice(0, 2).map(function (m) { return m.name; }).join(', '));
      if (p0.mech.bound > 0) mech.push('bound by ' + U.uniq((t.v.proteins || []).map(function (x) { return x.factor; })).slice(0, 2).join(', '));
      if (top.sc.coding) mech.push(t.s.func + ' coding change');
      checks.push({ ok: mech.length > 0, text: mech.length ? 'Mechanism: ' + mech.join('; ') : 'No motif, binding or coding mechanism found' });
      checks.push({ ok: p0.mech.eqtl > 0, warn: p0.mech.eqtl === 0,
        text: p0.mech.eqtl > 0 ? 'Target gene: eQTL for ' + U.uniq(t.v.eqtl.map(function (q) { return q.gene; })).slice(0, 2).join(', ') : 'No eQTL links it to a gene in this source' });
      var second = ranked[1];
      var margin = second ? top.sc.score - second.sc.score : top.sc.score;
      checks.push({ ok: margin > 0.08, warn: margin <= 0.08,
        text: second ? 'Lead over runner-up ' + second.id + ': ' + fmt(margin) + (margin > 0.15 ? ' (clear)' : margin > 0.08 ? ' (moderate)' : ' (narrow)') : 'Only one candidate' });
      if (source && source.synthetic) checks.push({ warn: true, text: 'Synthetic demo data: an illustration only' });
    }
    var passed = checks.filter(function (c) { return c.ok; }).length;
    steps.push({
      key: 'verify', title: 'Verify', tool: top ? 'verify(' + top.id + ')' : 'verify()', out: passed + ' of ' + checks.filter(function (c) { return c.ok !== undefined; }).length + ' checks',
      checks: checks,
      note: 'A transparent rule-based check, not a causal estimate. Fine-mapping, colocalization and experiments decide causality.',
      view: { active: top ? [top.id] : [], dim: ids(pts.filter(function (p) { return p !== top; })), sized: true, labels: top ? [top.id] : [], focus: top ? top.id : null }
    });
    return { steps: steps, top: top, lead: lead, ranked: ranked };
  }

  function summary(top, lead, model, source) {
    var t = top.row, bits = [];
    if (lead && top !== lead) bits.push(top.id + ' is in LD with ' + lead.id + ' (r² ' + fmt(t.r2) + ')');
    else bits.push(top.id + (lead ? ' is the lead variant' : ''));
    var tissues = Object.keys(top.prof.tissue);
    if (tissues.length) bits.push('sits in promoter or enhancer chromatin in ' + tissues.slice(0, 3).join(', ') + (tissues.length > 3 ? ' and ' + (tissues.length - 3) + ' more' : ''));
    else if (top.prof.regCount) {
      var rn = regNames(Object.keys(top.prof.reg));
      bits.push('overlaps ' + article(rn) + ' ' + rn + ' element');
    }
    var m = (t.v.motifs || [])[0];
    if (m) bits.push(m.ref != null ? 'changes ' + article(m.name) + ' ' + m.name + ' motif (Δ ' + fmt(m.alt - m.ref, 1) + ')' : 'overlaps ' + article(m.name) + ' ' + m.name + ' motif');
    if ((t.v.eqtl || []).length) bits.push('and is an eQTL for ' + t.v.eqtl[0].gene);
    return bits.join(', ') + '. It has the strongest combined support in this block' + (source && source.synthetic ? ' (synthetic data).' : '.');
  }

  /* ================================================================ geometry helpers */

  function hullOf(points) {
    if (points.length < 3) return points.slice();
    var p = points.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    var cross = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); };
    var lower = [], upper = [];
    p.forEach(function (q) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); });
    for (var i = p.length - 1; i >= 0; i--) { var q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
    upper.pop(); lower.pop();
    return lower.concat(upper);
  }
  // A rounded outline around points: hull of small circles around each one.
  function bagPath(pixels, pad) {
    var ring = [];
    pixels.forEach(function (q) { for (var k = 0; k < 16; k++) { var a = k / 16 * Math.PI * 2; ring.push([q[0] + Math.cos(a) * pad, q[1] + Math.sin(a) * pad]); } });
    var h = hullOf(ring);
    return h.length ? 'M' + h.map(function (q) { return q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('L') + 'Z' : '';
  }
  function smoothPath(pixels) {
    if (pixels.length < 2) return '';
    var d = 'M' + pixels[0][0].toFixed(1) + ' ' + pixels[0][1].toFixed(1);
    for (var i = 0; i < pixels.length - 1; i++) {
      var p0 = pixels[i - 1] || pixels[i], p1 = pixels[i], p2 = pixels[i + 1], p3 = pixels[i + 2] || p2;
      var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      var c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += 'C' + c1[0].toFixed(1) + ' ' + c1[1].toFixed(1) + ' ' + c2[0].toFixed(1) + ' ' + c2[1].toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }

  /* ================================================================ view */

  HRMap.mount = function (el, block, opts, hooks) {
    hooks = hooks || {};
    var prevStep = hooks.step != null ? hooks.step : el._hrStep;
    if (el._hrStop) el._hrStop();
    var source = HR.getSource(opts.source);
    var model = buildModel(block, opts);
    var trace = buildTrace(model, opts, source);
    var info = window.NEO ? NEO.info : function () { return ''; };

    var W = Math.max(320, Math.round(el.clientWidth > 860 ? el.clientWidth - 368 : el.clientWidth));
    var H = Math.round(clamp(W * 0.66, 340, 560));
    var pad = 56;
    var all = model.pts.map(function (p) { return [p.x, p.y]; }).concat(model.landmarks.map(function (l) { return [l.x, l.y]; }));
    var minX = Math.min.apply(null, all.map(function (q) { return q[0]; })), maxX = Math.max.apply(null, all.map(function (q) { return q[0]; }));
    var minY = Math.min.apply(null, all.map(function (q) { return q[1]; })), maxY = Math.max.apply(null, all.map(function (q) { return q[1]; }));
    var spanX = (maxX - minX) || 1, spanY = (maxY - minY) || 1;
    var sx = function (x) { return pad + (x - minX) / spanX * (W - 2 * pad); };
    var sy = function (y) { return H - pad - (y - minY) / spanY * (H - 2 * pad); };
    var jit = Math.min(W, H) * 0.012;
    model.pts.forEach(function (p) { p.px = sx(p.x) + p.jx * jit; p.py = sy(p.y) + p.jy * jit; });
    model.landmarks.forEach(function (l) { l.px = sx(l.x); l.py = sy(l.y); });
    var cx = sx(0), cy = sy(0);

    var svg = '<svg class="m-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Evidence map of ' + model.pts.length + ' variants">';
    if (model.pc) {
      svg += '<g class="m-axes"><line x1="' + pad / 2 + '" x2="' + (W - pad / 2) + '" y1="' + cy + '" y2="' + cy + '"/><line x1="' + cx + '" x2="' + cx + '" y1="' + pad / 2 + '" y2="' + (H - pad / 2) + '"/></g>';
    }
    svg += '<g class="m-landmarks">' + model.landmarks.map(function (l) {
      var anchor = l.px > W - 90 ? 'end' : l.px < 90 ? 'start' : 'middle';
      return '<g class="m-lm" data-lm="' + esc(l.key) + '"><line class="m-ray" x1="' + cx + '" y1="' + cy + '" x2="' + l.px + '" y2="' + l.py + '"/>' +
        '<path class="m-cross" d="M' + (l.px - 4) + ' ' + l.py + 'h8M' + l.px + ' ' + (l.py - 4) + 'v8"/>' +
        (l.dot ? '<circle class="m-lmdot" cx="' + l.px + '" cy="' + l.py + '" r="2.5" style="fill:' + l.dot + '"/>' : '') +
        '<text x="' + l.px + '" y="' + (l.py - 9) + '" text-anchor="' + anchor + '">' + esc(l.label) + '</text><title>' + esc(l.title) + '</title></g>';
    }).join('') + '</g>';
    svg += '<g class="m-overlay"></g><g class="m-points">' + model.pts.map(function (p) {
      return '<g class="m-pt' + (p.row.isQuery ? ' is-lead' : '') + '" data-id="' + esc(p.id) + '" transform="translate(' + p.px.toFixed(1) + ' ' + p.py.toFixed(1) + ')">' +
        '<circle class="m-ring" r="9"/><circle class="m-dot" r="' + (p.row.isQuery ? 5 : 4) + '"/></g>';
    }).join('') + '</g><g class="m-top"></g></svg>';

    var axes = model.pc ? 'PC1 ' + Math.round(model.pc.var1 * 100) + '% · PC2 ' + Math.round(model.pc.var2 * 100) + '% of evidence variance'
      : 'Too few variants to project; laid out by position and score';
    el.innerHTML =
      '<div class="map-stage"><div class="map-canvas">' + svg + '</div>' +
      '<div class="map-caption"><span>Evidence map' + info('evidence-map') + '</span><span class="mono">' + esc(axes) + '</span><span>Landmarks' + info('landmark') + '</span></div></div>' +
      '<aside class="trace" aria-label="Reasoning trace">' +
        '<div class="trace-head"><span class="trace-title">Reasoning trace' + info('reasoning-trace') + '</span>' +
          '<span class="trace-ctrl"><button type="button" class="tbtn" data-act="prev" aria-label="Previous step">‹</button>' +
          '<button type="button" class="tbtn play" data-act="play">Run</button>' +
          '<button type="button" class="tbtn" data-act="next" aria-label="Next step">›</button></span></div>' +
        '<ol class="trace-steps">' + trace.steps.map(function (s, i) {
          return '<li class="todo" data-step="' + i + '"><button type="button" class="t-row" data-goto="' + i + '"><span class="t-n"><i>' + (i + 1) + '</i><b aria-hidden="true">✓</b></span>' +
            '<span class="t-title">' + esc(s.title) + '</span><span class="t-out mono">' + esc(s.out) + '</span></button>' +
            '<div class="t-body"><code class="t-tool">' + esc(s.tool) + '</code><p>' + esc(s.note) + (s.term ? info(s.term) : '') + '</p>' + stepExtra(s) + '</div></li>';
        }).join('') + '</ol>' +
        '<div class="trace-foot">' +
          (trace.top ? '<button type="button" class="btn small" data-open="' + esc(trace.top.id) + '">Open ' + esc(trace.top.id) + '</button>' : '') +
          '<span class="pair"><button type="button" class="btn small" data-act="export">Export to Mantis</button>' + info('mantis-export') + '</span>' +
          '<span class="pair"><button type="button" class="btn small" data-act="export-evidence">Export evidence</button>' + info('mantis-evidence-export') + '</span>' +
        '</div>' +
        '<p class="trace-disclaimer">Rule-based and transparent. It explains the evidence; it does not establish causality.</p>' +
      '</aside>';

    var svgEl = el.querySelector('svg'), overlay = svgEl.querySelector('.m-overlay'), topLayer = svgEl.querySelector('.m-top');
    var stepEls = el.querySelectorAll('.trace-steps li');
    var cur = -1, timer = null, playing = false, raf = 0;

    function setClass(node, cls, on) { node.classList.toggle(cls, !!on); }

    function apply(i) {
      cur = clamp(i, 0, trace.steps.length - 1);
      el._hrStep = cur;
      var st = trace.steps[cur], v = st.view;
      stepEls.forEach(function (li, k) { li.className = k < cur ? 'done' : k === cur ? 'current' : 'todo'; });
      var act = {}, dim = {};
      (v.active || []).forEach(function (id) { act[id] = 1; });
      (v.dim || []).forEach(function (id) { dim[id] = 1; });
      svgEl.querySelectorAll('.m-pt').forEach(function (g) {
        var id = g.getAttribute('data-id'), p = model.byId[id];
        setClass(g, 'is-active', act[id]); setClass(g, 'is-dim', dim[id]);
        setClass(g, 'is-focus', v.focus === id);
        var r = v.sized ? 3 + 10 * Math.sqrt(p.sc.score) : (p.row.isQuery ? 5 : 4);
        g.querySelector('.m-dot').setAttribute('r', r.toFixed(1));
      });
      var lit = {};
      (v.toLandmarks || []).forEach(function (c) { lit[c.key] = 1; });
      overlay.innerHTML = ''; topLayer.innerHTML = '';
      cancelAnimationFrame(raf);
      var o = '';
      if (v.spokes) {
        var lead = model.byId[v.spokes];
        (v.active || []).forEach(function (id) {
          if (id === v.spokes) return;
          var p = model.byId[id];
          o += '<line class="m-spoke draw" pathLength="1" x1="' + lead.px + '" y1="' + lead.py + '" x2="' + p.px + '" y2="' + p.py + '" style="stroke-opacity:' + (0.15 + 0.6 * (p.row.r2 || 0)).toFixed(2) + '"/>';
        });
      }
      if (v.hull && v.hull.length) {
        var px = v.hull.map(function (id) { return [model.byId[id].px, model.byId[id].py]; });
        o += '<path class="m-bag" d="' + bagPath(px, 18) + '"/>';
        var topY = Math.min.apply(null, px.map(function (q) { return q[1]; })) - 26;
        var midX = px.reduce(function (s, q) { return s + q[0]; }, 0) / px.length;
        o += '<text class="m-baglabel" x="' + clamp(midX, 70, W - 70) + '" y="' + Math.max(14, topY) + '" text-anchor="middle">' + esc(v.hullLabel || '') + '</text>';
      }
      if (v.centroid && v.centroid.length) {
        var c = v.centroid.reduce(function (s, id) { s[0] += model.byId[id].px / v.centroid.length; s[1] += model.byId[id].py / v.centroid.length; return s; }, [0, 0]);
        (v.toLandmarks || []).forEach(function (t) {
          var l = model.landmarks.filter(function (x) { return x.key === t.key; })[0];
          if (!l) return;
          o += '<line class="m-link draw" pathLength="1" x1="' + c[0] + '" y1="' + c[1] + '" x2="' + l.px + '" y2="' + l.py + '"/>';
          o += '<text class="m-linklabel" x="' + ((c[0] + l.px) / 2) + '" y="' + ((c[1] + l.py) / 2 - 6) + '" text-anchor="middle">' + fmt(t.value) + '</text>';
        });
        o += '<g class="m-centroid" transform="translate(' + c[0] + ' ' + c[1] + ')"><circle r="5"/><path d="M-10 0h20M0 -10v20"/></g>';
      }
      if (v.evidence) {
        // Tie the leading candidate to its five strongest pieces of evidence.
        v.evidence.forEach(function (id) {
          var p = model.byId[id];
          var strength = function (l) { return l.kind === 'tissue' ? p.prof.tissue[l.key] || 0 : l.kind === 'reg' ? p.prof.reg[l.key] || 0 : p.prof.mech[l.key] || 0; };
          model.landmarks.filter(function (l) { return strength(l) > 0; })
            .sort(function (a, b) { return strength(b) - strength(a); }).slice(0, 5)
            .forEach(function (l) {
              o += '<line class="m-evid draw" pathLength="1" x1="' + p.px + '" y1="' + p.py + '" x2="' + l.px + '" y2="' + l.py + '"/>';
              lit[l.key] = 1;
            });
        });
      }
      svgEl.querySelectorAll('.m-lm').forEach(function (g) { setClass(g, 'lit', lit[g.getAttribute('data-lm')]); });
      overlay.innerHTML = o;
      var t = '', placed = [];
      (v.labels || []).forEach(function (id) {
        var p = model.byId[id];
        var n = v.path ? v.path.indexOf(id) + 1 : 0;
        var text = (n ? n + ' · ' : '') + id + (v.sized && !v.path ? '  ' + fmt(p.sc.score) : '');
        var w = text.length * 6.8, x = p.px + 12, y = p.py - 10;
        if (x + w > W - 8) x = p.px - 12 - w;
        // Nudge down past any label already placed on the same line.
        for (var tries = 0; tries < 6 && placed.some(function (b) { return Math.abs(b.y - y) < 14 && x < b.x + b.w && b.x < x + w; }); tries++) y += 15;
        placed.push({ x: x, y: y, w: w });
        t += '<text class="m-label" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '">' + esc(text) + '</text>';
      });
      if (v.focus) {
        var fp = model.byId[v.focus];
        t += '<circle class="m-focus" cx="' + fp.px + '" cy="' + fp.py + '" r="22"/>';
      }
      if (v.path && v.path.length > 1) {
        var wp = v.path.map(function (id) { return [model.byId[id].px, model.byId[id].py]; });
        t = '<path class="m-path draw slow" pathLength="1" d="' + smoothPath(wp) + '"/>' + t + '<circle class="m-cursor" r="5"/>';
      }
      topLayer.innerHTML = t;
      if (v.path && v.path.length > 1) runCursor();
      if (hooks.onStep) hooks.onStep(cur);
    }

    function runCursor() {
      var path = topLayer.querySelector('.m-path'), dot = topLayer.querySelector('.m-cursor');
      if (!path || !dot) return;
      var len = path.getTotalLength(), start = null, dur = reduceMotion ? 0 : 1800;
      function frame(now) {
        if (start == null) start = now;
        var k = dur ? clamp((now - start) / dur, 0, 1) : 1;
        var e = 1 - Math.pow(1 - k, 3), pt = path.getPointAtLength(len * e);
        dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
        if (k < 1) raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
    }

    function play() {
      playing = true;
      el.querySelector('[data-act="play"]').textContent = 'Pause';
      if (cur >= trace.steps.length - 1) cur = -1;
      var tick = function () {
        if (!playing) return;
        if (cur >= trace.steps.length - 1) { stop(); return; }
        apply(cur + 1);
        timer = setTimeout(tick, reduceMotion ? 900 : 2300);
      };
      tick();
    }
    function stop() {
      playing = false; clearTimeout(timer);
      var b = el.querySelector('[data-act="play"]');
      if (b) b.textContent = cur >= trace.steps.length - 1 ? 'Replay' : 'Run';
    }
    el._hrStop = function () { stop(); cancelAnimationFrame(raf); };

    el.onclick = function (e) {
      var a = e.target.closest('[data-act]'), g = e.target.closest('[data-goto]'), o = e.target.closest('[data-open]'), pt = e.target.closest('.m-pt');
      if (a) {
        var k = a.getAttribute('data-act');
        if (k === 'play') { playing ? stop() : play(); }
        else if (k === 'next') { stop(); apply(cur + 1); }
        else if (k === 'prev') { stop(); apply(cur - 1); }
        else if (k === 'export' || k === 'export-evidence') {
          var name = (block.queryId || block.title || 'locus').replace(/[^\w]+/g, '_');
          if (k === 'export') HR.download('haploreg_' + name + '_mantis.csv', HRMap.toMantisCSV(block, opts, model, trace), 'text/csv');
          else HR.download('haploreg_' + name + '_mantis_evidence.csv', HRMap.toMantisEvidenceCSV(block, opts, model, trace), 'text/csv');
        }
        return;
      }
      if (g) { stop(); apply(+g.getAttribute('data-goto')); return; }
      if (o && hooks.onOpen) { hooks.onOpen(o.getAttribute('data-open')); return; }
      if (pt && hooks.onOpen) hooks.onOpen(pt.getAttribute('data-id'));
    };
    svgEl.addEventListener('mouseover', function (e) {
      var g = e.target.closest('.m-pt');
      if (!g || !window.NEO) return;
      var p = model.byId[g.getAttribute('data-id')];
      var tissues = Object.keys(p.prof.tissue);
      NEO.tooltip('<b>' + esc(p.id) + '</b>' + (p.row.isQuery ? ' (lead)' : '') + (p.row.r2 != null ? ' · r² ' + fmt(p.row.r2) : '') +
        '<br>evidence score ' + fmt(p.sc.score) + (tissues.length ? '<br>active in ' + esc(tissues.slice(0, 5).join(', ')) : '') +
        '<br><span style="opacity:.7">click for the full record</span>', e.clientX, e.clientY);
    });
    svgEl.addEventListener('mouseout', function (e) { if (e.target.closest('.m-pt') && window.NEO) NEO.tooltip(null); });

    // Resume where a re-render left off; otherwise trace from the start.
    if (prevStep != null) apply(prevStep);
    else if (hooks.autoplay !== false) play();
    else apply(0);
    return { model: model, trace: trace };
  };

  function stepExtra(s) {
    if (s.list) return '<ul class="t-list">' + s.list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    if (s.ranking && s.ranking.length) {
      return '<div class="t-rank">' + s.ranking.map(function (p, i) {
        var parts = Object.keys(WEIGHTS).filter(function (k) { return p.sc.parts[k] > 0; }).map(function (k) { return PART_LABELS[k]; });
        return '<div class="t-rrow"><span class="mono">' + (i + 1) + ' ' + esc(p.id) + '</span><span class="t-bar"><i style="width:' + Math.round(clamp(p.sc.score, 0, 1) * 100) + '%"></i></span>' +
          '<span class="mono">' + fmt(p.sc.score) + '</span><span class="t-parts">' + esc((p.sc.coding ? ['coding'] : []).concat(parts).join(' · ') || 'no evidence') + '</span></div>';
      }).join('') + '</div>';
    }
    if (s.checks) {
      return '<ul class="t-checks">' + s.checks.map(function (c) {
        return '<li class="' + (c.ok ? 'ok' : c.warn ? 'warn' : 'no') + '"><span aria-hidden="true">' + (c.ok ? '✓' : c.warn ? '!' : '–') + '</span>' + esc(c.text) + '</li>';
      }).join('') + '</ul>';
    }
    return '';
  }

  /* ================================================================ Mantis export */

  // Where a row links back to: Explore on this site, or the public site when run outside a browser (the film tools).
  function exploreBase() {
    try { if (/^https?:$/.test(location.protocol)) return new URL('./', location.href).href; } catch (e) { /* no location */ }
    return 'https://haploreg-v5-nu.vercel.app/explore/';
  }

  // One row per variant in the corpus shape Mantis spaces ingest: title, semantic_text, then metadata.
  // haploreg_url opens the locus in Explore with that variant's record showing; Mantis types it as a link.
  HRMap.toMantisCSV = function (block, opts, model, trace) {
    model = model || buildModel(block, opts);
    trace = trace || buildTrace(model, opts, HR.getSource(opts.source));
    var src = HR.getSource(opts.source);
    var rank = {};
    trace.ranked.forEach(function (p, i) { rank[p.id] = i + 1; });
    var cols = ['title', 'semantic_text', 'document_type', 'locus', 'chr', 'pos_hg38', 'ref', 'alt', 'is_lead', 'r2_with_lead',
      'evidence_score', 'evidence_rank', 'regulatory_tissues', 'motifs', 'bound_proteins', 'gwas_traits', 'eqtl_genes',
      'consequence', 'gene', 'map_x', 'map_y', 'data_source', 'haploreg_url'];
    var q = function (x) { x = x == null ? '' : String(x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    var lines = [cols.join(',')];
    var base = exploreBase(), locus = block.queryId || block.title;
    model.pts.forEach(function (p) {
      var v = p.row.v, g = (v.genes || {}).gencode;
      var tissues = Object.keys(p.prof.tissue).concat(Object.keys(p.prof.reg));
      var text = v.id + ' (chr' + v.chr + ':' + v.pos + ' ' + v.ref + '>' + v.alt + ')' +
        (g ? ' is ' + (g.direction === 'within' ? 'within ' + g.symbol : HR.geneLabel(g)) : '') +
        (p.row.r2 != null && block.queryId && !p.row.isQuery ? ', in LD with lead ' + block.queryId + ' (r² ' + fmt(p.row.r2) + ')' : p.row.isQuery ? ', the lead variant' : '') + '. ' +
        (tissues.length ? 'Regulatory evidence: ' + tissues.join(', ') + '. ' : 'No promoter or enhancer evidence. ') +
        ((v.motifs || []).length ? 'Motifs changed: ' + v.motifs.slice(0, 4).map(function (m) { return m.name; }).join(', ') + '. ' : '') +
        ((v.gwas || []).length ? 'GWAS: ' + U.uniq(v.gwas.map(function (x) { return x.trait; })).slice(0, 3).join('; ') + '. ' : '') +
        ((v.eqtl || []).length ? 'eQTL for ' + U.uniq(v.eqtl.map(function (x) { return x.gene; })).join(', ') + '. ' : '') +
        'Evidence score ' + fmt(p.sc.score) + '.' + (src.synthetic ? ' SYNTHETIC DEMO DATA.' : '');
      lines.push([
        v.id, text, 'haploreg_variant', block.queryId || block.title, v.chr, v.pos, v.ref, v.alt, p.row.isQuery ? 1 : 0,
        p.row.r2 == null ? '' : p.row.r2, fmt(p.sc.score, 3), rank[p.id] || '', tissues.join(';'),
        (v.motifs || []).map(function (m) { return m.name; }).join(';'),
        U.uniq((v.proteins || []).map(function (x) { return x.factor; })).join(';'),
        U.uniq((v.gwas || []).map(function (x) { return x.trait; })).join(';'),
        U.uniq((v.eqtl || []).map(function (x) { return x.gene; })).join(';'),
        v.func || v.consequence || '', g ? g.symbol : '', fmt(p.x, 3), fmt(p.y, 3), src.id,
        base + '?' + new URLSearchParams({ query: locus, variant: v.id }).toString()
      ].map(q).join(','));
    });
    return lines.join('\n') + '\n';
  };

  // A finer grain for Mantis: one row per piece of evidence (each GWAS association, regulatory overlap, motif
  // change, bound protein and eQTL) plus one summary row per variant, so a locus becomes a dense map of what is
  // known about it. Every row carries its variant and haploreg_url, so anything found in Mantis opens back here.
  HRMap.toMantisEvidenceCSV = function (block, opts, model, trace) {
    model = model || buildModel(block, opts);
    trace = trace || buildTrace(model, opts, HR.getSource(opts.source));
    var src = HR.getSource(opts.source), base = exploreBase(), locus = block.queryId || block.title;
    var rank = {};
    trace.ranked.forEach(function (p, i) { rank[p.id] = i + 1; });
    var cols = ['title', 'semantic_text', 'document_type', 'evidence_type', 'variant', 'trait', 'p_value', 'neg_log10_p', 'pmid',
      'risk_allele', 'detail', 'is_lead', 'r2_with_lead', 'evidence_score', 'evidence_rank', 'gene', 'pos_hg38', 'haploreg_url', 'data_source'];
    var q = function (x) { x = x == null ? '' : String(x); return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
    var lines = [cols.join(',')];
    model.pts.forEach(function (p) {
      var v = p.row.v, g = (v.genes || {}).gencode, gene = g ? g.symbol : '';
      var who = v.id + (gene ? ' (' + gene + ')' : '') +
        (p.row.isQuery ? ', the lead variant,' : p.row.r2 != null && block.queryId ? ', in LD with ' + block.queryId + ' (r² ' + fmt(p.row.r2) + '),' : '');
      var link = base + '?' + new URLSearchParams({ query: locus, variant: v.id }).toString();
      var row = function (type, title, text, e) {
        lines.push([title, text + (src.synthetic ? ' SYNTHETIC DEMO DATA.' : ''), 'haploreg_evidence', type, v.id, e.trait || '',
          e.p == null ? '' : e.p, e.p ? fmt(-Math.log10(e.p), 1) : '', e.pmid || '', e.risk || '', e.detail || '',
          p.row.isQuery ? 1 : 0, p.row.r2 == null ? '' : p.row.r2, fmt(p.sc.score, 3), rank[p.id] || '', gene, v.pos, link, src.id
        ].map(q).join(','));
      };
      var tissues = Object.keys(p.prof.tissue).concat(Object.keys(p.prof.reg));
      row('variant', v.id, who.replace(/,$/, '') + ' at chr' + v.chr + ':' + v.pos + ' ' + v.ref + '>' + v.alt + '. ' +
        (tissues.length ? 'Regulatory evidence: ' + tissues.join(', ') + '. ' : 'No promoter or enhancer evidence. ') +
        ((v.gwas || []).length ? (v.gwas || []).length + ' GWAS associations. ' : '') + 'Evidence score ' + fmt(p.sc.score) + '.', {});
      (v.gwas || []).forEach(function (a) {
        row('gwas', v.id + ' · ' + a.trait, who + ' is associated with ' + a.trait +
          (a.p ? ' (p = ' + Number(a.p).toExponential(1) + ')' : '') + (a.riskAllele ? ', risk allele ' + a.riskAllele : '') +
          (a.pmid ? ', PMID ' + a.pmid : '') + '. NHGRI-EBI GWAS Catalog.', { trait: a.trait, p: a.p, pmid: a.pmid, risk: a.riskAllele });
      });
      tissues.forEach(function (t) {
        row('regulatory', v.id + ' · ' + t, who + ' overlaps ' + article(t) + ' ' + t + ' element in the Ensembl Regulatory Build.', { detail: t });
      });
      (v.motifs || []).forEach(function (m) {
        row('motif', v.id + ' · ' + m.name + ' motif', who + (m.ref != null ? ' changes ' : ' overlaps ') + article(m.name) + ' ' + m.name + ' motif' +
          (m.ref != null && m.alt != null ? ' (Δ ' + fmt(m.alt - m.ref, 1) + ')' : '') + '.', { detail: m.name });
      });
      (v.proteins || []).forEach(function (b) {
        row('binding', v.id + ' · ' + b.factor + ' binding', who + ' lies in a ' + b.factor + ' binding site' + (b.cell ? ' (' + b.cell + ')' : '') + '.', { detail: b.factor });
      });
      (v.eqtl || []).forEach(function (e) {
        row('eqtl', v.id + ' · eQTL ' + e.gene, who + ' is an eQTL for ' + e.gene + (e.tissue ? ' in ' + e.tissue : '') + '.', { detail: e.gene });
      });
    });
    return lines.join('\n') + '\n';
  };

  HRMap._internals = { buildModel: buildModel, buildTrace: buildTrace, pca2: pca2 };
})(window.HR);
