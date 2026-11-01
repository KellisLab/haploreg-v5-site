# HaploReg v5 — web interfaces

A static site with two front-ends on one data layer. Plain JavaScript, no build step.

Live at <https://kellislab.github.io/haploreg-v5-site/> (GitHub Pages, served from `main`) and <https://haploreg-v5-nu.vercel.app/>.

- **The site** (`index.html`, `explore/`, `docs/`) is the redesigned HaploReg. The landing page carries a procedural LD landscape. Explore has an LD plot, a chromatin-state heatmap across the 127 Roadmap epigenomes, evidence filters and ranking, a record view per variant, TSV export, shareable URLs and light/dark appearance. Docs is a searchable glossary with reference tables.
- **Classic** (`classic/`) reproduces the HaploReg v4.2 interface: the green query page, Build Query / Set Options / Documentation tabs, the same result-table columns and cell colors, the v4-style variant detail page and text output.

Every term is defined in one file, `shared/glossary.js`. Explore shows it through an ⓘ popover on each column, control and section, linking to `docs/`. Classic shows it through `?` links to `classic/documentation.html`.

### Design

The redesigned site is monochrome on purpose. The only colours on screen are data: ChromHMM state colours and small evidence dots, so colour always means something. Type is Geist for text and Geist Mono for genomic data (rsIDs, coordinates, sequences). The tokens live at the top of `assets/site.css`, with light and dark values.

The landing art (`assets/hero.js`) is Haploview's LD triangle drawn as hidden-line terrain. Each line joins variant pairs the same distance apart, raised by their r². Recombination hotspots between blocks slowly strengthen and relax. It is simulated, says so in its caption, respects reduced motion, and pauses when off screen.

## Running it

There is nothing to install. Serve the folder and open it in a browser:

```bash
python -m http.server 8765
```

Then open <http://localhost:8765/>. Opening `index.html` straight from disk also works, because no page loads local files with `fetch`.

URLs carry the whole query, so links can be shared, for example `classic/index.html?query=rs7903146&ldPop=AFR` or `explore/?query=rs12740374&ldThresh=0.6`. Old `/neo/` links redirect to `/explore/` on Vercel. GitHub Pages publishes the repository root as it is (`.nojekyll` turns off Jekyll); the redirects and security headers in `vercel.json` apply on Vercel only. Parameter names match v4: `query`, `ldThresh`, `ldPop`, `epi`, `cons`, `genetypes`, `trunc`, `oligo`, `output`, plus `source`.

## Data sources

| Source | What it provides | Use |
| --- | --- | --- |
| `ensembl` (default) | Real GRCh38 positions, 1000 Genomes Phase 3 frequencies and LD (r², D′), NHGRI-EBI GWAS hits, VEP consequences, GERP, Ensembl Regulatory Build overlaps, JASPAR motif hits, nearest GENCODE gene. Fetched live from `rest.ensembl.org` in the browser. | Real queries until the v5 backend is up |
| `demo` | Deterministic **synthetic** data for every column, including per-epigenome ChromHMM states, histone peaks, DNase and eQTLs. Partner and region IDs are 14-digit `rs9…` IDs (far outside the dbSNP range) that encode their simulated position, genes are `DMG*`. Both UIs show a warning banner. | Offline development and demos only |

The Ensembl source can't supply per-epigenome chromatin states, SiPhy, GRASP, eQTLs or RefSeq, so those cells stay empty and the UIs say why. The public Ensembl API can be slow (10–25 s per call at busy times). A query usually takes 5–30 s.

## Layout

```
index.html               landing page with the procedural hero
explore/                 the app: index.html + explore.js
docs/                    documentation and glossary
assets/
  site.css               design system (tokens, type, components) for the landing page, Explore and Docs
  ui.js                  info popovers, tooltips, theme switch, top bar
  hero.js                procedural LD landscape
  demo/                  the HaploReg × Mantis demo video (web encode) and its poster, shown on the landing page
shared/
  epigenomes.js          Roadmap E001–E129 metadata, ChromHMM 15/25-state models and colors
  engine.js              query parsing, LD expansion, summaries, TSV export, links
  glossary.js            every definition used by tooltips, ? links and both docs pages
  source-ensembl.js      live Ensembl REST source
  source-demo.js         synthetic offline source
classic/                 v4-style interface: index, detail, documentation (own stylesheet)
```

## Connecting the v5 pipeline

Add a file next to the existing sources that calls `HR.registerSource({...})` with the same interface, and include it with a `<script>` tag in the pages. Neither UI needs other changes.

```js
HR.registerSource({
  id: 'v5', label: 'HaploReg v5 pipeline', shortLabel: 'v5 pipeline', ldPanel: '1000G high-coverage',
  ld(id, pop, r2) {},            // -> Promise<[{ id, r2, dprime }]>  LD partners with r² ≥ threshold
  variants(ids, opts, progress) {}, // -> Promise<{ [id]: Variant }>
  region(chr, start, end) {},    // -> Promise<{ ids: [...], warning }>
  detail(id, opts, progress) {}  // -> Promise<Variant + { context, motifHits }>
});
```

A `Variant` is a plain object. Fields a source can't fill are `null`:

```js
{
  id: 'rs7903146', chr: '10', pos: 112998590, end: 112998590, ref: 'C', alt: 'T',
  af: { AFR: 0.26, AMR: 0.23, EAS: 0.02, EUR: 0.32, SAS: 0.30 },   // AF_*_unrel from the VCF
  gerp: -2.56, gerpCons: false, siphyCons: null,
  states:   { E001: 15, E063: 7, ... },   // core 15-state index (1-based) per epigenome
  states25: { E001: 25, ... },            // 25-state model, optional
  marks:    { E063: ['H3K4me1', 'H3K27ac'] },
  missing:  { E001: ['H3K27ac', 'DNase'] }, // marks not profiled ("black" cells)
  dnase:    ['E017', ...],
  proteins: [{ factor: 'CTCF', cell: 'GM12878' }],
  motifs:   [{ name: 'HNF4', id: 'HNF4_known4', strand: '+', ref: 11.2, alt: 6.6 }], // MOODS LODs
  gwas:     [{ trait, p, pmid, riskAllele }],
  eqtl:     [{ source, tissue, gene, p }],
  grasp:    [{ trait, p, pmid }],
  regfeatures: null,                      // Regulatory Build features (Ensembl source only)
  genes: { gencode: { id, symbol, direction: 'within' | "5'" | "3'", distance, desc }, refseq: null },
  func: 'intronic'                        // v4 vocabulary, see HR.funcFromSO
}
```

The pipeline VCF (`#CHROM POS ID REF ALT AF_*_unrel` plus ChromHMM states and MOODS motifs) maps directly onto these fields. A thin API over the tabix-indexed VCFs, or range requests against the bgzipped files, is enough.

## Differences from v4

- Annotations computed natively on GRCh38. v4 annotated on hg19 and displayed hg38 positions.
- Five superpopulations (AFR, AMR, EAS, EUR, SAS). v4's ASN held only East Asian samples and corresponds to EAS; SAS is new.
- The default conservation column is GERP, which the interim live source can provide. SiPhy-omega is still available.
- The "select a GWAS" menu holds a small curated set of well-replicated lead SNPs until the pipeline's GWAS table is wired in.
- A Data source option, and help links on every column and option.
