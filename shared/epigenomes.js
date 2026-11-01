/* HaploReg v5 — epigenome reference data shared by the Classic and Explore interfaces.
 * Roadmap Epigenomics reference epigenomes (E001–E129) and the ChromHMM state models. */
(function (HR) {
  'use strict';

  // [EID, group, mnemonic, description]
  var RAW = [
    ['E001', 'ESC', 'ESC.I3', 'ES-I3 Cells'],
    ['E002', 'ESC', 'ESC.WA7', 'ES-WA7 Cells'],
    ['E003', 'ESC', 'ESC.H1', 'H1 Cells'],
    ['E004', 'ES-deriv', 'ESDR.H1.BMP4.MESO', 'H1 BMP4 Derived Mesendoderm Cultured Cells'],
    ['E005', 'ES-deriv', 'ESDR.H1.BMP4.TROP', 'H1 BMP4 Derived Trophoblast Cultured Cells'],
    ['E006', 'ES-deriv', 'ESDR.H1.MSC', 'H1 Derived Mesenchymal Stem Cells'],
    ['E007', 'ES-deriv', 'ESDR.H1.NEUR.PROG', 'H1 Derived Neuronal Progenitor Cultured Cells'],
    ['E008', 'ESC', 'ESC.H9', 'H9 Cells'],
    ['E009', 'ES-deriv', 'ESDR.H9.NEUR.PROG', 'H9 Derived Neuronal Progenitor Cultured Cells'],
    ['E010', 'ES-deriv', 'ESDR.H9.NEUR', 'H9 Derived Neuron Cultured Cells'],
    ['E011', 'ES-deriv', 'ESDR.CD184.ENDO', 'hESC Derived CD184+ Endoderm Cultured Cells'],
    ['E012', 'ES-deriv', 'ESDR.CD56.ECTO', 'hESC Derived CD56+ Ectoderm Cultured Cells'],
    ['E013', 'ES-deriv', 'ESDR.CD56.MESO', 'hESC Derived CD56+ Mesoderm Cultured Cells'],
    ['E014', 'ESC', 'ESC.HUES48', 'HUES48 Cells'],
    ['E015', 'ESC', 'ESC.HUES6', 'HUES6 Cells'],
    ['E016', 'ESC', 'ESC.HUES64', 'HUES64 Cells'],
    ['E017', 'IMR90', 'LNG.IMR90', 'IMR90 fetal lung fibroblasts Cell Line'],
    ['E018', 'iPSC', 'IPSC.15b', 'iPS-15b Cells'],
    ['E019', 'iPSC', 'IPSC.18', 'iPS-18 Cells'],
    ['E020', 'iPSC', 'IPSC.20B', 'iPS-20b Cells'],
    ['E021', 'iPSC', 'IPSC.DF.6.9', 'iPS DF 6.9 Cells'],
    ['E022', 'iPSC', 'IPSC.DF.19.11', 'iPS DF 19.11 Cells'],
    ['E023', 'Mesench', 'FAT.MSC.DR.ADIP', 'Mesenchymal Stem Cell Derived Adipocyte Cultured Cells'],
    ['E024', 'ESC', 'ESC.4STAR', 'ES-UCSF4 Cells'],
    ['E025', 'Mesench', 'FAT.ADIP.DR.MSC', 'Adipose Derived Mesenchymal Stem Cell Cultured Cells'],
    ['E026', 'Mesench', 'STRM.MRW.MSC', 'Bone Marrow Derived Cultured Mesenchymal Stem Cells'],
    ['E027', 'Epithelial', 'BRST.MYO', 'Breast Myoepithelial Primary Cells'],
    ['E028', 'Epithelial', 'BRST.HMEC.35', 'Breast variant Human Mammary Epithelial Cells (vHMEC)'],
    ['E029', 'HSC & B-cell', 'BLD.CD14.PC', 'Primary monocytes from peripheral blood'],
    ['E030', 'HSC & B-cell', 'BLD.CD15.PC', 'Primary neutrophils from peripheral blood'],
    ['E031', 'HSC & B-cell', 'BLD.CD19.CPC', 'Primary B cells from cord blood'],
    ['E032', 'HSC & B-cell', 'BLD.CD19.PPC', 'Primary B cells from peripheral blood'],
    ['E033', 'Blood & T-cell', 'BLD.CD3.CPC', 'Primary T cells from cord blood'],
    ['E034', 'Blood & T-cell', 'BLD.CD3.PPC', 'Primary T cells from peripheral blood'],
    ['E035', 'HSC & B-cell', 'BLD.CD34.PC', 'Primary hematopoietic stem cells'],
    ['E036', 'HSC & B-cell', 'BLD.CD34.CC', 'Primary hematopoietic stem cells short term culture'],
    ['E037', 'Blood & T-cell', 'BLD.CD4.MPC', 'Primary T helper memory cells from peripheral blood 2'],
    ['E038', 'Blood & T-cell', 'BLD.CD4.NPC', 'Primary T helper naive cells from peripheral blood'],
    ['E039', 'Blood & T-cell', 'BLD.CD4.CD25M.CD45RA.NPC', 'Primary T helper naive cells from peripheral blood'],
    ['E040', 'Blood & T-cell', 'BLD.CD4.CD25M.CD45RO.MPC', 'Primary T helper memory cells from peripheral blood 1'],
    ['E041', 'Blood & T-cell', 'BLD.CD4.CD25M.IL17M.PL.TPC', 'Primary T helper cells PMA-I stimulated'],
    ['E042', 'Blood & T-cell', 'BLD.CD4.CD25M.IL17P.PL.TPC', 'Primary T helper 17 cells PMA-I stimulated'],
    ['E043', 'Blood & T-cell', 'BLD.CD4.CD25M.TPC', 'Primary T helper cells from peripheral blood'],
    ['E044', 'Blood & T-cell', 'BLD.CD4.CD25.CD127M.TREGPC', 'Primary T regulatory cells from peripheral blood'],
    ['E045', 'Blood & T-cell', 'BLD.CD4.CD25I.CD127.TMEMPC', 'Primary T cells effector/memory enriched from peripheral blood'],
    ['E046', 'HSC & B-cell', 'BLD.CD56.PC', 'Primary Natural Killer cells from peripheral blood'],
    ['E047', 'Blood & T-cell', 'BLD.CD8.NPC', 'Primary T CD8+ naive cells from peripheral blood'],
    ['E048', 'Blood & T-cell', 'BLD.CD8.MPC', 'Primary T CD8+ memory cells from peripheral blood'],
    ['E049', 'Mesench', 'STRM.CHON.MRW.DR.MSC', 'Mesenchymal Stem Cell Derived Chondrocyte Cultured Cells'],
    ['E050', 'HSC & B-cell', 'BLD.MOB.CD34.PC.F', 'Primary hematopoietic stem cells G-CSF-mobilized Female'],
    ['E051', 'HSC & B-cell', 'BLD.MOB.CD34.PC.M', 'Primary hematopoietic stem cells G-CSF-mobilized Male'],
    ['E052', 'Myosat', 'MUS.SAT', 'Muscle Satellite Cultured Cells'],
    ['E053', 'Neurosph', 'BRN.CRTX.DR.NRSPHR', 'Cortex derived primary cultured neurospheres'],
    ['E054', 'Neurosph', 'BRN.GANGEM.DR.NRSPHR', 'Ganglion Eminence derived primary cultured neurospheres'],
    ['E055', 'Epithelial', 'SKIN.PEN.FRSK.FIB.01', 'Foreskin Fibroblast Primary Cells skin01'],
    ['E056', 'Epithelial', 'SKIN.PEN.FRSK.FIB.02', 'Foreskin Fibroblast Primary Cells skin02'],
    ['E057', 'Epithelial', 'SKIN.PEN.FRSK.KER.02', 'Foreskin Keratinocyte Primary Cells skin02'],
    ['E058', 'Epithelial', 'SKIN.PEN.FRSK.KER.03', 'Foreskin Keratinocyte Primary Cells skin03'],
    ['E059', 'Epithelial', 'SKIN.PEN.FRSK.MEL.01', 'Foreskin Melanocyte Primary Cells skin01'],
    ['E061', 'Epithelial', 'SKIN.PEN.FRSK.MEL.03', 'Foreskin Melanocyte Primary Cells skin03'],
    ['E062', 'Blood & T-cell', 'BLD.PER.MONUC.PC', 'Primary mononuclear cells from peripheral blood'],
    ['E063', 'Adipose', 'FAT.ADIP.NUC', 'Adipose Nuclei'],
    ['E065', 'Heart', 'VAS.AOR', 'Aorta'],
    ['E066', 'Other', 'LIV.ADLT', 'Liver'],
    ['E067', 'Brain', 'BRN.ANG.GYR', 'Brain Angular Gyrus'],
    ['E068', 'Brain', 'BRN.ANT.CAUD', 'Brain Anterior Caudate'],
    ['E069', 'Brain', 'BRN.CING.GYR', 'Brain Cingulate Gyrus'],
    ['E070', 'Brain', 'BRN.GRM.MTRX', 'Brain Germinal Matrix'],
    ['E071', 'Brain', 'BRN.HIPP.MID', 'Brain Hippocampus Middle'],
    ['E072', 'Brain', 'BRN.INF.TMP', 'Brain Inferior Temporal Lobe'],
    ['E073', 'Brain', 'BRN.DL.PRFRNTL.CRTX', 'Brain Dorsolateral Prefrontal Cortex'],
    ['E074', 'Brain', 'BRN.SUB.NIG', 'Brain Substantia Nigra'],
    ['E075', 'Digestive', 'GI.CLN.MUC', 'Colonic Mucosa'],
    ['E076', 'Sm. Muscle', 'GI.CLN.SM.MUS', 'Colon Smooth Muscle'],
    ['E077', 'Digestive', 'GI.DUO.MUC', 'Duodenum Mucosa'],
    ['E078', 'Sm. Muscle', 'GI.DUO.SM.MUS', 'Duodenum Smooth Muscle'],
    ['E079', 'Digestive', 'GI.ESO', 'Esophagus'],
    ['E080', 'Other', 'ADRL.GLND.FET', 'Fetal Adrenal Gland'],
    ['E081', 'Brain', 'BRN.FET.M', 'Fetal Brain Male'],
    ['E082', 'Brain', 'BRN.FET.F', 'Fetal Brain Female'],
    ['E083', 'Heart', 'HRT.FET', 'Fetal Heart'],
    ['E084', 'Digestive', 'GI.L.INT.FET', 'Fetal Intestine Large'],
    ['E085', 'Digestive', 'GI.S.INT.FET', 'Fetal Intestine Small'],
    ['E086', 'Other', 'KID.FET', 'Fetal Kidney'],
    ['E087', 'Other', 'PANC.ISLT', 'Pancreatic Islets'],
    ['E088', 'Other', 'LNG.FET', 'Fetal Lung'],
    ['E089', 'Muscle', 'MUS.TRNK.FET', 'Fetal Muscle Trunk'],
    ['E090', 'Muscle', 'MUS.LEG.FET', 'Fetal Muscle Leg'],
    ['E091', 'Other', 'PLCNT.FET', 'Placenta'],
    ['E092', 'Digestive', 'GI.STMC.FET', 'Fetal Stomach'],
    ['E093', 'Thymus', 'THYM.FET', 'Fetal Thymus'],
    ['E094', 'Digestive', 'GI.STMC.GAST', 'Gastric'],
    ['E095', 'Heart', 'HRT.VENT.L', 'Left Ventricle'],
    ['E096', 'Other', 'LNG', 'Lung'],
    ['E097', 'Other', 'OVRY', 'Ovary'],
    ['E098', 'Other', 'PANC', 'Pancreas'],
    ['E099', 'Other', 'PLCNT.AMN', 'Placenta Amnion'],
    ['E100', 'Muscle', 'MUS.PSOAS', 'Psoas Muscle'],
    ['E101', 'Digestive', 'GI.RECT.MUC.29', 'Rectal Mucosa Donor 29'],
    ['E102', 'Digestive', 'GI.RECT.MUC.31', 'Rectal Mucosa Donor 31'],
    ['E103', 'Sm. Muscle', 'GI.RECT.SM.MUS', 'Rectal Smooth Muscle'],
    ['E104', 'Heart', 'HRT.ATR.R', 'Right Atrium'],
    ['E105', 'Heart', 'HRT.VNT.R', 'Right Ventricle'],
    ['E106', 'Digestive', 'GI.CLN.SIG', 'Sigmoid Colon'],
    ['E107', 'Muscle', 'MUS.SKLT.M', 'Skeletal Muscle Male'],
    ['E108', 'Muscle', 'MUS.SKLT.F', 'Skeletal Muscle Female'],
    ['E109', 'Digestive', 'GI.S.INT', 'Small Intestine'],
    ['E110', 'Digestive', 'GI.STMC.MUC', 'Stomach Mucosa'],
    ['E111', 'Sm. Muscle', 'GI.STMC.MUS', 'Stomach Smooth Muscle'],
    ['E112', 'Thymus', 'THYM', 'Thymus'],
    ['E113', 'Other', 'SPLN', 'Spleen'],
    ['E114', 'ENCODE2012', 'LNG.A549.ETOH002.CNCR', 'A549 EtOH 0.02pct Lung Carcinoma Cell Line'],
    ['E115', 'ENCODE2012', 'BLD.DND41.CNCR', 'Dnd41 TCell Leukemia Cell Line'],
    ['E116', 'ENCODE2012', 'BLD.GM12878', 'GM12878 Lymphoblastoid Cells'],
    ['E117', 'ENCODE2012', 'CRVX.HELAS3.CNCR', 'HeLa-S3 Cervical Carcinoma Cell Line'],
    ['E118', 'ENCODE2012', 'LIV.HEPG2.CNCR', 'HepG2 Hepatocellular Carcinoma Cell Line'],
    ['E119', 'ENCODE2012', 'BRST.HMEC', 'HMEC Mammary Epithelial Primary Cells'],
    ['E120', 'ENCODE2012', 'MUS.HSMM', 'HSMM Skeletal Muscle Myoblasts Cells'],
    ['E121', 'ENCODE2012', 'MUS.HSMMT', 'HSMM cell derived Skeletal Muscle Myotubes Cells'],
    ['E122', 'ENCODE2012', 'VAS.HUVEC', 'HUVEC Umbilical Vein Endothelial Primary Cells'],
    ['E123', 'ENCODE2012', 'BLD.K562.CNCR', 'K562 Leukemia Cells'],
    ['E124', 'ENCODE2012', 'BLD.CD14.MONO', 'Monocytes-CD14+ RO01746 Primary Cells'],
    ['E125', 'ENCODE2012', 'BRN.NHA', 'NH-A Astrocytes Primary Cells'],
    ['E126', 'ENCODE2012', 'SKIN.NHDFAD', 'NHDF-Ad Adult Dermal Fibroblast Primary Cells'],
    ['E127', 'ENCODE2012', 'SKIN.NHEK', 'NHEK-Epidermal Keratinocyte Primary Cells'],
    ['E128', 'ENCODE2012', 'LNG.NHLF', 'NHLF Lung Fibroblast Primary Cells'],
    ['E129', 'ENCODE2012', 'BONE.OSTEO', 'Osteoblast Primary Cells']
  ];

  HR.EPIGENOMES = RAW.map(function (r) {
    return { eid: r[0], group: r[1], mnemonic: r[2], desc: r[3], tissue: r[2].split('.')[0] };
  });
  HR.EPI_BY_ID = {};
  HR.EPIGENOMES.forEach(function (e) { HR.EPI_BY_ID[e.eid] = e; });

  // Roadmap group colours (used by Explore for the heatmap group legend).
  HR.GROUP_COLORS = {
    'ESC': '#924965', 'ES-deriv': '#4178AE', 'iPSC': '#69608A', 'IMR90': '#E41A1C',
    'Mesench': '#B65C73', 'Epithelial': '#FF9D0C', 'HSC & B-cell': '#678C69',
    'Blood & T-cell': '#55A354', 'Myosat': '#E67326', 'Neurosph': '#FFD924',
    'Adipose': '#AF5B39', 'Heart': '#D56F80', 'Brain': '#C5912B', 'Digestive': '#C58DAA',
    'Sm. Muscle': '#F182BC', 'Muscle': '#C2655D', 'Thymus': '#DAB92E', 'Other': '#999999',
    'ENCODE2012': '#000000'
  };

  // ChromHMM core 15-state model (5 core marks).
  HR.STATES15 = [
    { code: '1_TssA', name: 'Active TSS', color: '#FF0000' },
    { code: '2_TssAFlnk', name: 'Flanking Active TSS', color: '#FF4500' },
    { code: '3_TxFlnk', name: "Transcr. at gene 5' and 3'", color: '#32CD32' },
    { code: '4_Tx', name: 'Strong transcription', color: '#008000' },
    { code: '5_TxWk', name: 'Weak transcription', color: '#006400' },
    { code: '6_EnhG', name: 'Genic enhancers', color: '#C2E105' },
    { code: '7_Enh', name: 'Enhancers', color: '#FFFF00' },
    { code: '8_ZNF/Rpts', name: 'ZNF genes & repeats', color: '#66CDAA' },
    { code: '9_Het', name: 'Heterochromatin', color: '#8A91D0' },
    { code: '10_TssBiv', name: 'Bivalent/Poised TSS', color: '#CD5C5C' },
    { code: '11_BivFlnk', name: 'Flanking Bivalent TSS/Enh', color: '#E9967A' },
    { code: '12_EnhBiv', name: 'Bivalent Enhancer', color: '#BDB76B' },
    { code: '13_ReprPC', name: 'Repressed PolyComb', color: '#808080' },
    { code: '14_ReprPCWk', name: 'Weak Repressed PolyComb', color: '#C0C0C0' },
    { code: '15_Quies', name: 'Quiescent/Low', color: '#FFFFFF' }
  ];

  // ChromHMM 25-state model (12 imputed marks).
  HR.STATES25 = [
    { code: '1_TssA', name: 'Active TSS', color: '#FF0000' },
    { code: '2_PromU', name: 'Promoter Upstream TSS', color: '#FF4500' },
    { code: '3_PromD1', name: 'Promoter Downstream TSS 1', color: '#FF4500' },
    { code: '4_PromD2', name: 'Promoter Downstream TSS 2', color: '#FF4500' },
    { code: "5_Tx5'", name: "Transcribed - 5' preferential", color: '#008000' },
    { code: '6_Tx', name: 'Strong transcription', color: '#008000' },
    { code: "7_Tx3'", name: "Transcribed - 3' preferential", color: '#008000' },
    { code: '8_TxWk', name: 'Weak transcription', color: '#009600' },
    { code: '9_TxReg', name: 'Transcribed & regulatory', color: '#C2E105' },
    { code: "10_TxEnh5'", name: "Transcribed 5' preferential & enh", color: '#C2E105' },
    { code: "11_TxEnh3'", name: "Transcribed 3' preferential & enh", color: '#C2E105' },
    { code: '12_TxEnhW', name: 'Transcribed & weak enhancer', color: '#C2E105' },
    { code: '13_EnhA1', name: 'Active Enhancer 1', color: '#FFC34D' },
    { code: '14_EnhA2', name: 'Active Enhancer 2', color: '#FFC34D' },
    { code: '15_EnhAF', name: 'Active Enhancer Flank', color: '#FFC34D' },
    { code: '16_EnhW1', name: 'Weak Enhancer 1', color: '#FFFF00' },
    { code: '17_EnhW2', name: 'Weak Enhancer 2', color: '#FFFF00' },
    { code: '18_EnhAc', name: 'Primary H3K27ac possible Enhancer', color: '#FFFF00' },
    { code: '19_DNase', name: 'Primary DNase', color: '#FFFF66' },
    { code: '20_ZNF/Rpts', name: 'ZNF genes & repeats', color: '#66CDAA' },
    { code: '21_Het', name: 'Heterochromatin', color: '#8A91D0' },
    { code: '22_PromP', name: 'Poised Promoter', color: '#E6B8B7' },
    { code: '23_PromBiv', name: 'Bivalent Promoter', color: '#7030A0' },
    { code: '24_ReprPC', name: 'Polycomb repressed', color: '#808080' },
    { code: '25_Quies', name: 'Quiescent', color: '#FFFFFF' }
  ];

  // Which states count toward the "Promoter histone marks" / "Enhancer histone marks" columns.
  // Indexes are 1-based state numbers.
  HR.STATE_CLASSES = {
    vanilla: { promoter: [1, 2], enhancer: [6, 7] },
    imputed: { promoter: [1, 2, 3, 4, 22], enhancer: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18] }
  };

  HR.EPI_SOURCES = [
    { id: 'vanilla', label: 'ChromHMM (Core 15-state model)' },
    { id: 'imputed', label: 'ChromHMM (25-state model using 12 imputed marks)' },
    { id: 'methyl', label: 'H3K4me1/H3K4me3 peaks' },
    { id: 'acetyl', label: 'H3K27ac/H3K9ac peaks' }
  ];

  // Mark used for promoter/enhancer calls under the peak-based epigenome sources.
  HR.MARK_SOURCES = {
    methyl: { promoter: 'H3K4me3', enhancer: 'H3K4me1' },
    acetyl: { promoter: 'H3K9ac', enhancer: 'H3K27ac' }
  };

  HR.MARKS = ['H3K4me1', 'H3K4me3', 'H3K27ac', 'H3K9ac'];
  HR.MARK_KIND = { H3K4me1: 'Enh', H3K27ac: 'Enh', H3K4me3: 'Pro', H3K9ac: 'Pro' };
})(window.HR = window.HR || {});
