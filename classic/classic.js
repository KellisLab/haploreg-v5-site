/* HaploReg v5 Classic — query page (the equivalent of v4's haploreg.php). */
(function () {
  'use strict';

  var U = HR.util, esc = U.escape;
  var form = document.getElementById('hrform');
  var resultsEl = document.getElementById('results');
  var params = U.params();
  var opts = HR.normalizeOptions(params);
  var OPTION_FIELDS = ['ldThresh', 'ldPop', 'epi', 'cons', 'genetypes', 'trunc', 'oligo', 'output', 'source'];

  /* ------------------------------------------------------------ form setup */

  var navLinks = form.querySelectorAll('ul.tabbernav a');
  var tabs = form.querySelectorAll('.tabbertab');
  function selectTab(i) {
    tabs.forEach(function (t, j) { t.classList.toggle('tabbertabhide', j !== i); });
    navLinks.forEach(function (a, j) { a.parentNode.className = j === i ? 'tabberactive' : ''; });
  }
  navLinks.forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); selectTab(+a.getAttribute('data-tab')); });
  });

  function fillSelect(sel, pairs) {
    sel.innerHTML = pairs.map(function (p) {
      return '<option value="' + esc(p[0]) + '">' + esc(p[1]) + '</option>';
    }).join('');
  }
  fillSelect(form.ldThresh, HR.LD_THRESHOLDS.map(function (t) { return [t.value, t.label]; }));
  fillSelect(form.epi, HR.EPI_SOURCES.map(function (s) { return [s.id, s.label]; }));
  fillSelect(form.source, HR.sourceList().map(function (s) { return [s.id, s.label]; }));
  fillSelect(form.gwas_idx, [['', '']].concat(HR.GWAS_SETS.map(function (g) {
    return [g.id, g.trait + ' (curated lead SNPs, ' + g.snps.length + ' SNP' + (g.snps.length === 1 ? '' : 's') + ')'];
  })));
  document.getElementById('ldPopCell').innerHTML = HR.POPS.map(function (p) {
    return '<input type="radio" name="ldPop" value="' + p + '" title="' + esc(HR.POP_NAMES[p]) + '"> ' + p;
  }).join('');

  /* ------------------------------------------------------------ help links */

  function help(id) {
    var g = HR.GLOSSARY_BY_ID[id];
    return '<a class="help docpopup" href="documentation.html#' + id + '" title="' + esc(g ? g.term + ': ' + g.short : '') + '">?</a>';
  }

  var OPTION_HELP = {
    query: 'rsid', upload_file: 'rsid', gwas_idx: 'gwas-select', ldThresh: 'ld-threshold', ldPop: 'ld-population',
    epi: 'epi-source', cons: 'cons-option', genetypes: 'gencode', trunc: 'trunc', oligo: 'oligo', output: 'output',
    source: 'data-source'
  };
  form.querySelectorAll('table.optiontable tr').forEach(function (tr) {
    var field = tr.querySelector('input[name], select[name]');
    var id = field && OPTION_HELP[field.name];
    if (id) tr.cells[0].insertAdjacentHTML('beforeend', ' ' + help(id));
  });

  // Documentation opens in a pop-up window, as in v4; falls back to a normal link if blocked.
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.docpopup');
    if (!a) return;
    var w = window.open(a.href, 'hrdoc', 'width=820,height=820,scrollbars=yes,resizable=yes');
    if (w) { e.preventDefault(); w.focus(); }
  });

  function setRadio(name, value) {
    form.querySelectorAll('input[name="' + name + '"]').forEach(function (r) { r.checked = r.value === value; });
  }
  function getValue(name) {
    var el = form.elements[name];
    if (el && el.tagName === 'SELECT') return el.value || HR.DEFAULTS[name];
    var checked = form.querySelector('input[name="' + name + '"]:checked');
    return checked ? checked.value : HR.DEFAULTS[name];
  }

  // Uploaded lists too long for a URL are kept in sessionStorage and referenced by `qref`.
  var MAX_URL_QUERY = 6000;
  var storedQuery = null;
  if (params.qref) {
    try { storedQuery = sessionStorage.getItem('hr5-q-' + params.qref); } catch (e) { storedQuery = null; }
  }

  form.query.value = params.query || storedQuery || '';
  form.gwas_idx.value = params.gwas_idx || '';

  // Whichever input the user touched last wins, so a restored query never overrides a new upload or GWAS choice.
  form.query.addEventListener('input', function () { form.gwas_idx.value = ''; form.upload_file.value = ''; });
  form.gwas_idx.addEventListener('change', function () {
    if (form.gwas_idx.value) { form.query.value = ''; form.upload_file.value = ''; }
  });
  form.upload_file.addEventListener('change', function () {
    if (form.upload_file.files.length) { form.query.value = ''; form.gwas_idx.value = ''; }
  });
  ['ldThresh', 'epi', 'source', 'trunc', 'oligo'].forEach(function (n) { form.elements[n].value = opts[n]; });
  ['ldPop', 'cons', 'genetypes', 'output'].forEach(function (n) { setRadio(n, opts[n]); });

  function updatePanelLabel() {
    document.getElementById('ldPanelLabel').textContent = HR.getSource(form.source.value).ldPanel;
  }
  updatePanelLabel();
  form.source.addEventListener('change', updatePanelLabel);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var file = form.upload_file.files[0];
    var text = form.query.value.trim();
    var go = function (query) {
      var p = new URLSearchParams();
      if (query && encodeURIComponent(query).length > MAX_URL_QUERY) {
        var key = U.hash(query).toString(36);
        try {
          sessionStorage.setItem('hr5-q-' + key, query);
          p.set('qref', key);
        } catch (err) {
          resultsEl.innerHTML = '<p class="error">This list is too long to submit in this browser. Please split it into smaller files.</p>';
          return;
        }
      } else if (query) p.set('query', query);
      else if (form.gwas_idx.value) p.set('gwas_idx', form.gwas_idx.value);
      else { resultsEl.innerHTML = '<p class="error">Please enter a query, upload a file, or select a GWAS.</p>'; return; }
      OPTION_FIELDS.forEach(function (n) {
        var v = getValue(n);
        if (v !== HR.DEFAULTS[n]) p.set(n, v);
      });
      location.search = p.toString();
    };
    if (!text && file) {
      file.text().then(function (t) {
        var ids = HR.idsFromFile(t);
        if (!ids.length) { resultsEl.innerHTML = '<p class="error">No rsIDs found in ' + esc(file.name) + '.</p>'; return; }
        go(ids.join(','));
      });
    } else {
      go(text);
    }
  });

  /* ------------------------------------------------------------ run */

  var queryText = params.query || storedQuery || '';
  if (params.qref && !storedQuery) {
    resultsEl.innerHTML = '<p class="error">This link refers to an uploaded rsID list that is only stored in the browser tab it was uploaded from. Please upload the file again.</p>';
  }
  if (!queryText && params.gwas_idx) {
    var set = HR.GWAS_SETS.filter(function (g) { return g.id === params.gwas_idx; })[0];
    if (set) queryText = set.snps.join(',');
  }
  if (queryText) run(queryText);

  function run(text) {
    var status = document.createElement('p');
    status.className = 'status';
    status.textContent = 'Searching...';
    resultsEl.innerHTML = '';
    resultsEl.appendChild(status);
    HR.runQuery(text, opts, function (msg) { status.textContent = msg + '...'; }).then(function (res) {
      if (opts.output === 'text') {
        document.title = 'HaploReg v5 text output';
        document.body.innerHTML = '<pre class="textoutput">' + esc(HR.toText(res)) + '</pre>';
        return;
      }
      resultsEl.innerHTML = render(res);
    }, function (err) {
      resultsEl.innerHTML = '<p class="error">Error: ' + esc(err.message) + '</p>';
    });
  }

  /* ------------------------------------------------------------ rendering */

  function render(res) {
    var src = res.source;
    var html = '';
    if (src.synthetic) html += '<p class="demo-warning"><b>Demo data.</b> ' + esc(src.note) + '</p>';
    else html += '<p class="source-note">Data source: ' + esc(src.label) + '. ' + esc(src.note) + '</p>';
    res.warnings.forEach(function (w) { html += '<p class="error">' + esc(w) + '</p>'; });
    if (res.invalid.length) html += '<p class="error">Ignored unrecognized query terms: ' + esc(res.invalid.join(', ')) + '</p>';
    res.notFound.forEach(function (id) {
      html += '<p>Query SNP <font color="red">' + esc(id) + '</font> was not found in dbSNP / ' + esc(src.ldPanel) + '.</p>';
    });
    res.blocks.forEach(function (b) {
      if (b.queryId) {
        html += 'Query SNP: <font color="red">' + esc(b.queryId) + '</font> and variants with r<sup>2</sup> &gt;= ' + esc(opts.ldThresh) + '<br>';
      } else if (res.parsed.kind === 'region') {
        html += 'Variants in ' + esc(b.title) + ' (' + b.rows.length + ' variants):<br>';
      } else {
        html += 'Query SNPs:<br>';
      }
      html += table(b) + '<br>';
    });
    if (!res.blocks.length && !res.notFound.length) html += '<p>No variants found.</p>';
    return html;
  }

  // [label, glossary id]
  function headers() {
    var h = [['chr', 'pos'], ['pos (hg38)', 'pos'], ['LD<br>(r²)', 'r2'], ["LD<br>(D')", 'dprime'],
      ['variant', 'query-snp'], ['Ref', 'ref-alt'], ['Alt', 'ref-alt']];
    HR.POPS.forEach(function (p) { h.push([p + '<br>freq', 'af']); });
    if (opts.cons !== 'siphy') h.push(['GERP<br>cons', 'gerp']);
    if (opts.cons !== 'gerp') h.push(['SiPhy<br>cons', 'siphy']);
    h.push(['Promoter<br>histone marks', 'promoter-marks'], ['Enhancer<br>histone marks', 'enhancer-marks'],
      ['DNAse', 'dnase'], ['Proteins<br>bound', 'proteins'], ['Motifs<br>changed', 'motifs-changed'],
      ['NHGRI/EBI<br>GWAS hits', 'gwas'], ['GRASP QTL<br>hits', 'grasp'], ['Selected eQTL<br>hits', 'eqtl']);
    if (opts.genetypes !== 'refseq') h.push(['GENCODE<br>genes', 'gencode']);
    if (opts.genetypes !== 'gencode') h.push(['RefSeq<br>genes', 'refseq']);
    h.push(['dbSNP<br>func annot', 'func']);
    return h;
  }

  function table(b) {
    var html = '<table class="resulttable"><tr class="header">' + headers().map(function (x) {
      return '<td class="colhead"><b>' + x[0] + '</b>' + help(x[1]) + '</td>';
    }).join('') + '</tr>';
    b.rows.forEach(function (r) { html += row(r); });
    return html + '</table>';
  }

  function td(x) { return '<td>' + esc(x == null ? '' : x) + '</td>'; }
  function tdc(cls, text, title) {
    return '<td class="' + cls + '"><span title="' + esc(title) + '">' + esc(text) + '</span></td>';
  }

  function detailLink(id) {
    var p = new URLSearchParams({ id: id });
    ['source', 'epi', 'cons', 'genetypes'].forEach(function (n) { if (opts[n] !== HR.DEFAULTS[n]) p.set(n, opts[n]); });
    return 'detail.html?' + p.toString();
  }

  function row(r) {
    var v = r.v, s = HR.summarize(v, opts);
    var trunc = parseInt(opts.trunc, 10);
    var cells = [
      td(v.chr), td(v.pos), td(r.r2), td(r.dprime),
      '<td><a href="' + esc(detailLink(v.id)) + '" style="color: rgb(' + (r.isQuery ? '255,0,0' : '0,0,0') +
        ')" target="_blank">' + esc(v.id) + '</a></td>',
      '<td title="' + esc(v.ref) + '">' + esc(HR.fmtAllele(v.ref, opts.oligo)) + '</td>',
      '<td title="' + esc(v.alt) + '">' + esc(HR.fmtAllele(v.alt, opts.oligo)) + '</td>'
    ];
    HR.POPS.forEach(function (p) { cells.push(td(HR.fmtFreq(v.af[p]))); });
    if (opts.cons !== 'siphy') cells.push(v.gerpCons ? '<td title="GERP RS ' + esc(v.gerp) + '">Yes</td>' : '<td></td>');
    if (opts.cons !== 'gerp') cells.push(v.siphyCons ? '<td>Yes</td>' : '<td></td>');

    cells.push(regCell(s, 'promoter', trunc), regCell(s, 'enhancer', trunc), regCell(s, 'dnase', trunc));
    cells.push(listCell(s.proteins, 'proteins', trunc, function (n) { return n === 1 ? '1 bound protein' : n + ' bound proteins'; }));
    cells.push(listCell(s.motifs, 'motifs', trunc, function (n) { return n === 1 ? '1 altered motif' : n + ' altered motifs'; }));
    cells.push(hitsCell(v.gwas, function (g) { return [g.pmid || '', g.trait, HR.fmtP(g.p)].join(','); }));
    cells.push(hitsCell(v.grasp, function (g) { return [g.pmid || '', g.trait, HR.fmtP(g.p)].join(','); }));
    cells.push(hitsCell(v.eqtl, function (q) { return [q.source, q.tissue, q.gene, HR.fmtP(q.p)].join(','); }));
    var g = v.genes || {};
    if (opts.genetypes !== 'refseq') cells.push(td(HR.geneLabel(g.gencode)));
    if (opts.genetypes !== 'gencode') cells.push(td(HR.geneLabel(g.refseq)));
    var fc = HR.funcClass(s.func);
    cells.push(fc ? '<td class="' + fc + '">' + esc(s.func) + '</td>' : td(s.func));

    return '<tr class="normal" onmouseover="this.className=\'highlight\'" onmouseout="this.className=\'normal\'">' +
      cells.join('') + '</tr>';
  }

  function regCell(s, kind, trunc) {
    var items = s[kind];
    if (!items.length) return '<td></td>';
    if (s.mode === 'regbuild') {
      var labels = U.uniq(items).map(function (t) { return t.replace(/_/g, ' ').replace('open chromatin region', 'open chromatin'); });
      return tdc(kind, labels.join(', '), 'Ensembl Regulatory Build');
    }
    var tissues = HR.tissuesOf(items);
    var n = tissues.length;
    var text = n > trunc ? (n === 1 ? '1 organ' : n + ' tissues') : tissues.join(', ');
    return tdc(kind, text, HR.describeEpis(items));
  }

  function listCell(items, cls, trunc, countLabel) {
    if (!items || !items.length) return '<td></td>';
    var text = items.length > trunc ? countLabel(items.length) : items.join(',');
    return tdc(cls, text, items.join(','));
  }

  function hitsCell(list, fmt) {
    if (!list || !list.length) return '<td></td>';
    return tdc('eqtls', list.length === 1 ? '1 hit' : list.length + ' hits', list.map(fmt).join(';'));
  }
})();
