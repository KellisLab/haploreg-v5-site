/* HaploReg v5 Classic — variant detail view (the equivalent of v4's detail_v4.2.php). */
(function () {
  'use strict';

  var U = HR.util, esc = U.escape;
  var params = U.params();
  var opts = HR.normalizeOptions(params);
  var id = String(params.id || '').trim().toLowerCase();
  var el = document.getElementById('detail');
  var src = HR.getSource(opts.source);

  function help(gid) {
    var g = HR.GLOSSARY_BY_ID[gid];
    return ' <a class="help docpopup" href="documentation.html#' + gid + '" title="' + esc(g ? g.term + ': ' + g.short : '') + '">?</a>';
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.docpopup');
    if (!a) return;
    var w = window.open(a.href, 'hrdoc', 'width=820,height=820,scrollbars=yes,resizable=yes');
    if (w) { e.preventDefault(); w.focus(); }
  });

  if (!/^rs\d+$/.test(id)) {
    el.innerHTML = '<h1>Detail view</h1><hr><p class="error">Please supply a variant, e.g. detail.html?id=rs7903146</p>';
    return;
  }
  document.title = 'HaploReg v5 variant detail view: ' + id;

  el.innerHTML = '<h1>Detail view for ' + esc(id) + '</h1><hr><p class="status">Loading from ' + esc(src.label) + '...</p>';
  HR.getDetail(id, opts, function (msg) {
    var s = el.querySelector('.status');
    if (s) s.textContent = msg + '...';
  }).then(render, function (err) {
    el.innerHTML = '<h1>Detail view for ' + esc(id) + '</h1><hr><p class="error">Error: ' + esc(err.message) + '</p>';
  });

  function table(rows) {
    return '<p><table class="detailtable">' + rows.join('') + '</table></p>';
  }
  function tr(cells) { return '<tr>' + cells.join('') + '</tr>'; }
  function th(x, attrs) { return '<td' + (attrs || '') + '><b>' + x + '</b></td>'; }
  function td(x, attrs) { return '<td' + (attrs || '') + '>' + (x == null ? '' : x) + '</td>'; }

  function render(v) {
    var h = '<h1>Detail view for ' + esc(id) + '</h1><hr>';
    if (!v) {
      el.innerHTML = h + '<p>' + esc(id) + ' was not found in dbSNP / ' + esc(src.ldPanel) + ' (data source: ' + esc(src.label) + ').</p>';
      return;
    }
    if (src.synthetic) h += '<p class="demo-warning"><b>Demo data.</b> ' + esc(src.note) + '</p>';
    if (!v.demo) {
      h += '<h2><p><b><a href="' + HR.links.dbsnp(v.id) + '" target="_blank">Link to dbSNP entry</a></b></p></h2>';
      h += '<h2><p><b><a href="' + HR.links.ensembl(v.id) + '" target="_blank">Link to Ensembl Variation entry</a></b></p></h2>';
    }
    if (v.id !== id) h += '<p>' + esc(id) + ' has been merged into ' + esc(v.id) + '.</p>';

    h += sequenceFacts(v) + closestGene(v) + chromatin(v) + proteins(v) + eqtls(v) + gwas(v) + grasp(v) + motifs(v);
    h += '<p><a href="index.html">HaploReg v5</a> | <a href="documentation.html" class="docpopup">Documentation</a></p>';
    el.innerHTML = h;
  }

  function sequenceFacts(v) {
    var cons = function (flag, score) {
      if (flag == null) return 'NA';
      return (flag ? 'Yes' : 'No') + (score != null ? ' (RS ' + esc(score) + ')' : '');
    };
    return '<p><b>Sequence facts</b>' + help('pos') + '</p>' + table([
      tr([th('chr', ' rowspan="2"'), th('pos (hg38)', ' rowspan="2"'), th('Reference' + help('ref-alt'), ' rowspan="2"'),
        th('Alternate', ' rowspan="2"'), th(esc(src.ldPanel === 'synthetic' ? 'Simulated' : src.ldPanel) + ' Frequencies' + help('af'), ' colspan="5"'),
        th('Sequence constraint', ' colspan="2"'), th('dbSNP functional annotation' + help('func'), ' rowspan="2"')]),
      tr(HR.POPS.map(function (p) { return th('<span title="' + esc(HR.POP_NAMES[p]) + '">' + p + '</span>'); })
        .concat([th('by GERP' + help('gerp')), th('by SiPhy' + help('siphy'))])),
      tr([td('chr' + esc(v.chr)), td(esc(v.pos)), td(esc(v.ref)), td(esc(v.alt))]
        .concat(HR.POPS.map(function (p) { return td(esc(HR.fmtFreq(v.af[p]))); }))
        .concat([td(cons(v.gerpCons, v.gerp)), td(cons(v.siphyCons)), td(esc(v.func || v.consequence || ''))]))
    ]) + (v.ancestral ? '<p>Ancestral allele' + help('ancestral') + ': ' + esc(v.ancestral) + '</p>' : '');
  }

  function closestGene(v) {
    var g = v.genes || {};
    var rows = [tr([th('Closest annotated gene' + help('gencode'), ' colspan="6"')]),
      tr([th('Source'), th('Distance'), th('Direction' + help('direction')), th('ID/Link'), th('Common name'), th('Description')])];
    var add = function (label, x, link) {
      if (!x) return;
      var within = x.direction === 'within';
      rows.push(tr([td(label), td(within ? 'NA' : esc(x.distance)), td(within ? 'Within gene' : esc(x.direction) + ' of gene'),
        td(link && !v.demo ? '<a href="' + link + '" target="_blank">' + esc(x.id) + '</a>' : esc(x.id)),
        td(esc(x.symbol)), td(esc(x.desc || ''))]));
    };
    add('GENCODE', g.gencode, g.gencode && HR.links.gene(g.gencode.id));
    add('RefSeq', g.refseq, g.refseq && 'https://www.ncbi.nlm.nih.gov/gene?term=' + encodeURIComponent(g.refseq.id));
    return rows.length > 2 ? table(rows) : '';
  }

  function chromatin(v) {
    if (v.states || v.marks) {
      var head = tr([th('Epigenome ID (EID)' + help('epigenome')), th('Group'), th('Mnemonic' + help('tissue-code')), th('Description'),
        th('Chromatin states<br>(Core 15-state model)' + help('core15')),
        th('Chromatin states<br>(25-state model<br>using 12 imputed marks)' + help('imputed25'))]
        .concat(HR.MARKS.map(function (m) { return th(m + help('histone-marks')); }))
        .concat([th('DNase' + help('dnase'))]));
      var p15 = HR.STATE_CLASSES.vanilla, p25 = HR.STATE_CLASSES.imputed;
      var stateCell = function (n, cls, model) {
        if (!n || (cls.promoter.indexOf(n) < 0 && cls.enhancer.indexOf(n) < 0)) return td('');
        var s = HR.stateOf(n, model);
        return td('<span title="' + esc(s.name) + '">' + esc(s.code) + '</span>', ' bgcolor="' + s.color + '"');
      };
      var rows = HR.EPIGENOMES.map(function (e) {
        var miss = (v.missing && v.missing[e.eid]) || [];
        var marks = (v.marks && v.marks[e.eid]) || [];
        var cells = [td(e.eid), td(esc(e.group)), td(esc(e.mnemonic)), td(esc(e.desc)),
          stateCell(v.states && v.states[e.eid], p15, 'vanilla'), stateCell(v.states25 && v.states25[e.eid], p25, 'imputed')];
        HR.MARKS.forEach(function (m) {
          if (miss.indexOf(m) >= 0) cells.push(td('', ' bgcolor="black"'));
          else if (marks.indexOf(m) >= 0) {
            var kind = HR.MARK_KIND[m];
            cells.push(td(m + (kind === 'Enh' ? '_Enh' : '_Pro'), ' bgcolor="' + (kind === 'Enh' ? 'orange' : 'red') + '"'));
          } else cells.push(td(''));
        });
        if (miss.indexOf('DNase') >= 0) cells.push(td('', ' bgcolor="black"'));
        else if ((v.dnase || []).indexOf(e.eid) >= 0) cells.push(td('DNase', ' bgcolor="LightGray"'));
        else cells.push(td(''));
        return tr(cells);
      });
      return '<p>Regulatory chromatin states from DNAse and histone ChIP-Seq (Roadmap Epigenomics Consortium, 2015)' + help('chromhmm') + '</p>' +
        '<h4>(Black = missing data)' + help('missing-data') + '</h4>' + table([head].concat(rows));
    }
    var feats = v.regfeatures || [];
    var out = '<p><b>Ensembl Regulatory Build features overlapping this variant</b>' + help('regbuild') + '</p>' +
      '<p class="source-note">Per-epigenome ChromHMM states, histone peaks and DNase will appear here once the HaploReg v5 pipeline backend is connected.</p>';
    if (!feats.length) return out + '<p>None.</p>';
    return out + table([tr([th('Feature ID'), th('Type')])].concat(feats.map(function (f) {
      return tr([td('<a href="https://www.ensembl.org/Homo_sapiens/Regulation/Summary?rf=' + encodeURIComponent(f.id) + '" target="_blank">' + esc(f.id) + '</a>'),
        td(esc(f.type.replace(/_/g, ' ')))]);
    })));
  }

  function proteins(v) {
    if (!v.proteins || !v.proteins.length) return '';
    return '<p><b>Proteins bound</b>' + help('proteins') + '</p>' + table([tr([th('Factor'), th('Cell type / source')])]
      .concat(v.proteins.map(function (p) { return tr([td(esc(p.factor)), td(esc(p.cell || ''))]); })));
  }

  function eqtls(v) {
    if (!v.eqtl || !v.eqtl.length) return '';
    return '<p><b>eQTL hits</b>' + help('eqtl') + '</p>' + table([tr([th('Source'), th('Tissue'), th('Gene'), th('p-value' + help('pvalue'))])]
      .concat(v.eqtl.map(function (q) { return tr([td(esc(q.source)), td(esc(q.tissue)), td(esc(q.gene)), td(esc(HR.fmtP(q.p)))]); })));
  }

  function hitTable(list, withRisk) {
    var head = [th('Trait'), th('p-value' + help('pvalue')), th('PMID')];
    if (withRisk) head.push(th('Risk allele'));
    return table([tr(head)].concat(list.map(function (g) {
      var cells = [td(esc(g.trait)), td(esc(HR.fmtP(g.p))),
        td(g.pmid ? '<a href="' + HR.links.pubmed(g.pmid) + '" target="_blank">' + esc(g.pmid) + '</a>' : '')];
      if (withRisk) cells.push(td(esc(g.riskAllele || '')));
      return tr(cells);
    })));
  }

  function gwas(v) {
    if (!v.gwas || !v.gwas.length) return '';
    var withRisk = v.gwas.some(function (g) { return g.riskAllele; });
    return '<p><b><a href="https://www.ebi.ac.uk/gwas/" target="_blank">NHGRI-EBI GWAS</a> hits</b>' + help('gwas') + '</p>' + hitTable(v.gwas, withRisk);
  }

  function grasp(v) {
    if (!v.grasp || !v.grasp.length) return '';
    return '<p><b>GRASP QTL hits</b>' + help('grasp') + '</p>' + hitTable(v.grasp, false);
  }

  function contextPre(v) {
    var c = v.context;
    if (!c) return '';
    return '<pre>Ref: ' + esc(c.left) + '<b>' + esc(c.ref) + '</b>' + esc(c.right) + '<br>Alt: ' + esc(c.left) + '<b>' + esc(c.alt) + '</b>' + esc(c.right) + '</pre>';
  }

  function motifs(v) {
    var list = v.motifs || [];
    var hits = v.motifHits || [];
    if (!list.length && !hits.length) return '';
    var out = '<p><b>Regulatory motifs altered</b>' + help('motifs-changed') + '</p>';
    if (list.length && list[0].ref != null) {
      var rows = [tr([th('Position Weight Matrix ID' + help('pwm') + '<br>(Library from Kheradpour and Kellis, 2014)'),
        th('Strand' + help('strand')), th('Ref' + help('lod')), th('Alt'),
        // Not th(): only the variant base inside the sequence should be bold, as in v4.
        td('<b>Match on:</b>' + help('iupac') + '<br>' + contextPre(v))])];
      list.forEach(function (m) {
        rows.push(tr([td('<span title="' + esc(m.id) + '">' + esc(m.name) + '</span>'), td(esc(m.strand)), td(esc(m.ref)), td(esc(m.alt)),
          td(m.pattern ? '<pre>' + new Array(6 + Math.max(0, m.offset)).join(' ') + esc(m.pattern) + '</pre>' : '')]));
      });
      out += table(rows);
    } else if (list.length) {
      out += (v.context ? '<p>Sequence context:</p>' + contextPre(v) : '') + table([tr([th('Transcription factor(s)'), th('Matrix'),
        th('Strand' + help('strand')), th('Position in motif'), th('Score change (VEP)' + help('lod')), th('High-information position')])]
        .concat(list.map(function (m) {
          return tr([td(esc(m.name)), td(esc(m.id || '')), td(esc(m.strand)), td(esc(m.pos == null ? '' : m.pos)),
            td(esc(m.delta == null ? '' : Math.round(m.delta * 1000) / 1000)), td(m.highInf ? 'Yes' : 'No')]);
        })));
    }
    var extra = hits.filter(function (hh) { return !list.some(function (m) { return m.id === hh.matrix; }); });
    if (extra.length) {
      out += '<p>Ensembl motif features overlapping the variant:</p>' + table([tr([th('Transcription factor(s)'), th('Matrix'),
        th('Strand'), th('Start'), th('End'), th('Score')])].concat(extra.map(function (m) {
          return tr([td(esc(m.tf)), td(esc(m.matrix)), td(esc(m.strand)), td(esc(m.start)), td(esc(m.end)), td(esc(Math.round(m.score * 100) / 100))]);
        })));
    }
    return out;
  }
})();
