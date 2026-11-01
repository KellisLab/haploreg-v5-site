/* HaploReg v5 — Explore, the main application. */
(function () {
  'use strict';

  var U = HR.util, esc = U.escape, info = NEO.info;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var params = U.params();
  var state = {
    opts: HR.normalizeOptions(params),
    query: params.query || '',
    result: null,
    filters: {},
    sort: { key: 'pos', dir: 1 },
    tab: {},
    runId: 0
  };

  var EXAMPLES = [
    { q: 'rs7903146', note: 'TCF7L2' },
    { q: 'rs1421085', note: 'FTO' },
    { q: 'rs12740374', note: 'SORT1' },
    { q: 'rs4988235', note: 'LCT' },
    { q: 'chr10:112,990,000-113,000,000', note: '' }
  ];

  // The LD plot is monochrome: opacity carries r², so colour stays reserved for chromatin data.
  function r2Opacity(r2) { return (0.16 + 0.84 * Math.max(0, Math.min(1, r2))).toFixed(3); }

  var FILTERS = [
    { key: 'promoter', label: 'Promoter', term: 'promoter-marks', color: 'var(--c-promoter-fg)', test: function (r) { return r.s.promoter.length; } },
    { key: 'enhancer', label: 'Enhancer', term: 'enhancer-marks', color: 'var(--c-enhancer-fg)', test: function (r) { return r.s.enhancer.length; } },
    { key: 'dnase', label: 'Open chromatin', term: 'dnase', color: 'var(--c-dnase-fg)', test: function (r) { return r.s.dnase.length; } },
    { key: 'protein', label: 'Protein bound', term: 'proteins', color: 'var(--c-protein-fg)', test: function (r) { return r.s.proteins.length; } },
    { key: 'motif', label: 'Motif change', term: 'motifs-changed', color: 'var(--c-motif-fg)', test: function (r) { return r.s.motifs.length; } },
    { key: 'gwas', label: 'GWAS hit', term: 'gwas', color: 'var(--c-assoc-fg)', test: function (r) { return r.s.gwas.length; } },
    { key: 'eqtl', label: 'eQTL', term: 'eqtl', color: 'var(--c-assoc-fg)', test: function (r) { return r.s.eqtl.length; } },
    { key: 'cons', label: 'Conserved', term: 'gerp', color: 'var(--c-cons-fg)', test: function (r) { return r.s.conserved; } },
    { key: 'coding', label: 'Protein-changing', term: 'func', color: 'var(--c-coding-fg)', test: function (r) { return HR.funcClass(r.s.func) === 'nonsilent'; } }
  ];

  /* ============================================================ chrome */

  var sourceSel = $('#source');
  sourceSel.innerHTML = HR.sourceList().map(function (s) {
    return '<option value="' + s.id + '">' + esc(s.shortLabel) + '</option>';
  }).join('');
  $('#sourceInfo').innerHTML = info('data-source');
  sourceSel.addEventListener('change', function () { setOpt('source', sourceSel.value, true); });

  $('#examples').innerHTML = '<span>Try</span>' + EXAMPLES.map(function (e) {
    return '<button type="button" class="chip-btn" data-q="' + esc(e.q) + '"><b>' + esc(e.q) + '</b>' + (e.note ? ' ' + esc(e.note) : '') + '</button>';
  }).join('') + '<span style="display:inline-flex;align-items:center"><select id="traitSet" aria-label="Load a trait set" style="height:28px;font-size:12.5px;border-radius:999px;padding-left:12px"><option value="">Trait sets</option>' +
    HR.GWAS_SETS.map(function (g) { return '<option value="' + g.id + '">' + esc(g.trait) + ' (' + g.snps.length + ')</option>'; }).join('') +
    '</select>' + info('gwas-select') + '</span>';

  $('#examples').addEventListener('click', function (e) {
    var b = e.target.closest('.chip-btn');
    if (!b) return;
    $('#q').value = b.getAttribute('data-q');
    search();
  });
  $('#traitSet').addEventListener('change', function (e) {
    var set = HR.GWAS_SETS.filter(function (g) { return g.id === e.target.value; })[0];
    if (!set) return;
    $('#q').value = set.snps.join(', ');
    e.target.value = '';
    search();
  });

  function segmented(name, values, current) {
    return '<span class="segmented" role="group" data-name="' + name + '">' + values.map(function (v) {
      return '<button type="button" data-v="' + esc(v[0]) + '" aria-pressed="' + (v[0] === current) + '"' +
        (v[2] ? ' title="' + esc(v[2]) + '"' : '') + '>' + esc(v[1]) + '</button>';
    }).join('') + '</span>';
  }
  function selectHtml(name, values, current) {
    return '<select data-name="' + name + '">' + values.map(function (v) {
      return '<option value="' + esc(v[0]) + '"' + (v[0] === current ? ' selected' : '') + '>' + esc(v[1]) + '</option>';
    }).join('') + '</select>';
  }

  function renderControls() {
    var o = state.opts;
    // Remember which control had focus so keyboard users keep their place after the rebuild.
    var a = document.activeElement, focusSel = null;
    if (a && $('#controls').contains(a)) {
      if (a.tagName === 'SELECT') focusSel = 'select[data-name="' + a.getAttribute('data-name') + '"]';
      else if (a.closest('.segmented')) focusSel = '.segmented[data-name="' + a.parentNode.getAttribute('data-name') + '"] button[data-v="' + a.getAttribute('data-v') + '"]';
    }
    $('#controls').innerHTML =
      '<div class="control"><span class="lbl">LD r² ≥' + info('ld-threshold') + '</span>' +
        segmented('ldThresh', HR.LD_THRESHOLDS.map(function (t) { return [t.value, t.label]; }), o.ldThresh) + '</div>' +
      '<div class="control"><span class="lbl">Population' + info('ld-population') + '</span>' +
        segmented('ldPop', HR.POPS.map(function (p) { return [p, p, HR.POP_NAMES[p]]; }), o.ldPop) + '</div>' +
      // Display options sit behind "More options" until there are results to apply them to.
      '<div class="control adv"><span class="lbl">Epigenomes' + info('epi-source') + '</span>' +
        selectHtml('epi', [['vanilla', 'ChromHMM 15-state'], ['imputed', 'ChromHMM 25-state (imputed)'], ['methyl', 'H3K4me1 / H3K4me3 peaks'], ['acetyl', 'H3K27ac / H3K9ac peaks']], o.epi) + '</div>' +
      '<div class="control adv"><span class="lbl">Conservation' + info('cons-option') + '</span>' +
        selectHtml('cons', [['gerp', 'GERP'], ['siphy', 'SiPhy-ω'], ['both', 'Either']], o.cons) + '</div>' +
      '<div class="control adv"><span class="lbl">Genes' + info('gencode') + '</span>' +
        selectHtml('genetypes', [['gencode', 'GENCODE'], ['refseq', 'RefSeq'], ['both', 'Both']], o.genetypes) + '</div>' +
      '<div class="control adv"><label class="btn small upload">Upload rsID list<input type="file" id="upload" accept=".txt,.tsv,.csv,text/plain"></label>' + info('rsid') + '</div>' +
      '<button type="button" class="link-btn more-toggle" data-more-options>More options</button>';
    sourceSel.value = o.source;
    $('#classicLink').href = '../classic/index.html' + (state.query ? '?' + urlParams().toString() : '');
    if (focusSel) {
      var el = $('#controls').querySelector(focusSel);
      if (el) el.focus();
    }
  }

  $('#controls').addEventListener('click', function (e) {
    if (e.target.closest('[data-more-options]')) { $('#controls').classList.add('show-adv'); return; }
    var b = e.target.closest('.segmented button');
    if (!b) return;
    setOpt(b.parentNode.getAttribute('data-name'), b.getAttribute('data-v'), true);
  });
  $('#controls').addEventListener('change', function (e) {
    if (e.target.id === 'upload') {
      var f = e.target.files[0];
      if (!f) return;
      f.text().then(function (t) {
        var ids = HR.idsFromFile(t);
        if (!ids.length) { banner('error', 'No rsIDs found in ' + f.name + '.'); return; }
        $('#q').value = ids.join(', ');
        search();
      });
      return;
    }
    var name = e.target.getAttribute('data-name');
    if (name) setOpt(name, e.target.value, false);
  });

  // LD settings and source change which variants are returned; the rest only change display.
  function setOpt(name, value, requery) {
    if (state.opts[name] === value) return;
    state.opts[name] = value;
    renderControls();
    if (!state.query) return;
    // Re-query the search that produced the results, not whatever is now in the box.
    if (requery || name === 'source') { $('#q').value = state.query; search(true); return; }
    syncUrl(true);
    // While a search is running its result renders with the new options when it arrives.
    if (state.result && !state.pending) renderResults();
  }

  /* ============================================================ URL state */

  function urlParams() {
    var p = new URLSearchParams();
    if (state.query) p.set('query', state.query);
    Object.keys(HR.DEFAULTS).forEach(function (k) {
      if (k !== 'output' && state.opts[k] !== HR.DEFAULTS[k]) p.set(k, state.opts[k]);
    });
    return p;
  }
  function syncUrl(replace) {
    var url = location.pathname + (state.query ? '?' + urlParams().toString() : '');
    if (url === location.pathname + location.search) return;
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
  }
  window.addEventListener('popstate', function () {
    var p = U.params();
    state.opts = HR.normalizeOptions(p);
    state.query = p.query || '';
    $('#q').value = state.query;
    renderControls();
    if (state.query) search(true, true);
    else clearResults();
  });

  /* ============================================================ search */

  $('#searchForm').addEventListener('submit', function (e) { e.preventDefault(); search(); });

  function search(replaceUrl, fromHistory) {
    var q = $('#q').value.trim();
    if (!q) { $('#q').focus(); return; }
    // Per-block tab choices belong to one query's loci.
    if (q !== state.tabQuery) { state.tab = {}; state.tabQuery = q; }
    state.query = q;
    state.filters = {};
    state.result = null;
    state.pending = true;
    if (!fromHistory) syncUrl(replaceUrl);
    renderControls();
    closeDrawer();
    var runId = ++state.runId;
    var src = HR.getSource(state.opts.source);
    document.body.classList.add('has-results');
    $('#banners').innerHTML = sourceBanner(src);
    $('#results').innerHTML = '<div class="status-line"><span class="spinner"></span><span id="progress">Searching ' + esc(src.shortLabel) + '…</span></div>';
    $('#goBtn').disabled = true;
    HR.runQuery(q, state.opts, function (msg) {
      var p = $('#progress');
      if (p && runId === state.runId) p.textContent = msg + '…';
    }).then(function (res) {
      if (runId !== state.runId) return;
      state.result = res;
      state.pending = false;
      renderResults();
      // ?variant= (the haploreg_url column of a Mantis export) opens that variant's record once, after its block loads.
      if (params.variant && !state.variantOpened) { state.variantOpened = true; openDrawer(params.variant); }
    }, function (err) {
      if (runId !== state.runId) return;
      state.pending = false;
      $('#results').innerHTML = '<div class="banner error"><b>Search failed.</b> ' + esc(err.message) + '</div>';
    }).then(function () { if (runId === state.runId) $('#goBtn').disabled = false; });
  }

  function clearResults() {
    state.runId++; // discard any search still in flight
    state.result = null;
    state.pending = false;
    state.query = '';
    state.tab = {};
    $('#goBtn').disabled = false;
    closeDrawer();
    document.body.classList.remove('has-results');
    $('#results').innerHTML = '';
    $('#banners').innerHTML = '';
  }

  function sourceBanner(src) {
    if (src.synthetic) {
      return '<div class="banner demo"><span class="tag">Synthetic</span><div><b>Demo data, not real.</b> ' + esc(src.note) + info('data-source') + '</div></div>';
    }
    return '<div class="banner"><span class="tag">Live</span><div>' + esc(src.label) + '. ' + esc(src.note) + info('regbuild') + '</div></div>';
  }
  function banner(kind, text) {
    $('#banners').insertAdjacentHTML('beforeend', '<div class="banner ' + kind + '">' + esc(text) + '</div>');
  }

  /* ============================================================ results */

  function fmtPos(n) { return Number(n).toLocaleString('en-US'); }

  function renderResults() {
    var res = state.result;
    if (!res) return;
    res.blocks.forEach(function (b) { b.rows.forEach(function (r) { r.s = HR.summarize(r.v, state.opts); }); });

    var all = {};
    res.blocks.forEach(function (b) { b.rows.forEach(function (r) { all[r.v.id] = r; }); });
    var uniq = Object.keys(all).map(function (k) { return all[k]; });
    var count = function (f) { return uniq.filter(f.test).length; };

    // One plain sentence rather than a row of big numbers.
    var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };
    var nb = res.blocks.length;
    var where = res.parsed.kind === 'region' ? 'in this region' : 'across ' + plural(nb, 'locus', 'loci');
    var sentence = '<b>' + plural(uniq.length, 'variant', 'variants') + '</b> ' + where + '. ' +
      count(FILTERS[1]) + ' in enhancers, ' + count(FILTERS[4]) + (count(FILTERS[4]) === 1 ? ' alters' : ' alter') + ' a motif, ' +
      count(FILTERS[5]) + ' with GWAS hits.';
    var html = '<div class="summary"><p class="summary-line">' + sentence + '</p><div class="spacer"></div>' +
      '<button class="btn small" type="button" id="exportBtn">Export TSV</button>' + info('output') +
      '<button class="btn small" type="button" id="copyBtn">Copy link</button></div>';

    var msgs = [];
    res.warnings.forEach(function (w) { msgs.push(w); });
    if (res.invalid.length) msgs.push('Ignored unrecognized terms: ' + res.invalid.join(', '));
    res.notFound.forEach(function (id) { msgs.push(id + ' was not found in dbSNP / ' + res.source.ldPanel + '.'); });
    msgs.forEach(function (m) { html += '<div class="banner error" style="margin:0 0 12px">' + esc(m) + '</div>'; });

    html += '<div class="filters"><span class="label">Show variants with</span>' + FILTERS.map(function (f) {
      var g = HR.GLOSSARY_BY_ID[f.term];
      return '<button type="button" class="filter-chip" data-f="' + f.key + '" aria-pressed="' + !!state.filters[f.key] +
        '" title="' + esc(g.short) + '"><span class="dot" style="background:' + f.color + '"></span>' + esc(f.label) + '</button>';
    }).join('') + '<span class="muted" style="font-size:12px;margin-left:6px">Query variants always stay visible.</span></div>';

    res.blocks.forEach(function (b, i) { html += blockHtml(b, i); });
    if (!res.blocks.length) html += '<div class="empty-note">No variants found for this query.</div>';
    // Keep each table's scroll position across re-renders (sorting, filtering, option changes).
    var scrolls = {};
    document.querySelectorAll('#results .block').forEach(function (blk) {
      var w = blk.querySelector('.table-wrap');
      if (w) scrolls[blk.getAttribute('data-b')] = [w.scrollLeft, w.scrollTop];
    });
    $('#results').innerHTML = html;
    Object.keys(scrolls).forEach(function (i) {
      var w = document.querySelector('#results .block[data-b="' + i + '"] .table-wrap');
      if (w) { w.scrollLeft = scrolls[i][0]; w.scrollTop = scrolls[i][1]; }
    });

    res.blocks.forEach(function (b, i) {
      if ((state.tab[i] || 'table') === 'chromatin') drawHeatmap(i);
      if (state.tab[i] === 'map') mountMap(i, false);
    });
  }

  // The Mantis-style map and reasoning trace (map.js). The trace plays once per locus, then
  // re-renders (filters, options, resizing) keep the current step.
  var mapPlayed = {}, mapStep = {};
  function mountMap(i) {
    var el = document.querySelector('.mapview[data-map="' + i + '"]');
    if (!el || !window.HRMap || !state.result) return;
    var b = state.result.blocks[i];
    var key = state.query + '|' + i;
    HRMap.mount(el, b, state.opts, {
      onOpen: openDrawer,
      autoplay: !mapPlayed[key],
      step: mapPlayed[key] ? mapStep[key] : null,
      onStep: function (s) { mapStep[key] = s; }
    });
    mapPlayed[key] = true;
  }

  function visibleRows(b) {
    var active = FILTERS.filter(function (f) { return state.filters[f.key]; });
    var rows = b.rows.filter(function (r) {
      return r.isQuery || active.every(function (f) { return f.test(r); });
    });
    var k = state.sort.key, d = state.sort.dir;
    var val = {
      pos: function (r) { return HR.chrOrder(r.v.chr) * 1e10 + r.v.pos; },
      r2: function (r) { return r.r2 == null ? -1 : r.r2; },
      // Follows the Conservation option so the order matches what the column shows.
      cons: function (r) {
        var g = r.v.gerp == null ? -99 : r.v.gerp;
        if (state.opts.cons === 'siphy') return r.v.siphyCons ? 1 : 0;
        if (state.opts.cons === 'both') return (r.s.conserved ? 1000 : 0) + g;
        return g;
      },
      evidence: function (r) { return evidenceScore(r); }
    }[k] || function (r) { return r.v.pos; };
    return rows.slice().sort(function (a, c) { return (val(a) - val(c)) * d; });
  }

  // Rough ranking used by the "Evidence" sort: one point per independent line of evidence.
  function evidenceScore(r) {
    var s = r.s;
    return (s.promoter.length ? 1 : 0) + (s.enhancer.length ? 1 : 0) + (s.dnase.length ? 1 : 0) + (s.proteins.length ? 1 : 0) +
      (s.motifs.length ? 1 : 0) + (s.gwas.length ? 1 : 0) + (s.eqtl.length ? 1 : 0) + (s.conserved ? 1 : 0);
  }

  function blockHtml(b, i) {
    var q = b.rows.filter(function (r) { return r.isQuery; })[0];
    var title, meta = [];
    if (b.queryId && q) {
      var g = (q.v.genes || {}).gencode;
      title = 'Locus <span class="mono">' + esc(b.queryId) + '</span>';
      meta.push('chr' + q.v.chr + ':' + fmtPos(q.v.pos));
      if (g) meta.push(esc(HR.geneLabel(g)));
      meta.push(b.rows.length + ' variant' + (b.rows.length === 1 ? '' : 's') + ' with r² ≥ ' + esc(state.opts.ldThresh) + ' (' + state.opts.ldPop + ')');
    } else if (state.result.parsed.kind === 'region') {
      title = 'Region <span class="mono" style="color:var(--text)">' + esc(b.title) + '</span>';
      meta.push(b.rows.length + ' variants');
    } else {
      title = 'Query variants';
      meta.push(b.rows.length + ' variants, no LD expansion');
    }
    // ?view=map (or chromatin) opens every locus on that tab, so a link can land straight on the map.
    if (!state.tab[i] && /^(table|chromatin|map)$/.test(params.view || '')) state.tab[i] = params.view;
    var tab = state.tab[i] || 'table';
    var html = '<section class="block" data-b="' + i + '"><div class="block-head"><h2>' + title + '</h2>' +
      '<div class="meta">' + meta.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</div><div class="spacer"></div>' +
      (q && b.queryId ? '<button class="btn small" type="button" data-open="' + esc(q.v.id) + '">Query variant details</button>' : '') + '</div>';
    html += locusPlot(b, i);
    html += '<div class="tabs" role="tablist">' +
      '<button type="button" role="tab" data-tab="table" aria-selected="' + (tab === 'table') + '">Variants &amp; evidence</button>' +
      '<button type="button" role="tab" data-tab="chromatin" aria-selected="' + (tab === 'chromatin') + '">Chromatin states across epigenomes</button>' +
      '<button type="button" role="tab" data-tab="map" aria-selected="' + (tab === 'map') + '">Map &amp; reasoning</button></div>';
    html += '<div class="panel" data-panel="table"' + (tab === 'table' ? '' : ' hidden') + '>' + tableHtml(b) + '</div>';
    html += '<div class="panel" data-panel="chromatin"' + (tab === 'chromatin' ? '' : ' hidden') + '>' + heatmapShell(b, i) + '</div>';
    html += '<div class="panel" data-panel="map"' + (tab === 'map' ? '' : ' hidden') + '><div class="mapview" data-map="' + i + '"></div></div>';
    return html + '</section>';
  }

  /* ------------------------------------------------------------ locus plot */

  function locusPlot(b, i) {
    var rows = b.rows;
    if (!b.queryId || rows.length < 2 || rows.some(function (r) { return r.v.chr !== rows[0].v.chr || r.r2 == null; })) return '';
    // Drawn at the container's real width so labels render at their true size.
    var W = Math.max(640, Math.round($('#results').clientWidth || 1000)), H = 210, ml = 40, mr = 12, mt = 26, mb = 34;
    var minP = Math.min.apply(null, rows.map(function (r) { return r.v.pos; }));
    var maxP = Math.max.apply(null, rows.map(function (r) { return r.v.pos; }));
    var pad = Math.max(500, (maxP - minP) * 0.06);
    var x0 = minP - pad, x1 = maxP + pad;
    var minR = Math.min.apply(null, rows.map(function (r) { return r.r2; }));
    var y0 = Math.max(0, Math.floor((minR - 0.1) * 10) / 10), y1 = 1;
    var X = function (p) { return ml + (p - x0) / (x1 - x0) * (W - ml - mr); };
    var Y = function (r) { return mt + (y1 - r) / (y1 - y0) * (H - mt - mb); };

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="LD plot: r² with the query variant against position">';
    svg += '<g class="grid">';
    for (var t = y0; t <= 1.0001; t += 0.1) svg += '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + Y(t) + '" y2="' + Y(t) + '"/>';
    svg += '</g><g class="axis">';
    for (var t2 = y0; t2 <= 1.0001; t2 += (1 - y0 > 0.5 ? 0.2 : 0.1)) {
      svg += '<text x="' + (ml - 8) + '" y="' + (Y(t2) + 4) + '" text-anchor="end">' + t2.toFixed(1) + '</text>';
    }
    svg += '<text x="12" y="' + (mt + (H - mt - mb) / 2) + '" transform="rotate(-90 12 ' + (mt + (H - mt - mb) / 2) + ')" text-anchor="middle">r²</text>';
    svg += '<line x1="' + ml + '" x2="' + (W - mr) + '" y1="' + (H - mb) + '" y2="' + (H - mb) + '"/>';
    for (var k = 0; k <= 4; k++) {
      var p = x0 + (x1 - x0) * k / 4;
      svg += '<text x="' + X(p) + '" y="' + (H - mb + 18) + '" text-anchor="middle">' + (p / 1e6).toFixed(3) + ' Mb</text>';
    }
    svg += '<text x="' + (W - mr) + '" y="' + (H - 2) + '" text-anchor="end">chr' + esc(rows[0].v.chr) + ' (hg38)</text></g>';

    // Stems first, so every point sits on top of every stem.
    svg += '<g stroke="currentColor" stroke-width="1">';
    rows.forEach(function (r) {
      svg += '<line x1="' + X(r.v.pos) + '" x2="' + X(r.v.pos) + '" y1="' + (H - mb) + '" y2="' + Y(r.r2) + '" stroke-opacity="' + (r.isQuery ? 0.5 : 0.12) + '"/>';
    });
    svg += '</g>';
    rows.slice().sort(function (a, c) { return a.r2 - c.r2; }).forEach(function (r) {
      var cx = X(r.v.pos), cy = Y(r.r2);
      if (r.isQuery) {
        svg += '<circle class="pt" data-id="' + esc(r.v.id) + '" cx="' + cx + '" cy="' + cy + '" r="8" fill="var(--bg)" stroke="currentColor" stroke-width="1.5"/>';
        svg += '<circle cx="' + cx + '" cy="' + cy + '" r="3.5" fill="currentColor" pointer-events="none"/>';
        svg += '<text class="label" x="' + cx + '" y="' + (cy - 15) + '" text-anchor="middle">' + esc(r.v.id) + '</text>';
      } else {
        svg += '<circle class="pt" data-id="' + esc(r.v.id) + '" cx="' + cx + '" cy="' + cy + '" r="5" fill="currentColor" fill-opacity="' + r2Opacity(r.r2) + '"/>';
      }
    });
    svg += '</svg>';
    var legend = '<div class="legend-row"><span>r² with <span class="mono">' + esc(b.queryId) + '</span>' + info('r2') + '</span>' +
      '<span>0<span class="ramp"></span>1</span><span><span class="qmark"></span>query</span>' +
      '<span>Click a point for its record</span></div>';
    return '<div class="locus">' + svg + '</div>' + legend;
  }

  /* ------------------------------------------------------------ table */

  var COLS = [
    { key: 'variant', label: 'Variant', term: 'query-snp' },
    { key: 'pos', label: 'Position (hg38)', term: 'pos', sort: 'pos' },
    { key: 'r2', label: 'r²', term: 'r2', sort: 'r2', num: true },
    { key: 'dprime', label: 'D′', term: 'dprime', num: true },
    { key: 'alleles', label: 'Ref › Alt', term: 'ref-alt' },
    { key: 'freq', label: 'Alt freq', term: 'af' },
    { key: 'promoter', label: 'Promoter', term: 'promoter-marks' },
    { key: 'enhancer', label: 'Enhancer', term: 'enhancer-marks' },
    { key: 'dnase', label: 'DNase', term: 'dnase' },
    { key: 'proteins', label: 'Proteins', term: 'proteins' },
    { key: 'motifs', label: 'Motifs', term: 'motifs-changed' },
    { key: 'gwas', label: 'GWAS', term: 'gwas' },
    { key: 'eqtl', label: 'eQTL', term: 'eqtl' },
    { key: 'cons', label: 'Conservation', term: 'gerp', sort: 'cons' },
    { key: 'gene', label: 'Gene', term: 'gencode' },
    { key: 'func', label: 'Consequence', term: 'func' },
    { key: 'evidence', label: 'Evidence', term: 'data-source', sort: 'evidence', num: true }
  ];

  function tableHtml(b) {
    var rows = visibleRows(b);
    var head = '<tr>' + COLS.map(function (c) {
      var arrow = c.sort && state.sort.key === c.sort ? '<span class="arrow">' + (state.sort.dir > 0 ? '▲' : '▼') + '</span>' : '';
      var term = c.key === 'evidence' ? '' : info(c.term);
      return '<th' + (c.sort ? ' class="sortable" data-sort="' + c.sort + '"' : '') + (c.num ? ' style="text-align:right"' : '') +
        (c.key === 'evidence' ? ' title="Number of independent evidence types: promoter, enhancer, DNase, protein binding, motif, GWAS, eQTL, conservation"' : '') +
        '><span class="th">' + esc(c.label) + term + arrow + '</span></th>';
    }).join('') + '</tr>';
    var body = rows.map(rowHtml).join('');
    var hidden = b.rows.length - rows.length;
    return '<div class="table-wrap"><table class="grid"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
      (hidden ? '<div class="panel-pad muted" style="font-size:12.5px">' + hidden + ' variant' + (hidden === 1 ? '' : 's') + ' hidden by filters.</div>' : '');
  }

  function chip(cls, text, title) {
    return '<span class="chip ' + cls + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + esc(text) + '</span>';
  }

  function regChip(s, kind, cls) {
    var items = s[kind];
    if (!items.length) return '';
    if (s.mode === 'regbuild') {
      var labels = U.uniq(items).map(function (t) { return t.replace(/_/g, ' ').replace('open chromatin region', 'open chromatin'); });
      return chip(cls, labels.join(', '), 'Ensembl Regulatory Build');
    }
    var tissues = HR.tissuesOf(items);
    var text = tissues.length <= 2 ? tissues.join(', ') : tissues.length + ' tissues';
    return chip(cls, text, items.length + ' epigenomes: ' + HR.describeEpis(items));
  }

  function listChip(items, cls, noun) {
    if (!items || !items.length) return '';
    var text = items.length <= 2 ? items.join(', ') : items.length + ' ' + noun;
    return chip(cls, text, items.join(', '));
  }

  function rowHtml(r) {
    var v = r.v, s = r.s;
    var freqs = HR.POPS.map(function (p) {
      var f = v.af[p];
      return f == null ? '<span class="na" title="' + p + ': n/a"></span>' :
        '<span style="height:' + Math.max(1, Math.round(f * 22)) + 'px" title="' + p + ' (' + HR.POP_NAMES[p] + '): ' + HR.fmtFreq(f) + '"></span>';
    }).join('');
    var gene = HR.genesFor(v, state.opts.genetypes).map(HR.geneLabel).join(' / ');
    var fc = HR.funcClass(s.func);
    var cons = '';
    if (state.opts.cons !== 'siphy' && v.gerp != null) cons += (v.gerpCons ? chip('cons', 'GERP ' + v.gerp, 'Constrained (GERP RS ≥ 2)') : '<span class="muted">' + esc(v.gerp) + '</span>');
    if (state.opts.cons !== 'gerp' && v.siphyCons) cons += ' ' + chip('cons', 'SiPhy', 'In a SiPhy-omega constrained element');
    var gwasN = s.gwas.length, eqtlN = s.eqtl.length;
    var cells = [
      '<td><span class="rsid">' + esc(v.id) + '</span></td>',
      '<td class="mono" style="font-size:12px">' + esc(v.chr) + ':' + fmtPos(v.pos) + '</td>',
      '<td class="num">' + (r.r2 == null ? '<span class="muted">—</span>' : '<span class="r2bar"><i style="--w:' + Math.round(r.r2 * 100) + '%"></i>' + r.r2.toFixed(2) + '</span>') + '</td>',
      '<td class="num">' + (r.dprime == null ? '<span class="muted">—</span>' : r.dprime.toFixed(2)) + '</td>',
      '<td class="allele" title="' + esc(v.ref + ' › ' + v.alt) + '"><b>' + esc(HR.fmtAllele(v.ref, state.opts.oligo)) + '</b> › <b>' + esc(HR.fmtAllele(v.alt, state.opts.oligo)) + '</b></td>',
      '<td><span class="freqs">' + freqs + '</span></td>',
      '<td>' + regChip(s, 'promoter', 'promoter') + '</td>',
      '<td>' + regChip(s, 'enhancer', 'enhancer') + '</td>',
      '<td>' + regChip(s, 'dnase', 'dnase') + '</td>',
      '<td>' + listChip(s.proteins, 'protein', 'proteins') + '</td>',
      '<td>' + listChip(s.motifs, 'motif', 'motifs') + '</td>',
      '<td>' + (gwasN ? chip('assoc', gwasN + (gwasN === 1 ? ' hit' : ' hits'), s.gwas.slice(0, 8).map(function (g) { return g.trait + ' (p=' + HR.fmtP(g.p) + ')'; }).join('; ') + (gwasN > 8 ? '; …' : '')) : '') + '</td>',
      '<td>' + (eqtlN ? chip('assoc', eqtlN + (eqtlN === 1 ? ' hit' : ' hits'), s.eqtl.map(function (q) { return q.gene + ' in ' + q.tissue; }).join('; ')) : '') + '</td>',
      '<td>' + cons + '</td>',
      '<td>' + esc(gene) + '</td>',
      '<td>' + (s.func ? (fc ? chip(fc === 'nonsilent' ? 'coding' : 'plain', s.func) : '<span class="muted">' + esc(s.func) + '</span>') : '') + '</td>',
      '<td class="num">' + evidenceScore(r) + '</td>'
    ];
    return '<tr data-id="' + esc(v.id) + '" class="' + (r.isQuery ? 'query' : '') + '">' + cells.join('') + '</tr>';
  }

  /* ------------------------------------------------------------ chromatin heatmap */

  var GROUP_ORDER = ['IMR90', 'ESC', 'iPSC', 'ES-deriv', 'Blood & T-cell', 'HSC & B-cell', 'Mesench', 'Myosat', 'Epithelial',
    'Neurosph', 'Thymus', 'Brain', 'Adipose', 'Muscle', 'Heart', 'Sm. Muscle', 'Digestive', 'Other', 'ENCODE2012'];
  var EPI_ORDER = HR.EPIGENOMES.slice().sort(function (a, b) {
    return GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || (a.eid < b.eid ? -1 : 1);
  });

  function heatModel() { return state.opts.epi === 'imputed' ? 'imputed' : 'vanilla'; }

  function heatmapShell(b, i) {
    var hasStates = b.rows.some(function (r) { return r.v.states; });
    if (!hasStates) {
      return '<div class="empty-note"><p><b>Per-epigenome chromatin states aren\'t available from this data source yet.</b></p>' +
        '<p>They come from the HaploReg v5 pipeline (ChromHMM across 127 reference epigenomes). Until it is connected, the Variants tab shows Ensembl Regulatory Build overlaps ' +
        info('regbuild') + '.</p><button class="btn small" type="button" data-demo="1">Preview with demo data</button></div>';
    }
    var model = heatModel();
    var states = model === 'imputed' ? HR.STATES25 : HR.STATES15;
    var groups = U.uniq(EPI_ORDER.map(function (e) { return e.group; }));
    return '<div class="legend-row" style="padding-top:12px"><span style="font-weight:600">' + (model === 'imputed' ? 'ChromHMM 25-state (imputed)' : 'ChromHMM core 15-state') +
      info(model === 'imputed' ? 'imputed25' : 'core15') + '</span><span class="muted">Rows: variants · Columns: 127 reference epigenomes' + info('epigenome') +
      ' grouped by tissue · Hover a cell for details</span></div>' +
      '<div class="heat-wrap" data-heat="' + i + '"><div style="display:flex;align-items:flex-start">' +
      '<div class="heat-labels" style="padding-top:12px"></div><canvas class="heat-canvas" style="display:block"></canvas></div></div>' +
      '<div class="state-legend">' + groups.map(function (g) {
        return '<span><span class="sw" style="background:' + HR.GROUP_COLORS[g] + '"></span>' + esc(g) + '</span>';
      }).join('') + '</div>' +
      '<div class="state-legend" style="padding-top:0">' + states.map(function (s) {
        return '<span title="' + esc(s.name) + '"><span class="sw" style="background:' + s.color + '"></span>' + esc(s.code) + '</span>';
      }).join('') + '</div>';
  }

  function drawHeatmap(i) {
    var wrap = document.querySelector('.heat-wrap[data-heat="' + i + '"]');
    if (!wrap) return;
    var b = state.result.blocks[i];
    var rows = visibleRows(b).filter(function (r) { return r.v.states; });
    var model = heatModel();
    var cw = Math.max(5, Math.min(9, Math.floor((wrap.clientWidth - 150) / EPI_ORDER.length)));
    var ch = 15, top = 12;
    var W = cw * EPI_ORDER.length, H = top + ch * rows.length;
    var canvas = wrap.querySelector('canvas');
    var dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    var quiet = getComputedStyle(document.documentElement).getPropertyValue('--surface-2').trim() || '#f0f2f5';
    EPI_ORDER.forEach(function (e, x) {
      ctx.fillStyle = HR.GROUP_COLORS[e.group] || '#999';
      ctx.fillRect(x * cw, 0, cw - (cw > 5 ? 1 : 0), 8);
    });
    rows.forEach(function (r, y) {
      var st = model === 'imputed' ? r.v.states25 : r.v.states;
      EPI_ORDER.forEach(function (e, x) {
        var n = st && st[e.eid];
        var s = n ? HR.stateOf(n, model) : null;
        ctx.fillStyle = !s ? '#000' : /Quies/.test(s.code) ? quiet : s.color;
        ctx.fillRect(x * cw, top + y * ch, cw - (cw > 5 ? 1 : 0), ch - 1);
      });
    });
    wrap.querySelector('.heat-labels').innerHTML = rows.map(function (r) {
      return '<div class="rowlab' + (r.isQuery ? ' q' : '') + '" style="height:' + ch + 'px" data-id="' + esc(r.v.id) + '">' + esc(r.v.id) + '</div>';
    }).join('');

    canvas.onmousemove = function (ev) {
      var rect = canvas.getBoundingClientRect();
      var x = Math.floor((ev.clientX - rect.left) / cw), y = Math.floor((ev.clientY - rect.top - top) / ch);
      var e = EPI_ORDER[x];
      if (!e) { NEO.tooltip(null); return; }
      if (y < 0) {
        NEO.tooltip('<b>' + esc(e.group) + '</b>', ev.clientX, ev.clientY);
        return;
      }
      var r = rows[y];
      if (!r) { NEO.tooltip(null); return; }
      var st = model === 'imputed' ? r.v.states25 : r.v.states;
      var s = st && st[e.eid] ? HR.stateOf(st[e.eid], model) : null;
      var marks = (r.v.marks && r.v.marks[e.eid]) || [];
      NEO.tooltip('<b>' + esc(r.v.id) + '</b> · ' + e.eid + ' ' + esc(e.desc) + '<br>' + (s ? esc(s.code) + ' — ' + esc(s.name) : 'no data') +
        (marks.length ? '<br>Peaks: ' + esc(marks.join(', ')) : '') + ((r.v.dnase || []).indexOf(e.eid) >= 0 ? '<br>DNase peak' : ''), ev.clientX, ev.clientY);
    };
    canvas.onmouseleave = function () { NEO.tooltip(null); };
    canvas.onclick = function (ev) {
      var rect = canvas.getBoundingClientRect();
      var r = rows[Math.floor((ev.clientY - rect.top - top) / ch)];
      if (r) openDrawer(r.v.id);
    };
  }

  /* ------------------------------------------------------------ result interactions */

  $('#results').addEventListener('click', function (e) {
    var t = e.target;
    var f = t.closest('.filter-chip');
    if (f) {
      var k = f.getAttribute('data-f');
      state.filters[k] = !state.filters[k];
      renderResults();
      return;
    }
    var th = t.closest('th.sortable');
    if (th) {
      var key = th.getAttribute('data-sort');
      state.sort = { key: key, dir: state.sort.key === key ? -state.sort.dir : (key === 'pos' ? 1 : -1) };
      renderResults();
      return;
    }
    var tabBtn = t.closest('.tabs button');
    if (tabBtn) {
      var block = tabBtn.closest('.block');
      var i = +block.getAttribute('data-b');
      state.tab[i] = tabBtn.getAttribute('data-tab');
      block.querySelectorAll('.tabs button').forEach(function (bb) { bb.setAttribute('aria-selected', bb === tabBtn); });
      block.querySelectorAll('.panel').forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== state.tab[i]; });
      if (state.tab[i] === 'chromatin') drawHeatmap(i);
      if (state.tab[i] === 'map') mountMap(i, true);
      return;
    }
    if (t.closest('[data-demo]')) { setOpt('source', 'demo', true); return; }
    if (t.id === 'exportBtn') { HR.download('haploreg_v5_' + state.query.replace(/[^\w]+/g, '_').slice(0, 40) + '.tsv', HR.toText(state.result), 'text/tab-separated-values'); return; }
    if (t.id === 'copyBtn') {
      var done = function () { t.textContent = 'Copied'; setTimeout(function () { t.textContent = 'Copy link'; }, 1500); };
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, function () { prompt('Copy this link:', location.href); });
      else prompt('Copy this link:', location.href);
      return;
    }
    var open = t.closest('[data-open]') || t.closest('.pt') || t.closest('.rowlab') || t.closest('tbody tr[data-id]');
    if (open) openDrawer(open.getAttribute('data-open') || open.getAttribute('data-id'));
  });

  $('#results').addEventListener('mouseover', function (e) {
    var pt = e.target.closest('.pt');
    if (!pt) return;
    var r = findRow(pt.getAttribute('data-id'));
    if (!r) return;
    var s = r.s, ev = [];
    if (s.promoter.length) ev.push('promoter');
    if (s.enhancer.length) ev.push('enhancer');
    if (s.motifs.length) ev.push(s.motifs.length + ' motif' + (s.motifs.length > 1 ? 's' : ''));
    if (s.gwas.length) ev.push(s.gwas.length + ' GWAS');
    NEO.tooltip('<b>' + esc(r.v.id) + '</b>' + (r.isQuery ? ' (query)' : '') + '<br>chr' + r.v.chr + ':' + fmtPos(r.v.pos) +
      '<br>r² ' + (r.r2 == null ? '—' : r.r2.toFixed(2)) + ' · D′ ' + (r.dprime == null ? '—' : r.dprime.toFixed(2)) +
      (ev.length ? '<br>' + esc(ev.join(' · ')) : ''), e.clientX, e.clientY);
  });
  $('#results').addEventListener('mouseout', function (e) { if (e.target.closest('.pt')) NEO.tooltip(null); });

  function redrawHeatmaps() {
    if (!state.result) return;
    state.result.blocks.forEach(function (b, i) {
      if (state.tab[i] === 'chromatin') drawHeatmap(i);
      if (state.tab[i] === 'map') mountMap(i, false);
    });
  }
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(redrawHeatmaps, 150);
  });
  // The canvas bakes in theme colours, so repaint when the theme changes.
  document.addEventListener('hr5-theme', redrawHeatmaps);
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', redrawHeatmaps);
  }

  function findRow(id) {
    var found = null;
    (state.result ? state.result.blocks : []).forEach(function (b) {
      b.rows.forEach(function (r) { if (r.v.id === id && (!found || r.isQuery)) found = r; });
    });
    return found;
  }

  /* ============================================================ drawer */

  var drawer = $('#drawer'), backdrop = $('#backdrop');
  var drawerId = null, drawerSeq = 0;

  function openDrawer(id) {
    if (!id) return;
    drawerId = id;
    // Each open gets its own token, so a late response from an earlier open is ignored even for the same ID.
    var token = ++drawerSeq;
    document.querySelectorAll('tbody tr.sel').forEach(function (tr) { tr.classList.remove('sel'); });
    document.querySelectorAll('tbody tr[data-id="' + id + '"]').forEach(function (tr) { tr.classList.add('sel'); });
    drawer.innerHTML = '<div class="drawer-head"><div class="row"><h2>' + esc(id) + '</h2><div class="spacer"></div>' +
      '<button class="icon-btn" type="button" data-close aria-label="Close">✕</button></div></div>' +
      '<div class="drawer-body"><div class="status-line"><span class="spinner"></span><span class="dprog">Loading details…</span></div></div>';
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    backdrop.hidden = false;
    HR.getDetail(id, state.opts, function (msg) {
      var p = drawer.querySelector('.dprog');
      if (p && token === drawerSeq) p.textContent = msg + '…';
    }).then(function (v) {
      if (token !== drawerSeq || !drawerId) return;
      drawer.innerHTML = v ? drawerHtml(v) : '<div class="drawer-head"><div class="row"><h2>' + esc(id) + '</h2><div class="spacer"></div>' +
        '<button class="icon-btn" type="button" data-close aria-label="Close">✕</button></div></div><div class="drawer-body"><p>Not found in this data source.</p></div>';
    }, function (err) {
      if (token !== drawerSeq || !drawerId) return;
      drawer.querySelector('.drawer-body').innerHTML = '<div class="banner error">' + esc(err.message) + '</div>';
    });
  }

  function closeDrawer() {
    drawerId = null;
    drawerSeq++;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.hidden = true;
    document.querySelectorAll('tbody tr.sel').forEach(function (tr) { tr.classList.remove('sel'); });
  }
  backdrop.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawerId) closeDrawer(); });
  drawer.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) { closeDrawer(); return; }
    var more = e.target.closest('[data-more]');
    if (more) {
      more.parentNode.querySelectorAll('.extra').forEach(function (x) { x.hidden = false; });
      more.remove();
    }
    var copy = e.target.closest('[data-copy]');
    if (copy && navigator.clipboard) navigator.clipboard.writeText(copy.getAttribute('data-copy'));
  });

  function section(title, term, body, count) {
    return '<div class="section"><h3>' + esc(title) + info(term) + (count != null ? '<span class="count">' + count + '</span>' : '') + '</h3>' + body + '</div>';
  }

  function drawerHtml(v) {
    var src = HR.getSource(state.opts.source);
    var row = findRow(v.id);
    var g = (v.genes || {}).gencode;
    var facts = [chip('plain', 'chr' + v.chr + ':' + fmtPos(v.pos)), chip('plain', v.ref + ' › ' + v.alt)];
    if (v.func) facts.push(chip(HR.funcClass(v.func) === 'nonsilent' ? 'coding' : 'plain', v.func));
    if (g) facts.push(chip('plain', HR.geneLabel(g)));
    if (row && row.r2 != null && !row.isQuery) facts.push(chip('plain', 'r² ' + row.r2.toFixed(2) + ' with query'));
    if (src.synthetic) facts.push(chip('promoter', 'synthetic demo data'));
    var links = v.demo ? [] : [
      ['dbSNP', HR.links.dbsnp(v.id)], ['Ensembl', HR.links.ensembl(v.id)], ['UCSC', HR.links.ucsc(v.chr, v.pos)],
      ['GWAS Catalog', HR.links.gwas(v.id)], ['GTEx', HR.links.gtex(v.id)]
    ];
    var classicHref = '../classic/detail.html?' + new URLSearchParams({ id: v.id, source: state.opts.source, epi: state.opts.epi }).toString();
    links.push(['Classic view', classicHref]);

    var html = '<div class="drawer-head"><div class="row"><h2>' + esc(v.id) + '</h2>' +
      '<button class="icon-btn" type="button" data-copy="' + esc(v.id) + '" title="Copy rsID" aria-label="Copy rsID" style="width:28px;height:28px">⧉</button>' +
      '<div class="spacer"></div><button class="icon-btn" type="button" data-close aria-label="Close">✕</button></div>' +
      '<div class="facts">' + facts.join('') + '</div>' +
      '<div class="links">' + links.map(function (l) { return '<a href="' + esc(l[1]) + '" target="_blank" rel="noopener">' + esc(l[0]) + ' ↗</a>'; }).join('') + '</div></div>';

    html += '<div class="drawer-body">';
    html += section('Allele frequencies', 'af', freqHtml(v));
    html += section('Conservation', 'gerp', consHtml(v));
    html += chromatinHtml(v);
    if (v.proteins && v.proteins.length) {
      html += section('Proteins bound', 'proteins', '<table class="mini"><tr><th>Factor</th><th>Cell type / source</th></tr>' +
        v.proteins.map(function (p) { return '<tr><td><b>' + esc(p.factor) + '</b></td><td>' + esc(p.cell || '') + '</td></tr>'; }).join('') + '</table>', v.proteins.length);
    }
    html += motifHtml(v);
    if (v.gwas && v.gwas.length) html += section('GWAS associations', 'gwas', assocTable(v.gwas, true), v.gwas.length);
    if (v.eqtl && v.eqtl.length) {
      html += section('eQTLs', 'eqtl', '<table class="mini"><tr><th>Tissue</th><th>Gene</th><th class="num">p' + info('pvalue') + '</th><th>Source</th></tr>' +
        v.eqtl.map(function (q) { return '<tr><td>' + esc(q.tissue) + '</td><td><b>' + esc(q.gene) + '</b></td><td class="num">' + esc(HR.fmtP(q.p)) + '</td><td class="muted">' + esc(q.source) + '</td></tr>'; }).join('') + '</table>', v.eqtl.length);
    }
    if (v.grasp && v.grasp.length) html += section('GRASP QTL hits', 'grasp', assocTable(v.grasp, false), v.grasp.length);
    html += section('Genes', 'gencode', geneHtml(v));
    return html + '</div>';
  }

  function freqHtml(v) {
    var bars = '<div class="popbars">' + HR.POPS.map(function (p) {
      var f = v.af[p];
      return '<span class="pop" title="' + esc(HR.POP_NAMES[p]) + '">' + p + '</span><span class="bar"><i style="width:' + (f == null ? 0 : Math.round(f * 100)) + '%"></i></span>' +
        '<span class="val">' + (f == null ? 'n/a' : HR.fmtFreq(f)) + '</span>';
    }).join('') + '</div>';
    var kv = '<dl class="kv" style="margin-top:12px">' +
      '<dt>Alt allele' + info('ref-alt') + '</dt><dd class="mono">' + esc(v.alt) + '</dd>' +
      (v.ancestral ? '<dt>Ancestral allele' + info('ancestral') + '</dt><dd class="mono">' + esc(v.ancestral) + '</dd>' : '') +
      (v.maf != null ? '<dt>Global MAF</dt><dd>' + esc(v.maf) + (v.minorAllele ? ' (' + esc(v.minorAllele) + ')' : '') + '</dd>' : '') +
      '<dt>Panel' + info('kg') + '</dt><dd>' + esc(HR.getSource(state.opts.source).ldPanel) + '</dd></dl>';
    return bars + kv;
  }

  function consHtml(v) {
    return '<dl class="kv"><dt>GERP RS score' + info('gerp') + '</dt><dd>' +
      (v.gerp == null ? '<span class="muted">n/a</span>' : esc(v.gerp) + ' ' + (v.gerpCons ? chip('cons', 'constrained') : '<span class="muted">not constrained (&lt; 2)</span>')) + '</dd>' +
      '<dt>SiPhy-omega' + info('siphy') + '</dt><dd>' + (v.siphyCons == null ? '<span class="muted">n/a for this source</span>' : v.siphyCons ? chip('cons', 'in constrained element') : '<span class="muted">no</span>') + '</dd></dl>';
  }

  function chromatinHtml(v) {
    if (!v.states && !v.marks) {
      var feats = v.regfeatures || [];
      var body = feats.length ? '<table class="mini"><tr><th>Feature</th><th>Type</th></tr>' + feats.map(function (f) {
        return '<tr><td><a href="https://www.ensembl.org/Homo_sapiens/Regulation/Summary?rf=' + encodeURIComponent(f.id) + '" target="_blank" rel="noopener">' + esc(f.id) + '</a></td><td>' +
          chip(/promoter/.test(f.type) ? 'promoter' : f.type === 'enhancer' ? 'enhancer' : f.type === 'open_chromatin_region' ? 'dnase' : 'protein', f.type.replace(/_/g, ' ')) + '</td></tr>';
      }).join('') + '</table>' : '<p class="muted" style="margin:0">No Regulatory Build feature overlaps this variant.</p>';
      return section('Regulatory elements', 'regbuild', body +
        '<p class="muted" style="font-size:12.5px;margin:10px 0 0">Per-epigenome ChromHMM states will appear here once the v5 pipeline backend is connected.</p>', feats.length);
    }
    var model = heatModel();
    var st = model === 'imputed' ? v.states25 : v.states;
    var el = HR.regElements(v, state.opts.epi);
    var quiet = 'var(--surface-2)';
    var groups = U.uniq(EPI_ORDER.map(function (e) { return e.group; }));
    var groupRows = groups.map(function (gname) {
      var es = EPI_ORDER.filter(function (e) { return e.group === gname; });
      var cells = es.map(function (e) {
        var s = st && st[e.eid] ? HR.stateOf(st[e.eid], model) : null;
        return '<i style="flex:1;background:' + (!s ? '#000' : /Quies/.test(s.code) ? quiet : s.color) + '" title="' + e.eid + ' ' + esc(e.desc) + ': ' + (s ? esc(s.code + ' — ' + s.name) : 'no data') + '"></i>';
      }).join('');
      var nEnh = es.filter(function (e) { return el.enhancer.indexOf(e.eid) >= 0; }).length;
      var nPro = es.filter(function (e) { return el.promoter.indexOf(e.eid) >= 0; }).length;
      return '<div class="g"><span class="swatch" style="background:' + HR.GROUP_COLORS[gname] + '"></span><span style="width:110px;flex:none">' + esc(gname) +
        '</span><span class="bar">' + cells + '</span><span class="muted" style="width:92px;flex:none;text-align:right;font-size:11.5px">' +
        (nPro ? nPro + ' prom ' : '') + (nEnh ? nEnh + ' enh' : '') + '</span></div>';
    }).join('');
    var summary = '<dl class="kv" style="margin-bottom:12px">' +
      '<dt>Promoter-like' + info('promoter-marks') + '</dt><dd>' + el.promoter.length + ' epigenomes' + (el.promoter.length ? ' · ' + esc(HR.tissuesOf(el.promoter).join(', ')) : '') + '</dd>' +
      '<dt>Enhancer-like' + info('enhancer-marks') + '</dt><dd>' + el.enhancer.length + ' epigenomes' + (el.enhancer.length ? ' · ' + esc(HR.tissuesOf(el.enhancer).join(', ')) : '') + '</dd>' +
      '<dt>DNase peaks' + info('dnase') + '</dt><dd>' + (v.dnase || []).length + ' epigenomes</dd></dl>';
    var full = '<details class="doc-details" style="margin-top:12px"><summary>All 127 epigenomes' + '</summary><table class="mini"><tr><th>EID</th><th>Description</th><th>State</th><th>Peaks' + info('histone-marks') + '</th></tr>' +
      EPI_ORDER.map(function (e) {
        var s = st && st[e.eid] ? HR.stateOf(st[e.eid], model) : null;
        var marks = ((v.marks && v.marks[e.eid]) || []).concat((v.dnase || []).indexOf(e.eid) >= 0 ? ['DNase'] : []);
        var miss = (v.missing && v.missing[e.eid]) || [];
        return '<tr><td class="mono">' + e.eid + '</td><td>' + esc(e.desc) + '</td><td>' + (s ? '<span class="state-swatch" style="background:' + s.color + ';width:10px;height:10px;margin-right:4px"></span>' + esc(s.code) : '') +
          '</td><td>' + esc(marks.join(', ')) + (miss.length ? ' <span class="muted" title="Not profiled">(no ' + esc(miss.join('/')) + ')</span>' : '') + '</td></tr>';
      }).join('') + '</table></details>';
    return section('Chromatin state by tissue group', model === 'imputed' ? 'imputed25' : 'core15', summary + '<div class="group-list">' + groupRows + '</div>' + full);
  }

  function motifHtml(v) {
    var list = v.motifs || [];
    var ctx = v.context ? '<div class="seq">Ref  ' + esc(v.context.left) + '<b>' + esc(v.context.ref) + '</b>' + esc(v.context.right) + '\nAlt  ' + esc(v.context.left) + '<b>' + esc(v.context.alt) + '</b>' + esc(v.context.right) + '</div>' : '';
    if (!list.length && !(v.motifHits && v.motifHits.length)) {
      return section('Regulatory motifs', 'motifs-changed', '<p class="muted" style="margin:0 0 8px">No motif changes reported.</p>' + ctx);
    }
    var body;
    if (list.length && list[0].ref != null) {
      var maxD = Math.max.apply(null, list.map(function (m) { return Math.abs(m.alt - m.ref); })) || 1;
      body = '<table class="mini"><tr><th>Motif' + info('pwm') + '</th><th>Strand' + info('strand') + '</th><th class="num">Ref LOD' + info('lod') + '</th><th class="num">Alt LOD</th><th>Δ LOD</th></tr>' +
        list.slice().sort(function (a, b) { return Math.abs(b.alt - b.ref) - Math.abs(a.alt - a.ref); }).map(function (m) {
          var d = Math.round((m.alt - m.ref) * 10) / 10;
          var w = Math.round(Math.abs(d) / maxD * 60);
          return '<tr><td><b title="' + esc(m.id) + '">' + esc(m.name) + '</b></td><td>' + esc(m.strand) + '</td><td class="num">' + esc(m.ref) + '</td><td class="num">' + esc(m.alt) + '</td>' +
            '<td><span class="delta"><i class="' + (d < 0 ? 'neg' : 'pos') + '" style="width:' + w + 'px"></i>' + (d > 0 ? '+' : '') + d + '</span></td></tr>';
        }).join('') + '</table><p class="muted" style="font-size:12px;margin:8px 0">Negative Δ: the alternate allele weakens the match; positive: it strengthens it.</p>';
    } else if (list.length) {
      body = '<table class="mini"><tr><th>Factor(s)</th><th>Matrix</th><th>Strand' + info('strand') + '</th><th class="num">Score change' + info('lod') + '</th></tr>' +
        list.map(function (m) {
          return '<tr><td><b>' + esc(m.name) + '</b></td><td class="mono">' + esc(m.id || '') + '</td><td>' + esc(m.strand) + '</td><td class="num">' +
            (m.delta == null ? '—' : esc(Math.round(m.delta * 1000) / 1000)) + (m.highInf ? ' ' + chip('motif', 'high-info position') : '') + '</td></tr>';
        }).join('') + '</table>';
    } else body = '';
    var extra = (v.motifHits || []).filter(function (h) { return !list.some(function (m) { return m.id === h.matrix; }); });
    if (extra.length) {
      body += '<p class="muted" style="font-size:12.5px;margin:10px 0 4px">Ensembl motif features overlapping the variant:</p><table class="mini"><tr><th>Factor(s)</th><th>Matrix</th><th>Strand</th><th class="num">Score</th></tr>' +
        extra.map(function (h) { return '<tr><td><b>' + esc(h.tf) + '</b></td><td class="mono">' + esc(h.matrix) + '</td><td>' + esc(h.strand) + '</td><td class="num">' + esc(Math.round(h.score * 100) / 100) + '</td></tr>'; }).join('') + '</table>';
    }
    return section('Regulatory motifs', 'motifs-changed', body + (ctx ? '<p class="muted" style="font-size:12.5px;margin:10px 0 4px">Sequence context' + info('ref-alt') + '</p>' + ctx : ''), list.length || extra.length);
  }

  function assocTable(list, withRisk) {
    var LIMIT = 12;
    return '<table class="mini"><tr><th>Trait</th><th class="num">p' + info('pvalue') + '</th>' + (withRisk ? '<th>Risk</th>' : '') + '<th>PMID</th></tr>' +
      list.map(function (g, i) {
        return '<tr' + (i >= LIMIT ? ' class="extra" hidden' : '') + '><td>' + esc(g.trait) + '</td><td class="num">' + esc(HR.fmtP(g.p)) + '</td>' +
          (withRisk ? '<td class="mono">' + esc(g.riskAllele || '') + '</td>' : '') +
          '<td>' + (g.pmid ? '<a href="' + HR.links.pubmed(g.pmid) + '" target="_blank" rel="noopener">' + esc(g.pmid) + '</a>' : '<span class="muted">—</span>') + '</td></tr>';
      }).join('') + '</table>' + (list.length > LIMIT ? '<button class="btn small showmore" type="button" data-more>Show all ' + list.length + '</button>' : '');
  }

  function geneHtml(v) {
    var g = v.genes || {};
    var item = function (label, x, link) {
      if (!x) return '<dt>' + label + '</dt><dd class="muted">n/a for this source</dd>';
      var where = x.direction === 'within' ? 'within gene' : fmtPos(x.distance) + ' bp ' + x.direction + ' of gene';
      return '<dt>' + label + '</dt><dd><b>' + (link && !v.demo ? '<a href="' + link + '" target="_blank" rel="noopener">' + esc(x.symbol) + '</a>' : esc(x.symbol)) + '</b> · ' +
        esc(where) + info('direction') + (x.desc ? '<br><span class="muted" style="font-size:12.5px">' + esc(x.desc) + '</span>' : '') + '</dd>';
    };
    return '<dl class="kv">' + item('GENCODE', g.gencode, g.gencode && HR.links.gene(g.gencode.id)) + item('RefSeq', g.refseq) +
      '<dt>Consequence' + info('func') + '</dt><dd>' + esc(v.func || v.consequence || 'intergenic / non-coding') + '</dd></dl>';
  }

  /* ============================================================ boot */

  $('#q').value = state.query;
  renderControls();
  if (state.query) search(true, true);
  else $('#q').focus();
})();
