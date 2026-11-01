/* HaploReg v5 — offline demo source.
 *
 * Generates deterministic SYNTHETIC annotations so the interfaces can be developed and shown
 * without a network connection, including the per-epigenome chromatin-state, histone-peak,
 * DNase and eQTL views that the v5 pipeline will provide. Nothing here is real data: positions,
 * LD partners (14-digit rs9… IDs, far outside the dbSNP range), genes (DMG*), traits and scores are
 * all simulated. Both UIs show a banner whenever this source is active. */
(function (HR) {
  'use strict';

  var U = HR.util;
  var BASES = 'ACGT';
  var TISSUES = U.uniq(HR.EPIGENOMES.map(function (e) { return e.tissue; }));

  var MOTIFS = ['AP-1_known2', 'AP-2_2', 'Arid3a_1', 'BCL_disc1', 'CEBPB_known2', 'CTCF_known1', 'Cdx_2',
    'E2A_1', 'EBF_known1', 'Ets_known3', 'Foxa_known2', 'Foxp1_2', 'GATA_known5', 'Gfi1_1', 'HNF1_known3',
    'HNF4_known4', 'Hoxa9_2', 'Irf_known5', 'Mef2_known3', 'Myc_known7', 'NF-kappaB_known1', 'NRSF_disc4',
    'Nkx2_5', 'Nr2f2', 'Pax-4_1', 'Pou2f2_known1', 'Pou5f1_known2', 'RXRA_known3', 'Rfx3', 'SP1_known3',
    'STAT_known6', 'Sox_3', 'TATA_known1', 'TCF4_known1', 'YY1_known3', 'Zfp105', 'p300_disc2', 'p53_known2',
    'ZNF263_known1', 'Hic1_1', 'Klf4', 'Maf_known3', 'NFE2_disc1', 'PLZF', 'Pbx3_disc1', 'RREB-1_2',
    'SIX5_known1', 'TEF_1', 'ERalpha-a_disc1', 'E4BP4'];
  var FACTORS = ['CTCF', 'POL2', 'RAD21', 'SMC3', 'EP300', 'FOXA1', 'FOXA2', 'HNF4A', 'CEBPB', 'GATA2', 'YY1',
    'MAX', 'JUND', 'ZNF263', 'TCF7L2', 'SPI1', 'EBF1', 'FOS', 'NFKB', 'STAT3'];
  var CELLS = ['GM12878', 'HepG2', 'K562', 'HeLa-S3', 'A549', 'H1-hESC', 'MCF-7', 'SK-N-SH', 'IMR-90', 'HUVEC'];
  var TRAITS = ['Type 2 diabetes', 'Body mass index', 'LDL cholesterol', 'Height', "Crohn's disease",
    'Ulcerative colitis', 'Rheumatoid arthritis', 'Systemic lupus erythematosus', 'Coronary artery disease',
    'Schizophrenia', 'Systolic blood pressure', 'Multiple sclerosis', 'Asthma', 'Breast cancer',
    'Prostate cancer', 'Fasting glucose', 'HDL cholesterol', 'Triglycerides', "Alzheimer's disease",
    'Eosinophil counts', 'Platelet count'];
  var GTEX = ['Whole Blood', 'Liver', 'Adipose - Subcutaneous', 'Muscle - Skeletal', 'Pancreas', 'Lung',
    'Thyroid', 'Brain - Cortex', 'Colon - Transverse', 'Skin - Sun Exposed (Lower leg)', 'Artery - Tibial',
    'Heart - Left Ventricle', 'Nerve - Tibial', 'Stomach'];

  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function pickN(r, arr, n) {
    var pool = arr.slice(), out = [];
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    return out;
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function r2d(x) { return Math.round(x * 100) / 100; }
  function r1d(x) { return Math.round(x * 10) / 10; }

  // Simulated partner and region variants carry their position in the ID: rs9 + 2-digit chromosome
  // (23 = X, 24 = Y) + 9-digit position. Any page can rebuild them from the ID alone, without storage.
  var ENC_RE = /^rs9(\d{2})(\d{9})$/;
  function encodeId(chr, pos) {
    var code = chr === 'X' ? 23 : chr === 'Y' ? 24 : +chr;
    return 'rs9' + String(code).padStart(2, '0') + String(pos).padStart(9, '0');
  }
  function decodeId(id) {
    var m = String(id).match(ENC_RE);
    if (!m || +m[1] < 1 || +m[1] > 24 || +m[2] < 1) return null;
    return { chr: +m[1] === 23 ? 'X' : +m[1] === 24 ? 'Y' : String(+m[1]), pos: +m[2] };
  }
  // Base allele frequency is shared by every variant in the same 100 kb, so LD partners look alike.
  function localAf(chr, pos) { return r2d(0.05 + U.rng('locaf:' + chr + ':' + Math.floor(pos / 100000))() * 0.45); }

  function alleles(r) {
    var ref = BASES[Math.floor(r() * 4)];
    var alt = BASES[(BASES.indexOf(ref) + 1 + Math.floor(r() * 3)) % 4];
    var x = r();
    if (x < 0.05) alt = ref + BASES[Math.floor(r() * 4)] + BASES[Math.floor(r() * 4)];
    else if (x < 0.08) ref = ref + 'TTTAGCATT'.slice(0, 3 + Math.floor(r() * 6));
    return { ref: ref, alt: alt };
  }

  // GRCh38 autosome lengths, so simulated positions stay on the chromosome.
  var CHR_LEN = [248956422, 242193529, 198295559, 190214555, 181538259, 170805979, 159345973, 145138636,
    138394717, 133797422, 135086622, 133275309, 114364328, 107043718, 101991189, 90338345, 83257441,
    80373285, 58617616, 64444167, 46709983, 50818468];

  function place(id) {
    var r = U.rng('pos:' + id);
    var a = alleles(r);
    var loc = decodeId(id);
    if (!loc) {
      var c = Math.floor(r() * 22);
      loc = { chr: String(c + 1), pos: 1000000 + Math.floor(r() * (CHR_LEN[c] - 2000000)) };
    }
    return { chr: loc.chr, pos: loc.pos, ref: a.ref, alt: a.alt, af: localAf(loc.chr, loc.pos) };
  }

  /* --------------------------------------------------------------- LD */

  function ld(id, pop, thresh) {
    var q = place(id);
    var r = U.rng('ld:' + id);
    var n = 3 + Math.floor(r() * 14);
    var out = [], used = {};
    used[q.pos] = 1;
    for (var k = 0; k < n; k++) {
      var kr = U.rng('ldp:' + id + ':' + k);
      var r2 = 1 - Math.pow(kr(), 0.7) * 0.85;
      var dprime = Math.min(1, r2 + kr() * 0.3);
      var popAdj = pop === 'AFR' ? 0.82 : pop === 'EAS' ? 0.95 : 1;
      var popR2 = clamp(r2 * popAdj * (0.9 + U.rng('ldpop:' + id + ':' + k + ':' + pop)() * 0.15), 0.05, 1);
      var pos = Math.max(1, q.pos + Math.round((kr() - 0.5) * 2 * 60000 * (1.2 - r2)));
      while (used[pos]) pos++;
      used[pos] = 1;
      out.push({ id: encodeId(q.chr, pos), r2: r2d(popR2), dprime: r2d(dprime) });
    }
    return Promise.resolve(out.filter(function (p) { return p.r2 >= thresh; }));
  }

  /* --------------------------------------------------------------- annotation */

  var STATE_WEIGHTS = [0.3, 0.5, 1, 1, 2, 0.3, 2, 1, 3, 0.5, 1, 1, 3, 8, 40];

  function weighted(r, w) {
    var total = w.reduce(function (s, x) { return s + x; }, 0), x = r() * total;
    for (var i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return i + 1; }
    return w.length;
  }

  var CORE_TO_25 = { 1: [1], 2: [2, 3, 4], 3: [7], 4: [6], 5: [8], 6: [9, 10, 11, 12], 7: [13, 14, 15, 16, 17, 18],
    8: [20], 9: [21], 10: [23], 11: [22], 12: [17], 13: [24], 14: [24], 15: [25, 25, 25, 19] };

  function annotate(id, L) {
    var r = U.rng('ann:' + id);
    var bucket = L.chr + ':' + Math.floor(L.pos / 100000);
    var lr = U.rng('locus:' + bucket);
    var active = pickN(lr, TISSUES, 2 + Math.floor(lr() * 4));
    var geneNum = 100 + Math.floor(lr() * 9000);
    var genic = lr() < 0.65;
    var isPromoter = r() < 0.12;
    var isEnh = r() < 0.55;

    var states = {}, states25 = {}, marks = {}, missing = {}, dnase = [];
    HR.EPIGENOMES.forEach(function (e) {
      var er = U.rng('epi:' + id + ':' + e.eid);
      var act = active.indexOf(e.tissue) >= 0;
      var w = STATE_WEIGHTS.slice();
      if (genic) { w[3] += 6; w[4] += 12; w[5] += 2; }
      if (act && isEnh) { w[6] += 45; w[5] += genic ? 15 : 3; }
      if (act && isPromoter) { w[0] += 40; w[1] += 25; }
      if (!act && isEnh) w[6] += 4;
      if (isPromoter && /^(ESC|IPSC|ESDR)$/.test(e.tissue)) { w[9] += 20; w[10] += 10; }
      var s = weighted(er, w);
      states[e.eid] = s;
      states25[e.eid] = pick(er, CORE_TO_25[s]);

      var m = [];
      if (s === 6 || s === 7) {
        if (er() < 0.9) m.push('H3K4me1');
        if (er() < 0.55) m.push('H3K27ac');
      } else if (s === 1 || s === 2) {
        if (er() < 0.9) m.push('H3K4me3');
        if (er() < 0.75) m.push('H3K9ac');
        if (er() < 0.6) m.push('H3K27ac');
        if (er() < 0.5) m.push('H3K4me1');
      } else if (s >= 10 && s <= 12) {
        if (er() < 0.5) m.push('H3K4me1');
        if (s === 10 && er() < 0.6) m.push('H3K4me3');
      } else if (er() < 0.03) m.push('H3K4me1');

      // Roadmap did not profile every mark in every epigenome; keep that pattern stable per epigenome.
      var miss = [];
      if (U.rng('miss27:' + e.eid)() < 0.38) miss.push('H3K27ac');
      if (U.rng('miss9:' + e.eid)() < 0.55) miss.push('H3K9ac');
      if (U.rng('missDN:' + e.eid)() < 0.55) miss.push('DNase');
      m = m.filter(function (x) { return miss.indexOf(x) < 0; });
      if (m.length) marks[e.eid] = m;
      if (miss.length) missing[e.eid] = miss;
      if (miss.indexOf('DNase') < 0 &&
          ((s <= 2 && er() < 0.8) || ((s === 6 || s === 7) && er() < 0.45) || er() < 0.02)) dnase.push(e.eid);
    });

    var proteins = [];
    if ((isPromoter || isEnh) && r() < 0.35) {
      pickN(r, FACTORS, 1 + Math.floor(r() * 3)).forEach(function (f) {
        pickN(r, CELLS, 1 + Math.floor(r() * 2)).forEach(function (c) { proteins.push({ factor: f, cell: c }); });
      });
    }

    var motifs = [];
    if (r() < 0.6) {
      pickN(r, MOTIFS, 1 + Math.floor(r() * 8)).forEach(function (name) {
        var ref = -3 + r() * 17;
        var delta = (1.5 + r() * 8.5) * (r() < 0.5 ? -1 : 1);
        var len = 8 + Math.floor(r() * 12);
        motifs.push({
          name: name.replace(/_(known|disc)?\d+$/, ''), id: name, strand: r() < 0.5 ? '+' : '-',
          ref: r1d(ref), alt: r1d(ref + delta), delta: r1d(delta),
          pattern: iupac(r, len), offset: 30 - Math.floor(r() * len)
        });
      });
    }

    var gwas = [];
    if (r() < 0.14) {
      pickN(r, TRAITS, 1 + Math.floor(r() * 3)).forEach(function (t) {
        gwas.push({ trait: t, p: Math.pow(10, -(6 + r() * 34)) * (1 + Math.floor(r() * 9)), pmid: null, source: 'Demo' });
      });
      gwas.sort(function (a, b) { return a.p - b.p; });
    }
    var eqtl = [];
    if (r() < 0.22) {
      pickN(r, GTEX, 1 + Math.floor(r() * 3)).forEach(function (t) {
        eqtl.push({ source: 'GTEx (demo)', tissue: t, gene: 'DMG' + (geneNum + (r() < 0.7 ? 0 : 1)), p: Math.pow(10, -(4 + r() * 20)) });
      });
    }
    var grasp = [];
    if (r() < 0.08) grasp.push({ trait: pick(r, TRAITS), p: Math.pow(10, -(4 + r() * 6)), pmid: null });

    var within = genic && r() < 0.85;
    var gencode = {
      id: 'ENSGDEMO' + String(geneNum).padStart(6, '0'), symbol: 'DMG' + geneNum, biotype: 'protein_coding',
      direction: within ? 'within' : (r() < 0.5 ? "5'" : "3'"), distance: within ? 0 : Math.round(500 + r() * 60000),
      desc: 'Demo gene (synthetic)'
    };
    var refseq = Object.assign({}, gencode, { id: 'NM_DEMO' + geneNum });

    var func = '';
    if (within) {
      var f = r();
      func = f < 0.03 ? 'missense' : f < 0.06 ? 'synonymous' : f < 0.11 ? "3'-UTR" : f < 0.13 ? "5'-UTR" : 'intronic';
    }

    var af = {};
    HR.POPS.forEach(function (p) {
      var pr = U.rng('af:' + bucket + ':' + p);
      af[p] = r2d(clamp(L.af * (0.4 + pr() * 1.2) + (r() - 0.5) * 0.04, 0.005, 0.995));
    });
    var gerp = r1d((r() - 0.62) * 8);

    return {
      id: id, chr: L.chr, pos: L.pos, end: L.pos + L.ref.length - 1, ref: L.ref, alt: L.alt,
      af: af, consequence: func, func: func,
      gerp: gerp, gerpCons: gerp >= 2, siphyCons: r() < 0.07,
      states: states, states25: states25, marks: marks, missing: missing, dnase: dnase,
      proteins: proteins, motifs: motifs, regfeatures: null,
      gwas: gwas, eqtl: eqtl, grasp: grasp,
      genes: { gencode: gencode, refseq: refseq },
      demo: true
    };
  }

  function iupac(r, len) {
    var s = '';
    for (var i = 0; i < len; i++) s += r() < 0.6 ? BASES[Math.floor(r() * 4)] : 'NRYKMSWBDHV'[Math.floor(r() * 11)];
    return s;
  }

  function variants(ids) {
    var out = {};
    ids.forEach(function (id) { out[id] = annotate(id, place(id)); });
    return Promise.resolve(out);
  }

  function region(chr, start, end) {
    var key = chr + ':' + start + '-' + end;
    var r = U.rng('region:' + key);
    var span = end - start + 1;
    var n = clamp(Math.round(span / 1500), 3, 200);
    var used = {}, ids = [];
    for (var i = 0; i < Math.min(n, span); i++) {
      var pos = start + Math.floor(r() * span);
      while (used[pos]) pos = pos >= end ? start : pos + 1;
      used[pos] = 1;
      ids.push(encodeId(chr, pos));
    }
    return Promise.resolve({ ids: ids, warning: null });
  }

  function detail(id) {
    return variants([id]).then(function (res) {
      var v = res[id];
      var r = U.rng('ctx:' + id);
      var flank = function () { var s = ''; for (var i = 0; i < 30; i++) s += BASES[Math.floor(r() * 4)]; return s; };
      v.context = { left: flank(), ref: v.ref, right: flank(), alt: v.alt.split(',')[0] };
      v.motifHits = [];
      return v;
    });
  }

  HR.registerSource({
    id: 'demo',
    label: 'Demo — synthetic annotations (offline)',
    shortLabel: 'Demo (synthetic)',
    ldPanel: 'synthetic',
    hasChromatin: true,
    hasEqtl: true,
    hasRefseq: true,
    hasSiphy: true,
    synthetic: true,
    note: 'Synthetic demo data for interface development. Positions, LD partners, genes, traits and scores are simulated and must not be interpreted.',
    ld: ld,
    variants: variants,
    region: region,
    detail: detail
  });
})(window.HR = window.HR || {});
