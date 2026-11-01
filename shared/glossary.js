/* HaploReg v5 — glossary and documentation content shared by Classic, Explore and Docs.
 *
 * Every column, option and annotation in the interfaces maps to an entry here, so the
 * help icons, hover tooltips and both documentation pages always say the same thing.
 * `short` is plain text (tooltips); `body` is trusted HTML written for the docs pages.
 * Links of the form <a data-term="id"> are rewritten by each UI to point at that entry. */
(function (HR) {
  'use strict';

  HR.DOC_CATEGORIES = [
    { id: 'query', title: 'Queries & linkage disequilibrium' },
    { id: 'variant', title: 'Variant facts' },
    { id: 'freq', title: 'Populations & allele frequencies' },
    { id: 'chromatin', title: 'Chromatin states & epigenomes' },
    { id: 'binding', title: 'Protein binding & regulatory motifs' },
    { id: 'cons', title: 'Sequence conservation' },
    { id: 'assoc', title: 'Trait & expression associations' },
    { id: 'genes', title: 'Genes & functional consequence' },
    { id: 'map', title: 'Evidence map & reasoning trace' },
    { id: 'options', title: 'Options, sources & output' }
  ];

  HR.GLOSSARY = [
    /* ------------------------------------------------------------ query & LD */
    { id: 'rsid', cat: 'query', term: 'rsID (refSNP ID)',
      short: 'dbSNP reference identifier for a variant, e.g. rs7903146. HaploReg queries are lists of rsIDs.',
      body: '<p>The stable identifier that NCBI dbSNP assigns to a variant position and its alleles, written <code>rs</code> followed by a number (for example <code>rs7903146</code>). Several submissions describing the same variant are merged under one rsID. When two rsIDs turn out to describe the same variant, the higher-numbered (newer) one is merged into the lower-numbered (older) one; the retired ID is kept as a synonym and still resolves, and HaploReg shows the current ID.</p><p>Enter rsIDs separated by commas, spaces or new lines. Case does not matter.</p>' },
    { id: 'region', cat: 'query', term: 'Region query',
      short: 'chrN:start-end in GRCh38 (hg38) coordinates; returns every 1000 Genomes variant in the window.',
      body: '<p>Instead of rsIDs you can enter one genomic interval as <code>chrN:start-end</code>, e.g. <code>chr10:112990000-113000000</code>. Coordinates are GRCh38 (hg38), 1-based and inclusive; commas in numbers are ignored. All variants in the interval that are present in the <a data-term="kg">1000 Genomes</a> panel are listed in one table without LD expansion.</p><p>The live Ensembl source caps region queries at 50 kb and 400 variants.</p>' },
    { id: 'gwas-select', cat: 'query', term: 'Select a GWAS',
      short: 'Load a curated set of well-established lead SNPs for a trait as the query.',
      body: '<p>A shortcut that fills the query with lead SNPs for a trait. In v4 this menu listed every study in the GWAS Catalog; in v5 it currently offers a small curated set of well-replicated loci (for example <code>rs7903146</code> at <i>TCF7L2</i> for type 2 diabetes) and will be repopulated from the pipeline\'s GWAS table.</p>' },
    { id: 'query-snp', cat: 'query', term: 'Query SNP',
      short: 'A variant you entered. Shown in red; the other rows are its LD partners.',
      body: '<p>A variant from your query. In the results table its rsID is shown in <span style="color:red">red</span>; every other row in the same table is a variant in <a data-term="ld">LD</a> with it at or above the chosen <a data-term="ld-threshold">r² threshold</a>.</p>' },
    { id: 'ld', cat: 'query', term: 'Linkage disequilibrium (LD)',
      short: 'Non-random association of alleles at nearby variants; variants in high LD are inherited together.',
      body: '<p>Alleles at nearby variants are often inherited together because recombination rarely separates them, so in a population they are correlated. This correlation is linkage disequilibrium. A GWAS lead SNP is usually just the best-measured member of a <a data-term="haplotype-block">haplotype block</a>: any variant in strong LD with it could be the causal one. HaploReg expands every query SNP to its LD partners so that all candidates can be compared side by side.</p><p>LD is measured with <a data-term="r2">r²</a> and <a data-term="dprime">D′</a>, and it differs between ancestries (see <a data-term="ld-population">LD population</a>).</p>' },
    { id: 'r2', cat: 'query', term: 'r² (LD r-squared)',
      short: 'Squared correlation between two variants (0–1). 1 = one perfectly predicts the other.',
      body: '<p>The squared correlation between the allele counts of two variants across the haplotypes of a population. With allele frequencies p<sub>A</sub>, p<sub>B</sub> and haplotype frequency p<sub>AB</sub>:</p><p><code>D = p<sub>AB</sub> − p<sub>A</sub>p<sub>B</sub></code> and <code>r² = D² / (p<sub>A</sub>(1−p<sub>A</sub>) p<sub>B</sub>(1−p<sub>B</sub>))</code>.</p><p>r² = 1 means the two variants are perfect proxies; r² ≥ 0.8 is the conventional cut-off for "strong LD". r² can only be high when the two variants have similar allele frequencies.</p>' },
    { id: 'dprime', cat: 'query', term: 'D′ (D-prime)',
      short: 'LD normalized to its maximum (0–1). 1 = no sign of historical recombination between the two sites.',
      body: '<p>The LD coefficient D divided by the largest value it could take given the two allele frequencies. D′ = 1 means at most three of the four possible two-variant haplotypes are seen, i.e. no evidence of recombination between the sites. D′ can be 1 even when <a data-term="r2">r²</a> is low (for example a rare variant on a common haplotype), so it describes shared history rather than how well one variant predicts the other.</p>' },
    { id: 'ld-threshold', cat: 'query', term: 'LD threshold (r²)',
      short: 'Minimum r² for a variant to be listed with a query SNP. NA = show only the queried variants.',
      body: '<p>Variants in LD with a query SNP are listed only if their <a data-term="r2">r²</a> is at least this value (0.2, 0.4, 0.6, 0.8 or 1.0; default 0.8). Each query SNP then gets its own table. Choose <b>NA</b> to skip LD expansion and show all queried variants together in a single table.</p><p>The live source searches a 500 kb window around each query SNP.</p>' },
    { id: 'ld-population', cat: 'query', term: 'LD population',
      short: 'Superpopulation whose haplotypes are used to compute LD (AFR, AMR, EAS, EUR or SAS).',
      body: '<p>LD is computed from the phased haplotypes of one <a data-term="superpopulation">superpopulation</a>. Block structure differs by ancestry: African-ancestry populations carry more haplotype diversity and generally shorter LD blocks, so the same lead SNP tags fewer variants there. Comparing populations is a simple way to narrow a candidate set (trans-ethnic fine-mapping). Choose the population that matches the cohort in which the association was found.</p>' },
    { id: 'haplotype-block', cat: 'query', term: 'Haplotype / haplotype block',
      short: 'A haplotype is the set of alleles on one chromosome copy; a block is a stretch inherited largely intact.',
      body: '<p>A haplotype is the combination of alleles carried together on a single copy of a chromosome. A haplotype block is a stretch of the genome with little historical recombination, so only a few common haplotypes exist and variants inside it are in high <a data-term="ld">LD</a>.</p>' },

    /* ------------------------------------------------------------ variant facts */
    { id: 'pos', cat: 'variant', term: 'chr / pos (hg38)',
      short: 'Chromosome and 1-based position on the GRCh38 (hg38) reference genome.',
      body: '<p>Chromosome and position of the variant on the GRCh38 human reference assembly (also called hg38). Positions are 1-based; for indels the position is the first affected base. HaploReg v4 computed its annotations on hg19 but already displayed hg38 positions (from dbSNP); v5 is built natively on GRCh38, matching the 1000 Genomes high-coverage call set.</p>' },
    { id: 'ref-alt', cat: 'variant', term: 'Ref / Alt allele',
      short: 'Reference allele on the GRCh38 forward strand, and the alternate allele(s).',
      body: '<p><b>Ref</b> is the base(s) found in the GRCh38 reference at this position, on the forward strand. <b>Alt</b> lists the alternate allele(s); a comma-separated list means the site is <a data-term="multiallelic">multi-allelic</a>. Long insertions or deletions are abbreviated as <code>N-mer</code> (see <a data-term="oligo">condense indel oligos</a>); hover over the cell to see the full sequence.</p><p>The reference allele is not necessarily the ancestral or the major allele.</p>' },
    { id: 'indel', cat: 'variant', term: 'Indel',
      short: 'An insertion or deletion of one or more bases, as opposed to a single-base substitution (SNV).',
      body: '<p>A short insertion or deletion. HaploReg lists SNVs and small indels; an indel shows Ref and Alt alleles of different lengths.</p>' },
    { id: 'multiallelic', cat: 'variant', term: 'Multi-allelic site',
      short: 'A position with more than one alternate allele, e.g. Alt = A,C,G.',
      body: '<p>A site where more than one alternate allele has been observed. Allele frequencies for such sites are reported as the combined frequency of all non-reference alleles.</p>' },
    { id: 'ancestral', cat: 'variant', term: 'Ancestral allele',
      short: 'The allele inferred to be present in the common ancestor of humans and other primates.',
      body: '<p>The allele inferred, from primate alignments, to be the ancestral state. The other allele arose by mutation in the human lineage. Shown on the detail page when available.</p>' },

    /* ------------------------------------------------------------ populations */
    { id: 'af', cat: 'freq', term: 'Allele frequency (freq)',
      short: 'Fraction of chromosomes in the population carrying the alternate allele (0–1).',
      body: '<p>The proportion of chromosomes in a population that carry the alternate allele, from 0 to 1. A value of 0.31 under EUR means 31% of European-ancestry chromosomes in the panel carry the Alt allele. For <a data-term="multiallelic">multi-allelic</a> sites all alternate alleles are summed. The <b>minor allele frequency (MAF)</b> is the smaller of the frequency and one minus the frequency.</p>' },
    { id: 'superpopulation', cat: 'freq', term: 'Superpopulation (AFR, AMR, EAS, EUR, SAS)',
      short: 'The five continental groupings of the 1000 Genomes Project samples.',
      body: '<p>The 26 1000 Genomes populations are grouped into five superpopulations:</p><ul><li><b>AFR</b> — African: YRI, LWK, GWD, MSL, ESN, and the African-ancestry populations ASW and ACB in the Americas.</li><li><b>AMR</b> — Admixed American: MXL, PUR, CLM, PEL.</li><li><b>EAS</b> — East Asian: CHB, JPT, CHS, CDX, KHV.</li><li><b>EUR</b> — European: CEU, TSI, FIN, GBR, IBS.</li><li><b>SAS</b> — South Asian: GIH, PJL, BEB, STU, ITU.</li></ul><p>HaploReg v4 used 1000 Genomes Phase 1, whose single Asian group (<b>ASN</b>) contained only East Asian samples (CHB, CHS, JPT), so it corresponds to EAS. South Asian populations (SAS) were first sequenced in Phase 3 and are new in v5.</p>' },
    { id: 'kg', cat: 'freq', term: '1000 Genomes Project',
      short: 'Public catalogue of human genetic variation; the reference panel for HaploReg frequencies and LD.',
      body: '<p>An international project that sequenced individuals from 26 populations. <b>Phase 3</b> (2015) released genotypes for 2,504 unrelated people and is what the live Ensembl source uses. The <b>high-coverage</b> resequencing by the New York Genome Center (2022) sequenced 3,202 samples, including 602 parent-child trios, to 30× depth on GRCh38. The HaploReg v5 pipeline is built on this call set, and its <code>AF_*_unrel</code> fields are frequencies computed in the 2,504 unrelated samples.</p>' },

    /* ------------------------------------------------------------ chromatin */
    { id: 'epigenome', cat: 'chromatin', term: 'Reference epigenome',
      short: 'Genome-wide maps of chromatin marks for one cell type or tissue (E001–E129).',
      body: '<p>A set of genome-wide maps (histone modifications, DNA accessibility, and often DNA methylation and RNA) for one cell type or tissue. The Roadmap Epigenomics Consortium (2015) released 111 reference epigenomes, combined with 16 ENCODE cell lines into 127 epigenomes numbered <b>E001–E129</b> (E060 and E064 are unused). Each has an <b>EID</b>, a <b>group</b> (e.g. "Blood &amp; T-cell"), a <b>mnemonic</b> whose first part is the <a data-term="tissue-code">tissue code</a>, and a description.</p>' },
    { id: 'tissue-code', cat: 'chromatin', term: 'Tissue codes (BLD, GI, BRN…)',
      short: 'Abbreviations that group epigenomes by tissue; table cells count distinct tissues.',
      body: '<p>The first part of each epigenome mnemonic names its tissue of origin, and the results table summarizes long lists of epigenomes as counts of distinct tissues ("7 tissues"; a single tissue is written "1 organ", as in v4). The full table of codes is in the reference section below.</p>' },
    { id: 'chromhmm', cat: 'chromatin', term: 'ChromHMM chromatin state',
      short: 'Genome segmentation into recurring combinations of histone marks (promoter, enhancer, transcribed…).',
      body: '<p>ChromHMM (Ernst &amp; Kellis, 2012) is a multivariate hidden Markov model that learns recurring combinations of histone marks and assigns every 200 bp segment of each epigenome to one <i>chromatin state</i>. States are named for the biology they correlate with: active promoters, enhancers, transcribed regions, Polycomb repression, heterochromatin or quiescent DNA. Because the same model is applied to every epigenome, a variant\'s state can be compared across all 127 cell types — that is the core of HaploReg.</p>' },
    { id: 'core15', cat: 'chromatin', term: 'Core 15-state model',
      short: 'ChromHMM model learned from 5 core marks (H3K4me3, H3K4me1, H3K36me3, H3K27me3, H3K9me3).',
      body: '<p>The Roadmap primary model, learned from five marks profiled in all 127 epigenomes: H3K4me3, H3K4me1, H3K36me3, H3K27me3 and H3K9me3. HaploReg counts states <b>1_TssA</b> and <b>2_TssAFlnk</b> as promoter and <b>6_EnhG</b> and <b>7_Enh</b> as enhancer. The full state table with colors is in the reference section below.</p>' },
    { id: 'imputed25', cat: 'chromatin', term: '25-state model (12 imputed marks)',
      short: 'Finer ChromHMM model using 12 marks imputed with ChromImpute in every epigenome.',
      body: '<p>Many marks were not measured in every epigenome. ChromImpute (Ernst &amp; Kellis, 2015) imputed 12 tracks — H3K4me1, H3K4me2, H3K4me3, H3K9ac, H3K9me3, H3K27ac, H3K27me3, H3K36me3, H3K79me2, H4K20me1, H2A.Z and DNase — for all 127 epigenomes, and a 25-state model was learned on them. It separates promoter and enhancer sub-types more finely. HaploReg counts states 1–4 and 22 as promoter and 9–18 as enhancer.</p>' },
    { id: 'histone-marks', cat: 'chromatin', term: 'Histone marks',
      short: 'Chemical modifications of histone tails that indicate promoter, enhancer, transcription or repression.',
      body: '<p>Chemical modifications of the histone proteins that package DNA, mapped by ChIP-seq. The name gives the histone, the residue and the modification (H3K4me1 = histone H3, lysine 4, mono-methylation).</p><ul><li><b>H3K4me3</b> — active and poised promoters (TSS).</li><li><b>H3K4me1</b> — enhancers (primed or active), promoter flanks.</li><li><b>H3K27ac</b> — <i>active</i> enhancers and promoters.</li><li><b>H3K9ac</b> — active promoters.</li><li><b>H3K36me3</b> — bodies of transcribed genes.</li><li><b>H3K27me3</b> — Polycomb repression; with H3K4me3 marks bivalent promoters.</li><li><b>H3K9me3</b> — constitutive heterochromatin, ZNF gene clusters and repeats.</li></ul>' },
    { id: 'promoter-marks', cat: 'chromatin', term: 'Promoter histone marks (column)',
      short: 'Epigenomes in which the variant lies in a promoter-like state or peak. Red cells.',
      body: '<p>Lists the epigenomes in which the variant falls in a promoter-associated element, according to the selected <a data-term="epi-source">source for epigenomes</a>:</p><ul><li>Core 15-state: 1_TssA or 2_TssAFlnk.</li><li>25-state: 1_TssA, 2_PromU, 3_PromD1, 4_PromD2 or 22_PromP.</li><li>H3K4me1/H3K4me3 peaks: an H3K4me3 peak.</li><li>H3K27ac/H3K9ac peaks: an H3K9ac peak.</li></ul><p>Short lists show <a data-term="tissue-code">tissue codes</a>; longer ones show a count. Hover to see every epigenome. With the live Ensembl source this column shows Ensembl <a data-term="regbuild">Regulatory Build</a> promoter features instead.</p>' },
    { id: 'enhancer-marks', cat: 'chromatin', term: 'Enhancer histone marks (column)',
      short: 'Epigenomes in which the variant lies in an enhancer-like state or peak. Orange cells.',
      body: '<p>Lists the epigenomes in which the variant falls in an enhancer-associated element:</p><ul><li>Core 15-state: 6_EnhG (genic enhancer) or 7_Enh.</li><li>25-state: states 9–18 (TxReg through EnhAc).</li><li>H3K4me1/H3K4me3 peaks: an H3K4me1 peak.</li><li>H3K27ac/H3K9ac peaks: an H3K27ac peak.</li></ul><p>Enhancer activity is highly cell-type specific, so this column is often the best clue to the tissue in which a non-coding variant acts.</p>' },
    { id: 'dnase', cat: 'chromatin', term: 'DNase (DNase I hypersensitivity)',
      short: 'Open, accessible chromatin where regulatory proteins can bind. Grey cells.',
      body: '<p>Regions where chromatin is open enough to be cut by the enzyme DNase I, measured by DNase-seq. Hypersensitive sites mark promoters, enhancers, insulators and other places where transcription factors are bound. The column lists epigenomes with a DNase peak over the variant (with the live source: Regulatory Build "open chromatin" features).</p>' },
    { id: 'missing-data', cat: 'chromatin', term: 'Black = missing data',
      short: 'In the detail table, a black cell means the mark was not profiled in that epigenome.',
      body: '<p>Not every histone mark (and not DNase) was profiled in every epigenome. On the detail page a black cell means "no data", which is different from an empty cell ("measured, no peak").</p>' },
    { id: 'regbuild', cat: 'chromatin', term: 'Ensembl Regulatory Build',
      short: 'Ensembl\'s genome-wide map of promoters, enhancers, CTCF sites, TF sites and open chromatin.',
      body: '<p>A single genome-wide annotation of regulatory regions that Ensembl derives from ENCODE, Roadmap and Blueprint data (Zerbino et al., 2015). Feature types are promoter, promoter flanking region, enhancer, CTCF binding site, TF binding site and open chromatin region. It is not resolved per epigenome, so the live source uses it as a stand-in until the v5 pipeline supplies per-epigenome chromatin states.</p>' },

    /* ------------------------------------------------------------ binding & motifs */
    { id: 'proteins', cat: 'binding', term: 'Proteins bound',
      short: 'Transcription factors or chromatin proteins with a ChIP-seq peak over the variant. Green cells.',
      body: '<p>Proteins (mostly transcription factors, plus factors such as POL2, CTCF and cohesin) whose ChIP-seq peaks in ENCODE cell lines overlap the variant. A bound protein is direct evidence that the site is used by the regulatory machinery in that cell type. With the live source, CTCF and generic TF binding sites come from the <a data-term="regbuild">Regulatory Build</a>.</p>' },
    { id: 'ctcf', cat: 'binding', term: 'CTCF',
      short: 'Insulator protein that anchors chromatin loops and topological domain boundaries.',
      body: '<p>A zinc-finger protein that, with cohesin, anchors chromatin loops and the boundaries of topologically associating domains. Variants in CTCF sites can rewire which enhancers contact which genes.</p>' },
    { id: 'motif', cat: 'binding', term: 'Regulatory motif',
      short: 'Short DNA sequence pattern recognized by a transcription factor, modelled as a PWM.',
      body: '<p>The short DNA pattern (typically 6–20 bp) that a transcription factor binds. Motifs are represented as <a data-term="pwm">position weight matrices</a>. A variant that changes a motif match may increase or decrease binding of that factor and so alter regulation.</p>' },
    { id: 'pwm', cat: 'binding', term: 'Position weight matrix (PWM)',
      short: 'Table of log-odds scores for each base at each position of a motif.',
      body: '<p>A matrix with one column per motif position and one row per base. Each entry is the log-odds of seeing that base at that position in true binding sites compared with background sequence. Summing the entries along a sequence gives its match score (<a data-term="lod">LOD</a>). Motif names in v4/v5 follow the Kheradpour &amp; Kellis (2014) library — derived from TRANSFAC, JASPAR, protein-binding microarrays and ENCODE ChIP-seq — where suffixes such as <code>_known3</code> or <code>_disc1</code> mark known and newly discovered variants of a motif.</p>' },
    { id: 'lod', cat: 'binding', term: 'LOD score (Ref / Alt / ΔLOD)',
      short: 'Log-odds that a sequence matches the motif rather than background. Δ = Alt − Ref.',
      body: '<p>The match score of a sequence to a <a data-term="pwm">PWM</a>: the log-odds that it was produced by the motif rather than by background sequence. Higher is a better match. The detail page reports the score of the best match with the reference allele (<b>Ref</b>) and with the alternate allele (<b>Alt</b>); <b>ΔLOD = Alt − Ref</b>. A large negative Δ suggests the alternate allele disrupts the site, a large positive Δ that it creates one.</p>' },
    { id: 'motifs-changed', cat: 'binding', term: 'Motifs changed (column)',
      short: 'Motifs whose match score differs between the Ref and Alt allele. Pink cells.',
      body: '<p>Motifs for which the variant changes the match score, i.e. one allele matches the PWM and the other matches noticeably worse or better. The v5 pipeline scans all PWMs against both alleles with <a data-term="moods">MOODS</a>. With the live source the column lists transcription factors whose Ensembl (JASPAR) motif features overlap the variant, and the detail page shows the VEP motif score change.</p><p>Motif evidence is suggestive: many motif hits are not bound in a given cell type, so combine it with chromatin and binding evidence.</p>' },
    { id: 'moods', cat: 'binding', term: 'MOODS',
      short: 'Motif Occurrence Detection Suite — fast PWM scanning used by the v5 pipeline.',
      body: '<p>MOODS (Korhonen et al., 2009) is a fast algorithm for finding PWM matches above a score threshold. The v5 pipeline uses it to scan every motif against the reference and alternate sequence around each variant.</p>' },
    { id: 'strand', cat: 'binding', term: 'Strand (+ / −)',
      short: 'Whether the motif match is on the forward (+) or reverse-complement (−) strand.',
      body: '<p>DNA is double-stranded and a factor can bind either orientation. <b>+</b> means the motif matches the forward (reference) strand as written; <b>−</b> means it matches the reverse complement.</p>' },
    { id: 'iupac', cat: 'binding', term: 'IUPAC nucleotide codes',
      short: 'Letters for ambiguous bases in motif consensus strings, e.g. R = A/G, N = any base.',
      body: '<p>Motif consensus sequences on the detail page use IUPAC codes: <b>R</b> = A/G, <b>Y</b> = C/T, <b>K</b> = G/T, <b>M</b> = A/C, <b>S</b> = C/G, <b>W</b> = A/T, <b>B</b> = not A, <b>D</b> = not C, <b>H</b> = not G, <b>V</b> = not T, <b>N</b> = any base.</p>' },

    /* ------------------------------------------------------------ conservation */
    { id: 'gerp', cat: 'cons', term: 'GERP (GERP++ RS score)',
      short: 'Evolutionary constraint score; RS ≥ 2 is treated as conserved ("Yes").',
      body: '<p>Genomic Evolutionary Rate Profiling (Davydov et al., 2010) compares the number of substitutions expected at a position under neutral evolution with the number observed across a multi-species alignment. The difference is the "rejected substitutions" (RS) score: positive values mean fewer changes than expected, i.e. purifying selection. HaploReg marks a variant as conserved ("Yes") when RS ≥ 2. The live source uses Ensembl\'s GERP scores from its mammalian alignment; hover the cell for the score.</p>' },
    { id: 'siphy', cat: 'cons', term: 'SiPhy-omega',
      short: 'Constrained elements detected across 29 mammals; "Yes" if the variant lies in one.',
      body: '<p>SiPhy (Garber et al., 2009) detects evolutionarily constrained elements from substitution patterns. HaploReg v4 used SiPhy-omega elements from the 29-mammal alignment (Lindblad-Toh et al., 2011); "Yes" means the variant lies inside such an element. Not available from the live Ensembl source.</p>' },
    { id: 'cons-option', cat: 'cons', term: 'Mammalian conservation algorithm (option)',
      short: 'Choose which constraint column(s) to show: GERP, SiPhy-omega or both.',
      body: '<p>Selects the conservation column(s) in the results table. Conservation suggests function but many regulatory elements, especially lineage-specific enhancers, are not deeply conserved.</p>' },

    /* ------------------------------------------------------------ associations */
    { id: 'gwas', cat: 'assoc', term: 'NHGRI-EBI GWAS hits',
      short: 'Associations of this exact variant with a trait in the NHGRI-EBI GWAS Catalog. Yellow cells.',
      body: '<p>A genome-wide association study (GWAS) tests millions of variants for association with a trait. The NHGRI-EBI GWAS Catalog curates reported associations with p &lt; 1×10⁻⁵. The column counts catalog entries for this variant itself (not its LD partners); hover for PubMed ID, trait and p-value. Genome-wide significance is conventionally p &lt; 5×10⁻⁸.</p><p>An association means the variant <i>tags</i> a causal signal; the causal variant may be any of its LD partners.</p>' },
    { id: 'grasp', cat: 'assoc', term: 'GRASP QTL hits',
      short: 'Associations from GRASP, a repository of full GWAS results including molecular QTLs.',
      body: '<p>GRASP (Genome-Wide Repository of Associations between SNPs and Phenotypes; Leslie et al., 2014) collected association results down to p ≤ 0.05 from published GWAS, including expression and methylation QTL studies. HaploReg lists the QTL-type hits. Shown when provided by the data source; not available from the live Ensembl source.</p>' },
    { id: 'eqtl', cat: 'assoc', term: 'eQTL (expression QTL)',
      short: 'Variant associated with the expression level of a gene in a tissue (e.g. GTEx). Yellow cells.',
      body: '<p>An expression quantitative trait locus is a variant whose genotype is associated with how much of a gene\'s RNA is made in a given tissue. The Genotype-Tissue Expression (GTEx) project maps eQTLs across dozens of human tissues. An eQTL links a non-coding variant to a candidate target gene, which may not be the nearest gene. Hover for source, tissue, gene and p-value.</p>' },
    { id: 'pvalue', cat: 'assoc', term: 'p-value',
      short: 'Probability of an association this strong by chance if there were no true effect. Smaller = stronger.',
      body: '<p>Written in scientific notation, e.g. <code>2E-34</code> = 2×10⁻³⁴. Smaller values mean stronger statistical evidence. Because GWAS test about a million independent variants, the usual genome-wide threshold is 5×10⁻⁸.</p>' },

    /* ------------------------------------------------------------ genes */
    { id: 'gencode', cat: 'genes', term: 'GENCODE genes',
      short: 'Gene containing the variant, or the nearest gene with distance and direction (e.g. 2.6kb 5\' of SORT1).',
      body: '<p>GENCODE is the reference gene annotation used by Ensembl. The column shows the gene that contains the variant, or for intergenic variants the closest gene written as <code>distance direction of GENE</code>, e.g. <code>2.6kb 5\' of SORT1</code>. Protein-coding genes are preferred when several are equally close. The nearest gene is a useful starting point but often not the gene a regulatory variant controls — check <a data-term="eqtl">eQTLs</a>.</p>' },
    { id: 'refseq', cat: 'genes', term: 'RefSeq genes',
      short: 'Same as GENCODE genes but using NCBI RefSeq annotation.',
      body: '<p>NCBI\'s Reference Sequence collection of curated transcripts. Shown when the data source provides RefSeq annotation (not the live Ensembl source).</p>' },
    { id: 'direction', cat: 'genes', term: "5' / 3' direction",
      short: "5' = on the promoter side of the gene (upstream); 3' = past the end of the gene (downstream).",
      body: '<p>Directions are relative to the gene\'s own orientation, not the chromosome. <b>5\'</b> means upstream, on the side of the transcription start site; <b>3\'</b> means downstream, beyond the end of the gene.</p>' },
    { id: 'func', cat: 'genes', term: 'dbSNP functional annotation',
      short: 'Effect on a transcript: intronic, missense, synonymous, UTR, splice… Violet = protein-changing.',
      body: '<p>The most severe effect of the variant on any overlapping transcript (live source: Ensembl VEP Sequence Ontology terms, mapped to the v4 vocabulary):</p><ul><li><b>intronic</b> — inside an intron.</li><li><b>missense</b> — changes an amino acid. <span class="glossary-swatch" style="background:Violet"></span> violet cell.</li><li><b>nonsense</b> — creates a stop codon; <b>stop-loss</b>/<b>start-loss</b> remove one; <b>protein altering</b> — another change to the protein sequence. All violet.</li><li><b>stop retained</b>/<b>start retained</b> — the codon changes but stays a stop/start, so the protein is unchanged (thistle, like synonymous).</li><li><b>frameshift</b>, <b>cds-indel</b> — indels in coding sequence.</li><li><b>synonymous</b> — coding but amino acid unchanged. <span class="glossary-swatch" style="background:Thistle"></span> thistle cell.</li><li><b>5\'-UTR</b>, <b>3\'-UTR</b> — untranslated parts of the mRNA.</li><li><b>splice-5</b>, <b>splice-3</b> — splice donor / acceptor site; <b>splice-region</b> — near a splice site.</li><li><b>ncRNA</b> — exon of a non-coding transcript.</li></ul><p>Blank means intergenic or upstream/downstream of genes.</p>' },
    { id: 'vep', cat: 'genes', term: 'VEP (Variant Effect Predictor)',
      short: 'Ensembl tool that predicts a variant\'s consequences on genes, regulatory features and motifs.',
      body: '<p>Ensembl\'s Variant Effect Predictor (McLaren et al., 2016) annotates each variant with Sequence Ontology consequence terms for every overlapping transcript, regulatory feature and motif feature, plus conservation. The live source uses it for functional annotation, GERP and motif score changes.</p>' },

    /* ------------------------------------------------------------ options & sources */
    { id: 'epi-source', cat: 'options', term: 'Source for epigenomes (option)',
      short: 'Which chromatin evidence fills the promoter/enhancer columns: 15-state, 25-state, or histone peaks.',
      body: '<p>Chooses the evidence behind the <a data-term="promoter-marks">promoter</a> and <a data-term="enhancer-marks">enhancer</a> columns: the <a data-term="core15">core 15-state</a> ChromHMM model (default), the <a data-term="imputed25">25-state imputed</a> model, H3K4me1/H3K4me3 peaks, or H3K27ac/H3K9ac peaks. Acetylation (H3K27ac) distinguishes active from poised enhancers; the 25-state model gives the finest resolution.</p>' },
    { id: 'trunc', cat: 'options', term: 'Condense lists longer than (option)',
      short: 'Lists longer than this are replaced by a count, e.g. "7 tissues"; hover for the full list.',
      body: '<p>Table cells listing tissues, proteins or motifs show the items themselves when there are at most this many, and a count otherwise. Choose <i>never condense</i> to always see the full lists, or 0 to always see counts. The full list is always in the cell\'s tooltip and on the detail page.</p>' },
    { id: 'oligo', cat: 'options', term: 'Condense indel oligos longer than (option)',
      short: 'Alleles longer than this many bases are shown as "N-mer" to keep the table narrow.',
      body: '<p>Long indel alleles are abbreviated as their length, e.g. <code>9-mer</code>. Hover the cell for the sequence.</p>' },
    { id: 'output', cat: 'options', term: 'Output mode (HTML / Text)',
      short: 'HTML shows the interactive table; Text returns tab-separated values for analysis.',
      body: '<p><b>HTML</b> shows the interactive results tables. <b>Text</b> returns one tab-separated row per variant with the full, uncondensed annotations (column list in the reference section), suitable for R, Python or a spreadsheet.</p>' },
    { id: 'data-source', cat: 'options', term: 'Data source',
      short: 'Where annotations come from: live Ensembl REST, offline synthetic demo, or the v5 pipeline backend.',
      body: '<ul><li><b>Live — Ensembl REST</b> (default): real GRCh38 positions, 1000 Genomes Phase 3 frequencies and LD, GWAS Catalog associations, VEP consequences and GERP, Regulatory Build features and JASPAR motif hits, fetched from rest.ensembl.org in your browser. Per-epigenome chromatin states, SiPhy, GRASP, eQTLs and RefSeq are not available from Ensembl and stay blank.</li><li><b>Demo — synthetic</b>: deterministic, made-up annotations that exercise every column offline. Positions, partners (rs9… IDs), genes (DMG…), traits and scores are simulated. Never interpret them.</li><li><b>HaploReg v5 pipeline</b> (planned): the 1000 Genomes high-coverage VCF annotated with ChromHMM states and MOODS motifs; see the README for the adapter interface.</li></ul>' },

    /* ------------------------------------------------------------ map & reasoning */
    { id: 'evidence-map', cat: 'map', term: 'Evidence map',
      short: 'Variants placed by how similar their evidence is. Nearby points share regulatory context.',
      body: '<p>A Mantis-style map of one locus. Each variant is described by an evidence profile: for every tissue, the share of its epigenomes where the variant sits in promoter or enhancer chromatin, plus open chromatin, protein binding, motif change, conservation, eQTL and GWAS. With the live source the tissue part is replaced by Ensembl Regulatory Build element types. Profiles are standardized and projected onto their first two principal components (PCA), computed in your browser; the caption gives the share of variance each axis explains.</p><p>Distance on the map means difference in evidence, not distance along the chromosome. LD is used separately, in the <a data-term="reasoning-trace">reasoning trace</a>.</p>' },
    { id: 'landmark', cat: 'map', term: 'Landmark',
      short: 'A tissue or evidence type drawn where it pulls variants. Points near it carry more of that evidence.',
      body: '<p>Landmarks are the evidence features themselves, placed at their PCA loadings (a biplot), as Mantis places anchors in a space. A variant lying toward the <code>PANC</code> landmark has promoter or enhancer chromatin in pancreatic epigenomes; one toward <code>Motif</code> changes a regulatory motif. Only the ten most influential features are drawn. In the trace, the landmarks a step relies on light up.</p>' },
    { id: 'bag', cat: 'map', term: 'Bag',
      short: 'A saved selection of variants, drawn as a dashed outline around them.',
      body: '<p>As in Mantis, a bag is a named working collection. The trace uses bags to show which candidates survive each step: first the haplotype (all variants in LD with the lead), then the regulatory candidates.</p>' },
    { id: 'journey', cat: 'map', term: 'Journey',
      short: 'An ordered path through waypoint variants that tells the story of the evidence.',
      body: '<p>Borrowed from Mantis journeys: a sequence of stops through the space. Here it starts at the lead variant and visits the highest-scoring candidates in rising order of support, ending at the best-supported one. A cursor travels the path so you can follow it.</p>' },
    { id: 'reasoning-trace', cat: 'map', term: 'Reasoning trace',
      short: 'A replayable, logged walk from the lead variant to the best-supported candidate, drawn on the map.',
      body: '<p>Seven steps, each with the operation it performed, shown like a tool call, and its result:</p><ol><li><b>Frame the question</b>: which variant, which tissue, which mechanism.</li><li><b>Retrieve the haplotype</b>: all variants with r² at or above the threshold, drawn as spokes from the lead.</li><li><b>Keep regulatory candidates</b>: those with promoter, enhancer, open-chromatin, binding or coding evidence, gathered into a <a data-term="bag">bag</a>.</li><li><b>Locate tissue context</b>: the tissues (or element types) the bag leans toward, linked to their <a data-term="landmark">landmarks</a>.</li><li><b>Fuse evidence</b>: each candidate gets an <a data-term="evidence-score">evidence score</a>; point size follows it.</li><li><b>Walk the evidence</b>: a <a data-term="journey">journey</a> through the leading candidates, with a one-paragraph summary.</li><li><b>Verify</b>: explicit checks on the top candidate (LD, regulatory context, mechanism, target gene, margin over the runner-up, data source).</li></ol><p>The trace is rule-based and fully transparent. It organizes the evidence; it does not prove causality, which needs statistical fine-mapping, colocalization and experiments.</p>' },
    { id: 'evidence-score', cat: 'map', term: 'Evidence score',
      short: 'r² with the lead × weighted evidence (regulatory 30%, open chromatin, binding, motif, eQTL 15% each, conservation 10%).',
      body: '<p>A 0–1 heuristic used to rank candidates in the trace: <code>score = r² × (0.30·regulatory + 0.15·open chromatin + 0.15·binding + 0.15·motif + 0.15·eQTL + 0.10·conservation)</code>. Regulatory breadth counts tissues with promoter or enhancer chromatin (saturating at three); motif strength uses the largest LOD change; a protein-changing coding variant scores at least 0.9 on evidence. The weights are a reasonable default, not fitted to data, and the score is not a posterior probability.</p>' },
    { id: 'mantis-export', cat: 'map', term: 'Export to Mantis',
      short: 'Download the locus as a CSV (title, semantic_text, metadata) that Mantis can turn into a space.',
      body: '<p>One row per variant, in the corpus shape Mantis spaces ingest: a <code>title</code> (the rsID), a <code>semantic_text</code> paragraph summarizing its evidence for embedding, and metadata columns (position, alleles, r² with the lead, evidence score and rank, tissues, motifs, proteins, GWAS traits, eQTL genes, consequence, gene, map coordinates, data source), plus <code>haploreg_url</code>: a link back to that variant on HaploReg (the locus in Explore with its record open). Create a Mantis space from the file to explore the locus with Mantis’ own maps, bags and agents; Mantis shows the link on each point, so any variant you find there opens straight back in HaploReg.</p>' },
    { id: 'mantis-evidence-export', cat: 'map', term: 'Export evidence',
      short: 'Download one row per piece of evidence (each GWAS association, regulatory overlap, motif, binding site, eQTL) for a dense Mantis map.',
      body: '<p>A finer-grained Mantis export. Besides one summary row per variant, every individual piece of evidence becomes its own row: each GWAS Catalog association (trait, p-value, PMID, risk allele), each Regulatory Build overlap, each motif change, bound protein and eQTL. A locus of ~100 variants becomes ~1,000 points that Mantis clusters by what the evidence says, ready for lasso, paths, landmarks and semantic rulers. Every row keeps its <code>variant</code>, a numeric <code>neg_log10_p</code> for colouring, and <code>haploreg_url</code> back to the variant here.</p>' }
  ];

  HR.GLOSSARY_BY_ID = {};
  HR.GLOSSARY.forEach(function (g) { HR.GLOSSARY_BY_ID[g.id] = g; });

  // Results-table column -> glossary entry.
  HR.COLUMN_HELP = {
    chr: 'pos', pos: 'pos', r2: 'r2', dprime: 'dprime', variant: 'rsid', ref: 'ref-alt', alt: 'ref-alt',
    AFR: 'superpopulation', AMR: 'superpopulation', EAS: 'superpopulation', EUR: 'superpopulation', SAS: 'superpopulation',
    freq: 'af', gerp: 'gerp', siphy: 'siphy', promoter: 'promoter-marks', enhancer: 'enhancer-marks', dnase: 'dnase',
    proteins: 'proteins', motifs: 'motifs-changed', gwas: 'gwas', grasp: 'grasp', eqtl: 'eqtl',
    gencode: 'gencode', refseq: 'refseq', func: 'func'
  };

  HR.TISSUE_NAMES = {
    ESC: 'Embryonic stem cells', ESDR: 'ES cell-derived cells', IPSC: 'Induced pluripotent stem cells',
    LNG: 'Lung', FAT: 'Adipose', STRM: 'Stromal / mesenchymal', BRST: 'Breast', BLD: 'Blood & immune cells',
    MUS: 'Muscle', BRN: 'Brain & neural', SKIN: 'Skin', VAS: 'Vascular', LIV: 'Liver', GI: 'Gastrointestinal',
    ADRL: 'Adrenal', HRT: 'Heart', KID: 'Kidney', PANC: 'Pancreas', PLCNT: 'Placenta', THYM: 'Thymus',
    OVRY: 'Ovary', SPLN: 'Spleen', CRVX: 'Cervix', BONE: 'Bone'
  };

  HR.STATE_MARKS15 = {
    '1_TssA': 'H3K4me3 (strong)', '2_TssAFlnk': 'H3K4me3 + H3K4me1', '3_TxFlnk': 'H3K4me1 + H3K36me3',
    '4_Tx': 'H3K36me3 (strong)', '5_TxWk': 'H3K36me3 (weak)', '6_EnhG': 'H3K4me1 + H3K36me3',
    '7_Enh': 'H3K4me1', '8_ZNF/Rpts': 'H3K36me3 + H3K9me3', '9_Het': 'H3K9me3', '10_TssBiv': 'H3K4me3 + H3K27me3',
    '11_BivFlnk': 'H3K4me1 + H3K4me3 + H3K27me3', '12_EnhBiv': 'H3K4me1 + H3K27me3', '13_ReprPC': 'H3K27me3 (strong)',
    '14_ReprPCWk': 'H3K27me3 (weak)', '15_Quies': 'none'
  };

  HR.TEXT_COLUMN_DOCS = {
    chr: 'Chromosome', pos_hg38: 'GRCh38 position', r2: 'LD r² with the query SNP', "D'": "LD D' with the query SNP",
    is_query_snp: '1 if this row is a query SNP', rsID: 'dbSNP ID', ref: 'Reference allele', alt: 'Alternate allele(s)',
    AFR: 'AFR alternate allele frequency', AMR: 'AMR frequency', EAS: 'EAS frequency', EUR: 'EUR frequency', SAS: 'SAS frequency',
    GERP_cons: '1 if GERP RS ≥ 2', SiPhy_cons: '1 if in a SiPhy-omega element',
    Chromatin_States: 'EID,state pairs (core 15-state promoter/enhancer states)', Chromatin_States_Imputed: 'Same for the 25-state model',
    Chromatin_Marks: 'EID,mark_Enh/Pro peaks', DNAse: 'EIDs with a DNase peak', Proteins: 'factor,cell pairs',
    eQTL: 'source,tissue,gene,p', gwas: 'PMID,trait,p', grasp: 'PMID,trait,p', Motifs: 'Altered motif names',
    Regulatory_Build: 'Ensembl Regulatory Build feature types', GENCODE_id: 'Gene ID', GENCODE_name: 'Gene symbol',
    GENCODE_direction: "within / 5' / 3'", GENCODE_distance: 'Distance to gene in bp (0 = within)',
    RefSeq_id: 'RefSeq transcript', RefSeq_name: 'RefSeq gene', RefSeq_direction: "within / 5' / 3'", RefSeq_distance: 'Distance in bp',
    dbSNP_functional_annotation: 'Functional class', query_snp_rsid: 'Query SNP this row belongs to'
  };

  HR.DOC_REFERENCES = [
    'Ward LD, Kellis M. HaploReg: a resource for exploring chromatin states, conservation, and regulatory motif alterations within sets of genetically linked variants. <i>Nucleic Acids Res</i> 2012. PMID 22064851.',
    'Ward LD, Kellis M. HaploReg v4: systematic mining of putative causal variants, cell types, regulators and target genes for human complex traits and disease. <i>Nucleic Acids Res</i> 2016. PMID 26657631.',
    'Roadmap Epigenomics Consortium. Integrative analysis of 111 reference human epigenomes. <i>Nature</i> 2015.',
    'Ernst J, Kellis M. ChromHMM: automating chromatin-state discovery and characterization. <i>Nat Methods</i> 2012.',
    'Kheradpour P, Kellis M. Systematic discovery and characterization of regulatory motifs in ENCODE TF binding experiments. <i>Nucleic Acids Res</i> 2014.',
    'Korhonen J et al. MOODS: fast search for position weight matrix matches in DNA sequences. <i>Bioinformatics</i> 2009.',
    'Byrska-Bishop M et al. High-coverage whole-genome sequencing of the expanded 1000 Genomes Project cohort including 602 trios. <i>Cell</i> 2022.',
    '1000 Genomes Project Consortium. A global reference for human genetic variation. <i>Nature</i> 2015.',
    'Davydov EV et al. Identifying a high fraction of the human genome to be under selective constraint using GERP++. <i>PLoS Comput Biol</i> 2010.',
    'Sollis E et al. The NHGRI-EBI GWAS Catalog. <i>Nucleic Acids Res</i> 2023.',
    'GTEx Consortium. The GTEx Consortium atlas of genetic regulatory effects across human tissues. <i>Science</i> 2020.',
    'McLaren W et al. The Ensembl Variant Effect Predictor. <i>Genome Biol</i> 2016.'
  ];

  // Renders the static reference tables (states, tissues, text columns) into an element.
  HR.renderDocReference = function () {
    var esc = HR.util.escape;
    function stateRows(list, marks) {
      return list.map(function (s) {
        return '<tr><td><span class="state-swatch" style="background:' + s.color + '"></span></td><td><code>' + esc(s.code) +
          '</code></td><td>' + esc(s.name) + '</td>' + (marks ? '<td>' + esc(marks[s.code] || '') + '</td>' : '') + '</tr>';
      }).join('');
    }
    var counts = {};
    HR.EPIGENOMES.forEach(function (e) { counts[e.tissue] = (counts[e.tissue] || 0) + 1; });
    return {
      states15: '<table class="doc-table"><tr><th></th><th>State</th><th>Description</th><th>Defining marks</th></tr>' + stateRows(HR.STATES15, HR.STATE_MARKS15) + '</table>',
      states25: '<table class="doc-table"><tr><th></th><th>State</th><th>Description</th></tr>' + stateRows(HR.STATES25) + '</table>',
      tissues: '<table class="doc-table"><tr><th>Code</th><th>Tissue</th><th>Epigenomes</th></tr>' + Object.keys(counts).map(function (t) {
        return '<tr><td><code>' + esc(t) + '</code></td><td>' + esc(HR.TISSUE_NAMES[t] || t) + '</td><td>' + counts[t] + '</td></tr>';
      }).join('') + '</table>',
      epigenomes: '<table class="doc-table"><tr><th>EID</th><th>Group</th><th>Mnemonic</th><th>Description</th></tr>' + HR.EPIGENOMES.map(function (e) {
        return '<tr><td>' + e.eid + '</td><td>' + esc(e.group) + '</td><td><code>' + esc(e.mnemonic) + '</code></td><td>' + esc(e.desc) + '</td></tr>';
      }).join('') + '</table>',
      textColumns: '<table class="doc-table"><tr><th>Column</th><th>Contents</th></tr>' + HR.TEXT_COLUMNS.map(function (c) {
        return '<tr><td><code>' + esc(c) + '</code></td><td>' + esc(HR.TEXT_COLUMN_DOCS[c] || '') + '</td></tr>';
      }).join('') + '</table>'
    };
  };
})(window.HR = window.HR || {});
