/* HaploReg v5 — shared query engine.
 *
 * Both front-ends (Classic and Explore) talk only to this file. Data comes from a pluggable
 * "source" (see source-ensembl.js / source-demo.js); every source returns variants in the
 * normalized shape documented in README.md, so a HaploReg v5 pipeline API can be dropped in
 * later without touching either UI. */
(function (HR) {
  'use strict';

  HR.VERSION = '5.0';
  HR.POPS = ['AFR', 'AMR', 'EAS', 'EUR', 'SAS'];
  HR.POP_NAMES = {
    AFR: 'African', AMR: 'Admixed American', EAS: 'East Asian', EUR: 'European', SAS: 'South Asian'
  };
  HR.LD_THRESHOLDS = [
    { value: '0.2', label: '0.2' }, { value: '0.4', label: '0.4' }, { value: '0.6', label: '0.6' },
    { value: '0.8', label: '0.8' }, { value: '1', label: '1.0' }, { value: 'NA', label: 'NA' }
  ];

  HR.DEFAULTS = {
    source: 'ensembl',
    ldThresh: '0.8',
    ldPop: 'EUR',
    epi: 'vanilla',
    cons: 'gerp',
    genetypes: 'gencode',
    trunc: '3',
    oligo: '6',
    output: 'html'
  };

  // Curated example loci for the "select a GWAS" menu. These are well-established lead SNPs,
  // not a reproduction of any single study's hit list.
  HR.GWAS_SETS = [
    { id: 't2d', trait: 'Type 2 diabetes', snps: ['rs7903146', 'rs1801282', 'rs5219', 'rs13266634', 'rs4402960', 'rs10811661', 'rs1111875', 'rs7754840'] },
    { id: 'bmi', trait: 'Body mass index / obesity', snps: ['rs1421085', 'rs9939609', 'rs17782313', 'rs6548238'] },
    { id: 'ldl', trait: 'LDL cholesterol / coronary artery disease', snps: ['rs12740374', 'rs1333049', 'rs10757278', 'rs11591147'] },
    { id: 'ibd', trait: "Crohn's disease", snps: ['rs11209026', 'rs2066844', 'rs2241880'] },
    { id: 'amd', trait: 'Age-related macular degeneration', snps: ['rs1061170', 'rs10490924'] },
    { id: 'ad', trait: "Alzheimer's disease (APOE)", snps: ['rs429358', 'rs7412'] },
    { id: 'pig', trait: 'Eye / hair pigmentation', snps: ['rs12913832', 'rs1805007', 'rs16891982'] },
    { id: 'lct', trait: 'Lactase persistence', snps: ['rs4988235'] }
  ];

  /* ---------------------------------------------------------------- sources */

  HR.sources = HR.sources || {};
  HR.registerSource = function (src) { HR.sources[src.id] = src; };
  HR.hasSource = function (id) { return Object.prototype.hasOwnProperty.call(HR.sources, id); };
  // `id` comes from the URL, so only own properties count (never Object.prototype members).
  HR.getSource = function (id) {
    if (HR.hasSource(id)) return HR.sources[id];
    if (HR.hasSource(HR.DEFAULTS.source)) return HR.sources[HR.DEFAULTS.source];
    return HR.sources[Object.keys(HR.sources)[0]];
  };
  HR.sourceList = function () {
    return Object.keys(HR.sources).map(function (k) { return HR.sources[k]; });
  };

  /* ---------------------------------------------------------------- utilities */

  var U = HR.util = {};

  U.escape = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  U.chunk = function (arr, n) {
    var out = [];
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };

  U.uniq = function (arr) { return Array.from(new Set(arr)); };

  U.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  // Run async tasks with bounded concurrency, preserving result order.
  U.mapLimit = function (items, limit, fn) {
    var results = new Array(items.length), next = 0;
    function worker() {
      if (next >= items.length) return Promise.resolve();
      var i = next++;
      return Promise.resolve(fn(items[i], i)).then(function (r) { results[i] = r; return worker(); });
    }
    var workers = [];
    for (var w = 0; w < Math.min(limit, items.length); w++) workers.push(worker());
    return Promise.all(workers).then(function () { return results; });
  };

  // 32-bit string hash (FNV-1a) and a small seeded PRNG (mulberry32).
  U.hash = function (str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return h >>> 0;
  };
  U.rng = function (seed) {
    var a = typeof seed === 'string' ? U.hash(seed) : seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  U.store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };

  U.params = function (search) {
    var out = {};
    new URLSearchParams(search == null ? location.search : search).forEach(function (v, k) { out[k] = v; });
    return out;
  };

  /* ---------------------------------------------------------------- query parsing */

  var REGION_RE = /^(?:chr)?([0-9]{1,2}|X|Y):([\d,]+)-([\d,]+)$/i;
  var RSID_RE = /^rs\d+$/i;

  HR.parseQuery = function (text) {
    var raw = String(text || '').trim();
    if (!raw) return { kind: 'empty' };
    var region = raw.replace(/\s+/g, '').match(REGION_RE);
    if (region) {
      var start = parseInt(region[2].replace(/,/g, ''), 10);
      var end = parseInt(region[3].replace(/,/g, ''), 10);
      if (end < start) { var t = start; start = end; end = t; }
      return { kind: 'region', chr: region[1].toUpperCase(), start: start, end: end };
    }
    var tokens = raw.split(/[\s,;]+/).filter(Boolean);
    var ids = [], invalid = [];
    tokens.forEach(function (tok) {
      if (RSID_RE.test(tok)) ids.push(tok.toLowerCase());
      else invalid.push(tok);
    });
    return { kind: 'ids', ids: U.uniq(ids), invalid: invalid };
  };

  // Pull rsIDs out of an uploaded text file (one per line, extra columns ignored).
  HR.idsFromFile = function (text) {
    var ids = [];
    String(text).split(/\r?\n/).forEach(function (line) {
      var m = line.match(/\brs\d+\b/i);
      if (m) ids.push(m[0].toLowerCase());
    });
    return U.uniq(ids);
  };

  // Allowed values for every option; anything else (hand-edited or crafted URLs) falls back to the default.
  HR.OPTION_VALUES = {
    ldThresh: HR.LD_THRESHOLDS.map(function (t) { return t.value; }),
    epi: ['vanilla', 'imputed', 'methyl', 'acetyl'],
    cons: ['gerp', 'siphy', 'both'],
    genetypes: ['gencode', 'refseq', 'both'],
    trunc: ['0', '1', '2', '3', '4', '5', '1000'],
    oligo: ['1', '6', '1000'],
    output: ['html', 'text']
  };

  HR.normalizeOptions = function (o) {
    var out = {};
    Object.keys(HR.DEFAULTS).forEach(function (k) {
      out[k] = o && o[k] != null && o[k] !== '' ? String(o[k]) : HR.DEFAULTS[k];
    });
    if (HR.POPS.indexOf(out.ldPop) < 0) out.ldPop = out.ldPop === 'ASN' ? 'EAS' : HR.DEFAULTS.ldPop;
    // v4 links use '1.1' for NA and '0.80' / '1.0' style numbers.
    if (out.ldThresh === '1.1' || /^na$/i.test(out.ldThresh)) out.ldThresh = 'NA';
    else if (isFinite(parseFloat(out.ldThresh))) out.ldThresh = String(parseFloat(out.ldThresh));
    Object.keys(HR.OPTION_VALUES).forEach(function (k) {
      if (HR.OPTION_VALUES[k].indexOf(out[k]) < 0) out[k] = HR.DEFAULTS[k];
    });
    if (!HR.hasSource(out.source)) out.source = HR.DEFAULTS.source;
    return out;
  };

  /* ---------------------------------------------------------------- running a query */

  /**
   * Run a HaploReg query.
   * @returns Promise<{blocks, notFound, invalid, warnings, source, options, title}>
   *   blocks: [{ queryId, title, rows: [{ v, r2, dprime, isQuery }] }]
   */
  HR.runQuery = async function (text, options, onProgress) {
    var opts = HR.normalizeOptions(options);
    var src = HR.getSource(opts.source);
    var progress = onProgress || function () {};
    var parsed = HR.parseQuery(text);
    var result = {
      blocks: [], notFound: [], invalid: parsed.invalid || [], warnings: [],
      source: src, options: opts, parsed: parsed
    };
    if (parsed.kind === 'empty') throw new Error('Please enter at least one rsID or a region.');

    var thresh = opts.ldThresh === 'NA' ? null : parseFloat(opts.ldThresh);
    var plan = []; // [{ queryId, title, partners: [{id, r2, dprime}] }]

    if (parsed.kind === 'region') {
      progress('Finding variants in chr' + parsed.chr + ':' + parsed.start + '-' + parsed.end);
      var reg = await src.region(parsed.chr, parsed.start, parsed.end, opts);
      if (reg.warning) result.warnings.push(reg.warning);
      plan.push({
        queryId: null,
        title: 'chr' + parsed.chr + ':' + parsed.start + '-' + parsed.end,
        partners: reg.ids.map(function (id) { return { id: id, r2: null, dprime: null, isQuery: true }; })
      });
    } else if (!parsed.ids.length) {
      throw new Error('No valid rsIDs found in the query (expected e.g. rs7903146).');
    } else if (thresh == null) {
      plan.push({
        queryId: null, title: 'Query SNPs',
        partners: parsed.ids.map(function (id) { return { id: id, r2: null, dprime: null, isQuery: true }; })
      });
    } else {
      var done = 0;
      var ldLists = await U.mapLimit(parsed.ids, 3, function (id) {
        return src.ld(id, opts.ldPop, thresh, opts).then(function (list) {
          progress('Computing LD (' + (++done) + '/' + parsed.ids.length + ')');
          return list;
        }, function (err) {
          result.warnings.push('LD lookup failed for ' + id + ': ' + err.message);
          return [];
        });
      });
      parsed.ids.forEach(function (id, i) {
        var partners = [{ id: id, r2: 1, dprime: 1, isQuery: true }];
        (ldLists[i] || []).forEach(function (p) {
          if (p.id !== id && p.r2 >= thresh - 1e-9) partners.push({ id: p.id, r2: p.r2, dprime: p.dprime, isQuery: false });
        });
        plan.push({ queryId: id, title: id, partners: partners });
      });
    }

    var allIds = U.uniq([].concat.apply([], plan.map(function (b) { return b.partners.map(function (p) { return p.id; }); })));
    progress('Fetching annotations for ' + allIds.length + ' variant' + (allIds.length === 1 ? '' : 's'));
    // IDs the source failed to fetch are covered by its warning, not reported as absent from dbSNP.
    var failed = {};
    var variants = allIds.length ? await src.variants(allIds, opts, progress, function (w, ids) {
      result.warnings.push(w);
      (ids || []).forEach(function (id) { failed[id] = 1; });
    }) : {};

    plan.forEach(function (b) {
      if (b.queryId && !variants[b.queryId]) {
        if (!failed[b.queryId]) result.notFound.push(b.queryId);
        return;
      }
      var rows = [], seen = new Set();
      b.partners.forEach(function (p) {
        var v = variants[p.id];
        if (!v) {
          if (parsed.kind === 'ids' && !b.queryId && !failed[p.id]) result.notFound.push(p.id);
          return;
        }
        // Two requested IDs can resolve to the same merged record.
        if (seen.has(v)) return;
        seen.add(v);
        rows.push({ v: v, r2: p.r2, dprime: p.dprime, isQuery: b.queryId ? p.id === b.queryId : parsed.kind === 'ids' });
      });
      rows.sort(function (a, c) {
        return HR.chrOrder(a.v.chr) - HR.chrOrder(c.v.chr) || a.v.pos - c.v.pos;
      });
      if (rows.length) result.blocks.push({ queryId: b.queryId, title: b.title, rows: rows });
    });
    result.notFound = U.uniq(result.notFound);
    return result;
  };

  HR.getDetail = function (id, options, onProgress) {
    var opts = HR.normalizeOptions(options);
    return HR.getSource(opts.source).detail(String(id).toLowerCase(), opts, onProgress || function () {});
  };

  HR.chrOrder = function (c) {
    if (c === 'X') return 23;
    if (c === 'Y') return 24;
    if (c === 'MT' || c === 'M') return 25;
    return parseInt(c, 10) || 99;
  };

  /* ---------------------------------------------------------------- annotation summaries */

  // Epigenomes in which the variant falls in a promoter- / enhancer-like element.
  HR.regElements = function (v, epi) {
    var out = { promoter: [], enhancer: [] };
    if (epi === 'methyl' || epi === 'acetyl') {
      if (!v.marks) return out;
      var ms = HR.MARK_SOURCES[epi];
      Object.keys(v.marks).forEach(function (eid) {
        if (v.marks[eid].indexOf(ms.promoter) >= 0) out.promoter.push(eid);
        if (v.marks[eid].indexOf(ms.enhancer) >= 0) out.enhancer.push(eid);
      });
    } else {
      var states = epi === 'imputed' ? v.states25 : v.states;
      if (!states) return out;
      var cls = HR.STATE_CLASSES[epi === 'imputed' ? 'imputed' : 'vanilla'];
      Object.keys(states).forEach(function (eid) {
        if (cls.promoter.indexOf(states[eid]) >= 0) out.promoter.push(eid);
        if (cls.enhancer.indexOf(states[eid]) >= 0) out.enhancer.push(eid);
      });
    }
    out.promoter.sort(); out.enhancer.sort();
    return out;
  };

  // Distinct tissue abbreviations (BLD, GI, BRN…) for a list of epigenome IDs.
  HR.tissuesOf = function (eids) {
    return U.uniq(eids.map(function (e) { return HR.EPI_BY_ID[e] ? HR.EPI_BY_ID[e].tissue : e; }));
  };

  HR.describeEpis = function (eids) {
    return eids.map(function (e) { return HR.EPI_BY_ID[e] ? HR.EPI_BY_ID[e].desc : e; }).join(', ');
  };

  HR.stateOf = function (n, model) {
    return (model === 'imputed' ? HR.STATES25 : HR.STATES15)[n - 1];
  };

  HR.fmtFreq = function (x) {
    if (x == null || isNaN(x)) return '';
    return String(Math.round(x * 100) / 100);
  };

  HR.fmtP = function (p) {
    if (p == null || p === '') return '';
    var n = Number(p);
    if (!isFinite(n) || n < 0) return String(p);
    if (n < 1e-300) return '<1E-300'; // reported as 0 or denormal: below floating-point range
    var e = Math.floor(Math.log10(n));
    var m = Math.round(n / Math.pow(10, e));
    if (m === 10) { m = 1; e += 1; }
    return e >= -3 ? String(Number(n.toPrecision(2))) : m + 'E' + e;
  };

  // Indel oligos longer than `oligo` are condensed to "N-mer", as in v4.
  HR.fmtAllele = function (a, oligo) {
    var lim = parseInt(oligo, 10) || 6;
    return String(a || '').split(',').map(function (x) {
      return x.length > lim ? x.length + '-mer' : x;
    }).join(',');
  };

  HR.geneLabel = function (g) {
    if (!g || !g.symbol) return '';
    if (g.direction === 'within' || !g.distance) return g.symbol;
    return (g.distance / 1000).toFixed(1).replace(/\.0$/, '') + 'kb ' + g.direction + ' of ' + g.symbol;
  };

  HR.genesFor = function (v, genetypes) {
    var g = v.genes || {};
    if (genetypes === 'refseq') return g.refseq ? [g.refseq] : [];
    if (genetypes === 'both') return [g.gencode, g.refseq].filter(Boolean);
    return g.gencode ? [g.gencode] : [];
  };

  var FUNC_MAP = {
    intron_variant: 'intronic', missense_variant: 'missense', synonymous_variant: 'synonymous',
    '5_prime_UTR_variant': "5'-UTR", '3_prime_UTR_variant': "3'-UTR", stop_gained: 'nonsense',
    stop_lost: 'stop-loss', start_lost: 'start-loss', frameshift_variant: 'frameshift',
    inframe_insertion: 'cds-indel', inframe_deletion: 'cds-indel', splice_donor_variant: 'splice-5',
    splice_acceptor_variant: 'splice-3', splice_region_variant: 'splice-region',
    non_coding_transcript_exon_variant: 'ncRNA', mature_miRNA_variant: 'miRNA',
    upstream_gene_variant: '', downstream_gene_variant: '', intergenic_variant: '',
    regulatory_region_variant: '', TF_binding_site_variant: '', non_coding_transcript_variant: '',
    protein_altering_variant: 'protein altering', stop_retained_variant: 'stop retained',
    start_retained_variant: 'start retained'
  };
  HR.funcFromSO = function (so) {
    if (!so) return '';
    if (FUNC_MAP.hasOwnProperty(so)) return FUNC_MAP[so];
    return so.replace(/_variant$/, '').replace(/_/g, ' ');
  };
  // Exact v4 terms: "stop retained" / "start retained" leave the protein unchanged.
  HR.funcClass = function (f) {
    if (/^(missense|nonsense|frameshift|stop-loss|start-loss|splice-[35]|cds-indel|protein altering)$/.test(f)) return 'nonsilent';
    if (/^(synonymous|stop retained|start retained)$/.test(f)) return 'silent';
    return '';
  };

  HR.isConserved = function (v, cons) {
    var g = v.gerpCons, s = v.siphyCons;
    if (cons === 'gerp') return g;
    if (cons === 'siphy') return s;
    if (g == null && s == null) return null;
    return !!(g || s);
  };

  // A compact summary used by both UIs to fill the result table.
  // mode 'epigenome': promoter/enhancer/dnase are epigenome IDs (pipeline or demo data).
  // mode 'regbuild':  they are Ensembl Regulatory Build feature types (live source).
  HR.summarize = function (v, opts) {
    var gwas = v.gwas || [], eqtl = v.eqtl || [], motifs = v.motifs || [], proteins = v.proteins || [];
    var mode = v.states || v.marks ? 'epigenome' : 'regbuild';
    var el, dnase;
    if (mode === 'epigenome') {
      el = HR.regElements(v, opts.epi);
      dnase = v.dnase || [];
    } else {
      var types = (v.regfeatures || []).map(function (f) { return f.type; });
      el = {
        promoter: types.filter(function (t) { return /promoter/.test(t); }),
        enhancer: types.filter(function (t) { return t === 'enhancer'; })
      };
      dnase = types.filter(function (t) { return t === 'open_chromatin_region'; });
      if (types.indexOf('TF_binding_site') >= 0) proteins = proteins.concat([{ factor: 'TF binding site' }]);
    }
    return {
      mode: mode,
      promoter: el.promoter,
      enhancer: el.enhancer,
      dnase: dnase,
      proteins: U.uniq(proteins.map(function (p) { return p.factor; })),
      motifs: U.uniq(motifs.map(function (m) { return m.name; })),
      gwas: gwas,
      eqtl: eqtl,
      grasp: v.grasp || [],
      genes: HR.genesFor(v, opts.genetypes),
      func: v.func || '',
      conserved: HR.isConserved(v, opts.cons)
    };
  };

  /* ---------------------------------------------------------------- text output */

  HR.TEXT_COLUMNS = ['chr', 'pos_hg38', 'r2', "D'", 'is_query_snp', 'rsID', 'ref', 'alt',
    'AFR', 'AMR', 'EAS', 'EUR', 'SAS', 'GERP_cons', 'SiPhy_cons', 'Chromatin_States',
    'Chromatin_States_Imputed', 'Chromatin_Marks', 'DNAse', 'Proteins', 'eQTL', 'gwas', 'grasp',
    'Motifs', 'Regulatory_Build', 'GENCODE_id', 'GENCODE_name', 'GENCODE_direction',
    'GENCODE_distance', 'RefSeq_id', 'RefSeq_name', 'RefSeq_direction', 'RefSeq_distance',
    'dbSNP_functional_annotation', 'query_snp_rsid'];

  // '#' comment lines carry provenance and anything left out of the rows; the header follows them.
  HR.toText = function (result) {
    var notes = [];
    if (result.source && result.source.synthetic) {
      notes.push('# SYNTHETIC DEMO DATA - not real annotations (source=' + result.source.id + '). Do not use for analysis.');
    } else if (result.source) {
      notes.push('# HaploReg v5 - data source: ' + result.source.label);
    }
    (result.warnings || []).forEach(function (w) { notes.push('# Warning: ' + w); });
    if (result.invalid && result.invalid.length) notes.push('# Ignored unrecognized query terms: ' + result.invalid.join(', '));
    if (result.notFound && result.notFound.length) notes.push('# Not found: ' + result.notFound.join(', '));
    var lines = notes.concat([HR.TEXT_COLUMNS.join('\t')]);
    function dot(x) { return x == null || x === '' ? '.' : x; }
    function stateList(states, model) {
      if (!states) return '.';
      var cls = HR.STATE_CLASSES[model];
      var keep = cls.promoter.concat(cls.enhancer);
      var items = Object.keys(states).sort().filter(function (e) { return keep.indexOf(states[e]) >= 0; })
        .map(function (e) { return e + ',' + HR.stateOf(states[e], model).code; });
      return items.join(';') || '.';
    }
    result.blocks.forEach(function (b) {
      b.rows.forEach(function (r) {
        var v = r.v, g = v.genes || {}, gc = g.gencode || {}, rs = g.refseq || {};
        var marks = v.marks ? Object.keys(v.marks).sort().reduce(function (acc, e) {
          v.marks[e].forEach(function (m) { acc.push(e + ',' + m + '_' + HR.MARK_KIND[m]); });
          return acc;
        }, []).join(';') : '';
        lines.push([
          v.chr, v.pos, dot(r.r2), dot(r.dprime), r.isQuery ? 1 : 0, v.id, v.ref, v.alt,
          dot(HR.fmtFreq(v.af.AFR)), dot(HR.fmtFreq(v.af.AMR)), dot(HR.fmtFreq(v.af.EAS)),
          dot(HR.fmtFreq(v.af.EUR)), dot(HR.fmtFreq(v.af.SAS)),
          v.gerpCons == null ? '.' : (v.gerpCons ? 1 : 0), v.siphyCons == null ? '.' : (v.siphyCons ? 1 : 0),
          stateList(v.states, 'vanilla'), stateList(v.states25, 'imputed'), dot(marks),
          dot((v.dnase || []).join(',')),
          dot((v.proteins || []).map(function (p) { return p.factor + ',' + p.cell; }).join(';')),
          dot((v.eqtl || []).map(function (q) { return [q.source, q.tissue, q.gene, HR.fmtP(q.p)].join(','); }).join(';')),
          dot((v.gwas || []).map(function (q) { return [q.pmid || '', q.trait, HR.fmtP(q.p)].join(','); }).join(';')),
          dot((v.grasp || []).map(function (q) { return [q.pmid || '', q.trait, HR.fmtP(q.p)].join(','); }).join(';')),
          dot((v.motifs || []).map(function (m) { return m.name; }).join(';')),
          dot((v.regfeatures || []).map(function (f) { return f.type; }).join(';')),
          dot(gc.id), dot(gc.symbol), dot(gc.direction), gc.symbol ? gc.distance || 0 : '.',
          dot(rs.id), dot(rs.symbol), dot(rs.direction), rs.symbol ? rs.distance || 0 : '.',
          dot(v.func), dot(b.queryId || (r.isQuery ? v.id : ''))
        ].join('\t'));
      });
    });
    return lines.join('\n') + '\n';
  };

  HR.download = function (filename, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  };

  /* ---------------------------------------------------------------- links */

  HR.links = {
    dbsnp: function (id) { return 'https://www.ncbi.nlm.nih.gov/snp/' + encodeURIComponent(id); },
    ensembl: function (id) { return 'https://www.ensembl.org/Homo_sapiens/Variation/Explore?v=' + encodeURIComponent(id); },
    gwas: function (id) { return 'https://www.ebi.ac.uk/gwas/variants/' + encodeURIComponent(id); },
    gene: function (gid) { return 'https://www.ensembl.org/Homo_sapiens/Gene/Summary?g=' + encodeURIComponent(gid); },
    pubmed: function (pmid) { return 'https://pubmed.ncbi.nlm.nih.gov/' + encodeURIComponent(pmid) + '/'; },
    gtex: function (id) { return 'https://gtexportal.org/home/snp/' + encodeURIComponent(id); },
    ucsc: function (chr, pos) {
      return 'https://genome.ucsc.edu/cgi-bin/hgTracks?db=hg38&position=chr' + chr + ':' + Math.max(1, pos - 250) + '-' + (pos + 250);
    }
  };
})(window.HR = window.HR || {});
