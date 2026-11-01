/* HaploReg v5 — live data source backed by the Ensembl REST API (GRCh38).
 *
 * Real data: positions, alleles, 1000 Genomes Phase 3 superpopulation frequencies, LD (r², D'),
 * NHGRI-EBI GWAS associations, VEP consequences + GERP conservation, Ensembl Regulatory Build
 * overlaps and JASPAR motif hits, and the closest GENCODE gene.
 * Not available from Ensembl: per-epigenome ChromHMM states, histone peaks, DNase per tissue,
 * eQTLs. Those columns stay empty until the HaploReg v5 pipeline API is connected. */
(function (HR) {
  'use strict';

  var U = HR.util;
  var BASE = 'https://rest.ensembl.org';
  var MAX_REGION = 50000;
  var MAX_REGION_VARIANTS = 400;
  var cache = {};

  async function request(path, body, attempt) {
    attempt = attempt || 0;
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 45000);
    var res;
    try {
      res = await fetch(BASE + path, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal
      });
    } catch (err) {
      clearTimeout(timer);
      // Retry network errors twice, timeouts once (a timed-out call has already waited 45 s).
      if (attempt < (err.name === 'AbortError' ? 1 : 2)) { await U.sleep(800 * (attempt + 1)); return request(path, body, attempt + 1); }
      throw new Error('Could not reach Ensembl REST (' + (err.name === 'AbortError' ? 'timed out' : 'network error') + ')');
    }
    clearTimeout(timer);
    if (res.status === 429 || res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504) {
      if (attempt < 3) {
        var wait = parseFloat(res.headers.get('Retry-After')) || (1 + attempt);
        await U.sleep(wait * 1000);
        return request(path, body, attempt + 1);
      }
    }
    if (res.status === 400 || res.status === 404) return null;
    if (!res.ok) throw new Error('Ensembl REST returned HTTP ' + res.status);
    return res.json();
  }

  function cached(key, fn) {
    if (!cache[key]) cache[key] = fn().catch(function (e) { delete cache[key]; throw e; });
    return cache[key];
  }

  /* --------------------------------------------------------------- LD */

  function ld(id, pop, r2) {
    var path = '/ld/human/' + encodeURIComponent(id) + '/1000GENOMES:phase_3:' + pop +
      '?window_size=500&r2=' + r2;
    return cached('ld:' + path, async function () {
      var rows = (await request(path)) || [];
      // Ensembl resolves merged rsIDs, so the query side of each pair may carry its current name
      // rather than the ID we asked for. The query is the name shared by every row.
      var lc = function (x) { return String(x || '').toLowerCase(); };
      var self = id;
      if (rows.length && rows.every(function (r) { return lc(r.variation1) === lc(rows[0].variation1); })) self = lc(rows[0].variation1);
      else if (rows.length && rows.every(function (r) { return lc(r.variation2) === lc(rows[0].variation2); })) self = lc(rows[0].variation2);
      return rows.map(function (r) {
        var v1 = lc(r.variation1), v2 = lc(r.variation2);
        var other = v1 === id || v1 === self ? v2 : v1;
        return { id: other, r2: round(+r.r2), dprime: round(+r.d_prime) };
      }).filter(function (p) { return p.id && p.id !== id && p.id !== self; });
    });
  }

  function round(x) { return Math.round(x * 100) / 100; }

  /* --------------------------------------------------------------- variants */

  async function variants(ids, opts, progress, warn) {
    var out = {};
    var todo = ids.filter(function (id) {
      if (cache['v:' + id]) { out[id] = cache['v:' + id]; return false; }
      return true;
    });
    if (!todo.length) return out;

    // Small batches: responses with populations + phenotypes are large and the API times out on big ones.
    var chunks = U.chunk(todo, 40), done = 0, failed = [];
    var varRes = await U.mapLimit(chunks, 3, function (c) {
      return request('/variation/homo_sapiens?pops=1&phenotypes=1', { ids: c }).then(function (r) {
        if (progress && chunks.length > 1) progress('Fetched annotations (' + (++done) + '/' + chunks.length + ' batches)');
        return r;
      }, function (err) {
        failed = failed.concat(c);
        if (failed.length === todo.length) throw err;
        return null;
      });
    });
    if (failed.length && warn) {
      warn('Ensembl did not respond for ' + failed.length + ' variant' + (failed.length === 1 ? '' : 's') + ' (' +
        failed.slice(0, 5).join(', ') + (failed.length > 5 ? ', …' : '') + '); they are missing from the results. Try again in a moment.', failed);
    }
    var base = {};
    varRes.forEach(function (res) {
      Object.keys(res || {}).forEach(function (k) {
        var v = fromVariation(k, res[k]);
        if (!v) return;
        base[v.id] = v;
        if (k.toLowerCase() !== v.id) base[k.toLowerCase()] = v;
      });
    });
    // A merged rsID comes back keyed by its current name; map the ID we asked for via the synonyms.
    var bySynonym = {};
    U.uniq(Object.keys(base).map(function (k) { return base[k]; })).forEach(function (v) {
      v.synonyms.forEach(function (s) { bySynonym[s] = v; });
    });
    todo.forEach(function (id) { if (!base[id] && bySynonym[id]) base[id] = bySynonym[id]; });

    var found = Object.keys(base);
    var unique = U.uniq(found.map(function (k) { return base[k]; }));
    var partial = new Set();
    if (progress) progress('Running VEP and locating genes for ' + unique.length + ' variant' + (unique.length === 1 ? '' : 's'));
    var vep = U.mapLimit(U.chunk(unique, 100), 3, function (c) {
      return request('/vep/homo_sapiens/id?Conservation=1', { ids: c.map(function (v) { return v.id; }) }).then(function (res) {
        if (!res) c.forEach(function (v) { partial.add(v); });
        return res;
      }, function () {
        c.forEach(function (v) { partial.add(v); });
        return null;
      });
    }).then(function (vepRes) {
      vepRes.forEach(function (res) {
        (res || []).forEach(function (x) {
          var v = base[String(x.id).toLowerCase()];
          if (v) applyVep(v, x);
        });
      });
    });
    var genes = assignGenes(unique).then(function (missed) { missed.forEach(function (v) { partial.add(v); }); });
    await Promise.all([vep, genes]);

    if (partial.size && warn) {
      warn('Some annotations (consequence, GERP, regulatory features or nearest gene) could not be fetched from Ensembl for ' +
        partial.size + ' variant' + (partial.size === 1 ? '' : 's') + '; those cells may be blank. Search again to retry.');
    }
    found.forEach(function (k) {
      // Incomplete records are shown but not cached, so the next query fetches them again.
      if (!partial.has(base[k])) cache['v:' + k] = base[k];
      out[k] = base[k];
    });
    return out;
  }

  function fromVariation(key, r) {
    if (!r || !r.mappings) return null;
    var m = r.mappings.filter(function (x) {
      return x.assembly_name === 'GRCh38' && /^([0-9]{1,2}|X|Y)$/.test(x.seq_region_name);
    })[0];
    if (!m) return null;
    var alleles = String(m.allele_string || '').split('/');
    var ref = alleles[0] || '';
    var kgRows = (r.populations || []).filter(function (x) { return /^1000GENOMES:phase_3:/.test(x.population); });
    // dbSNP lists every allele ever submitted; keep the ones actually seen in 1000 Genomes.
    var seenAlts = alleles.slice(1).filter(function (a) {
      return kgRows.some(function (x) { return x.allele === a && x.frequency > 0; });
    });
    var alts = seenAlts.length ? seenAlts : alleles.slice(1);
    var af = {};
    HR.POPS.forEach(function (p) {
      var rows = kgRows.filter(function (x) { return x.population === '1000GENOMES:phase_3:' + p; });
      if (!rows.length) { af[p] = null; return; }
      var refRow = rows.filter(function (x) { return x.allele === ref; })[0];
      af[p] = refRow ? 1 - refRow.frequency
        : rows.filter(function (x) { return alts.indexOf(x.allele) >= 0; }).reduce(function (s, x) { return s + x.frequency; }, 0);
    });
    var gwas = [];
    var seen = {};
    (r.phenotypes || []).forEach(function (p) {
      if (p.source !== 'NHGRI-EBI GWAS catalog') return;
      var pmid = p.study && /PMID:(\d+)/.test(p.study) ? p.study.match(/PMID:(\d+)/)[1] : null;
      var key = [p.trait, pmid, p.pvalue].join('|');
      if (seen[key]) return;
      seen[key] = 1;
      gwas.push({ trait: p.trait, p: p.pvalue ? Number(p.pvalue) : null, pmid: pmid, riskAllele: p.risk_allele || null, source: 'NHGRI-EBI' });
    });
    gwas.sort(function (a, b) { return (a.p == null) - (b.p == null) || a.p - b.p; });
    return {
      id: String(r.name || key).toLowerCase(),
      chr: m.seq_region_name,
      pos: m.start,
      end: m.end,
      ref: ref,
      alt: alts.join(','),
      ancestral: m.ancestral_allele || null,
      maf: r.MAF,
      minorAllele: r.minor_allele,
      varClass: r.var_class,
      synonyms: (r.synonyms || []).map(function (s) { return String(s).toLowerCase(); }),
      af: af,
      consequence: r.most_severe_consequence || '',
      func: HR.funcFromSO(r.most_severe_consequence),
      gwas: gwas,
      eqtl: null, grasp: null,
      states: null, states25: null, marks: null, missing: null, dnase: null,
      proteins: [], motifs: [], regfeatures: [],
      gerp: null, gerpCons: null, siphyCons: null,
      genes: { gencode: null, refseq: null }
    };
  }

  function applyVep(v, x) {
    var consScores = [];
    (x.transcript_consequences || []).concat(x.regulatory_feature_consequences || [], x.intergenic_consequences || [])
      .forEach(function (c) { if (typeof c.conservation === 'number') consScores.push(c.conservation); });
    if (consScores.length) {
      v.gerp = Math.max.apply(null, consScores);
      v.gerpCons = v.gerp >= 2;
    }
    var regs = {};
    (x.regulatory_feature_consequences || []).forEach(function (f) {
      regs[f.regulatory_feature_id] = { id: f.regulatory_feature_id, type: f.biotype };
    });
    v.regfeatures = Object.keys(regs).map(function (k) { return regs[k]; });
    v.regfeatures.forEach(function (f) {
      if (f.type === 'CTCF_binding_site') v.proteins.push({ factor: 'CTCF', cell: 'Ensembl Regulatory Build' });
    });
    var motifs = {};
    (x.motif_feature_consequences || []).forEach(function (m) {
      var tfs = (m.transcription_factors || []).join(',') || m.motif_name;
      var key = m.motif_feature_id || tfs;
      if (motifs[key]) return;
      motifs[key] = {
        name: tfs, id: m.motif_name, featureId: m.motif_feature_id, strand: m.strand === -1 ? '-' : '+',
        ref: null, alt: null, delta: typeof m.motif_score_change === 'number' ? m.motif_score_change : null,
        pos: m.motif_pos, highInf: m.high_inf_pos === 'Y'
      };
    });
    v.motifs = Object.keys(motifs).map(function (k) { return motifs[k]; });
  }

  /* --------------------------------------------------------------- genes */

  // Resolves to the variants whose gene lookup failed.
  async function assignGenes(list) {
    var byChr = {};
    list.forEach(function (v) { (byChr[v.chr] = byChr[v.chr] || []).push(v); });
    var clusters = [];
    Object.keys(byChr).forEach(function (chr) {
      var vs = byChr[chr].sort(function (a, b) { return a.pos - b.pos; });
      var cur = null;
      vs.forEach(function (v) {
        // Ensembl caps overlap queries at 5 Mb; with ±500 kb padding a cluster may span at most 4 Mb.
        if (cur && v.pos - cur.end < 1000000 && v.pos - cur.start < 3900000) { cur.end = v.pos; cur.items.push(v); }
        else { cur = { chr: chr, start: v.pos, end: v.pos, items: [v] }; clusters.push(cur); }
      });
    });
    var missed = [];
    await U.mapLimit(clusters, 2, async function (c) {
      var s = Math.max(1, c.start - 500000), e = c.end + 500000;
      var genes = await cached('genes:' + c.chr + ':' + s + '-' + e, function () {
        return request('/overlap/region/human/' + c.chr + ':' + s + '-' + e + '?feature=gene').then(function (r) {
          if (!r) throw new Error('gene lookup failed');
          return r;
        });
      }).catch(function () { return null; });
      if (!genes) { missed = missed.concat(c.items); return; }
      c.items.forEach(function (v) { v.genes.gencode = nearestGene(v.pos, genes); });
    });
    return missed;
  }

  function nearestGene(pos, genes) {
    var best = null;
    genes.forEach(function (g) {
      if (!g.external_name) return;
      var pc = g.biotype === 'protein_coding' ? 0 : 1;
      var d, dir;
      if (pos >= g.start && pos <= g.end) { d = 0; dir = 'within'; }
      else if (pos < g.start) { d = g.start - pos; dir = g.strand === 1 ? "5'" : "3'"; }
      else { d = pos - g.end; dir = g.strand === 1 ? "3'" : "5'"; }
      // Prefer genes containing the variant, then protein-coding genes, then the closest.
      var score = d + pc * (d === 0 ? 0.5 : 20000);
      if (!best || score < best.score) {
        best = { score: score, id: g.gene_id || g.id, symbol: g.external_name, direction: dir, distance: d, biotype: g.biotype, desc: g.description || '' };
      }
    });
    if (best) delete best.score;
    return best;
  }

  /* --------------------------------------------------------------- region */

  async function region(chr, start, end) {
    var warning = null;
    if (end - start > MAX_REGION) {
      warning = 'Region queries are limited to ' + (MAX_REGION / 1000) + ' kb with the live Ensembl source; showing chr' +
        chr + ':' + start + '-' + (start + MAX_REGION) + '.';
      end = start + MAX_REGION;
    }
    var rows = await request('/overlap/region/human/' + chr + ':' + start + '-' + end + '?feature=variation&variant_set=1kg_3');
    var ids = U.uniq((rows || []).filter(function (r) { return /^rs\d+$/.test(r.id); }).map(function (r) { return r.id.toLowerCase(); }));
    if (ids.length > MAX_REGION_VARIANTS) {
      warning = (warning ? warning + ' ' : '') + 'Region contains ' + ids.length + ' 1000 Genomes variants; showing the first ' + MAX_REGION_VARIANTS + '.';
      ids = ids.slice(0, MAX_REGION_VARIANTS);
    }
    return { ids: ids, warning: warning };
  }

  /* --------------------------------------------------------------- detail */

  async function detail(id, opts, progress) {
    var res = await variants([id], opts, progress);
    var v = res[id];
    if (!v) return null;
    var flank = 30;
    if (progress) progress('Fetching sequence context and motif features');
    var extra = await Promise.all([
      request('/sequence/region/human/' + v.chr + ':' + (v.pos - flank) + '..' + (v.end + flank) + ':1').catch(function () { return null; }),
      request('/overlap/region/human/' + v.chr + ':' + v.pos + '-' + v.end + '?feature=motif').catch(function () { return null; })
    ]);
    var seq = extra[0], motifHits = extra[1];
    var d = Object.assign({}, v);
    if (seq && seq.seq) {
      var s = seq.seq.toUpperCase();
      var refLen = v.end - v.pos + 1;
      d.context = { left: s.slice(0, flank), ref: s.slice(flank, flank + refLen), right: s.slice(flank + refLen), alt: v.alt.split(',')[0] };
    }
    d.motifHits = (motifHits || []).map(function (m) {
      return { tf: m.transcription_factor_complex, matrix: m.binding_matrix_stable_id, start: m.start, end: m.end, strand: m.strand === -1 ? '-' : '+', score: m.score };
    });
    return d;
  }

  HR.registerSource({
    id: 'ensembl',
    label: 'Live — Ensembl REST (1000 Genomes Phase 3, GRCh38)',
    shortLabel: 'Ensembl live',
    ldPanel: '1000G Phase 3',
    hasChromatin: false,
    hasEqtl: false,
    hasRefseq: false,
    hasSiphy: false,
    note: 'Live data from the Ensembl REST API. Chromatin-state, histone, DNase and eQTL columns need the HaploReg v5 pipeline backend; regulatory columns here show Ensembl Regulatory Build overlaps.',
    ld: ld,
    variants: variants,
    region: region,
    detail: detail
  });
})(window.HR = window.HR || {});
