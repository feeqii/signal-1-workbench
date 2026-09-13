# Frozen KRAS abundance / DARPin K55 case

The case contains **27,813 distinct variants**, including **23,072 paired measurements**. It supports examining assay phenotypes and recording hypotheses. It does not infer binding energies by subtracting scores, establish mutation causality from structure displacement, or claim prospective biological usefulness.

## Reference and assay evidence

The 188-residue human KRAS 4B sequence is **UniProt P01116-2**, taxon 9606. Its SHA-256 is `9a0ed04ef46e15865a90f9dd0808d7d12c94746c66b0f41228aa2e62516ccbca`. Both ProteinGym assay references match the entire downloaded isoform sequence. The curator reconstructs **every full mutated sequence** from the substitution string and verifies exact equality with the source CSV. It rejects wrong reference residues, conflicting substitutions and duplicate aliases. The displayed UniProt canonical isoform P01116-1 is a different, 189-residue reference and must not replace this sequence.

| Frozen measurement file | Rows | Paired | Present only in this assay |
| --- | ---: | ---: | ---: |
| RASK_HUMAN_Weng_2022_abundance | 26,012 | 23,072 | 2,940 |
| RASK_HUMAN_Weng_2022_binding-DARPin_K55 | 24,873 | 23,072 | 1,801 |

The union contains 3,202 single substitutions; the remainder are combinations. No duplicate canonical variants occurred in either assay. Unmeasured counterparts are `null`, not zero. The direct JSON observation array preserves source numerical fitness scores without additional rescaling. Source CSV columns are `mutant`, `mutated_sequence`, `DMS_score`, and `DMS_score_bin`; the binary threshold columns are not used.

[ProteinGym v1.3](https://zenodo.org/records/15293562) supplies the frozen, curated measurements. These originate from [Weng et al., *The energetic and allosteric landscape for KRAS inhibition*, Nature 626, 643–652 (2024)](https://doi.org/10.1038/s41586-023-06954-0), published online 18 December 2023. They are dimensionless yeast-growth fitness estimates from AbundancePCA and BindingPCA, not concentrations, dissociation constants, or kcal/mol measurements. Higher scores indicate greater assay fitness; source directionality is +1. BindingPCA can change through abundance and interaction effects. The paper's thermodynamic inference used an experimental design and model beyond these two scalar phenotypes.

**DOI reconciliation:** ProteinGym retains `10.1101/2022.12.06.519122` for abundance and `10.1101/2022.12.06.519127` for K55. The [original authors' repository](https://github.com/lehner-lab/krasddpcams) links the `.519122` preprint; the [published paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC10866706/) establishes `10.1038/s41586-023-06954-0` as the publication citation. The inconsistent `.519127` remains preserved in source metadata and is not presented as a verified study DOI.

Replicate-level values and error estimates are **absent from the ingested ProteinGym CSVs**. The original paper identifies Supplementary Table 4 as containing fitness estimates and associated errors. That supplementary workbook was not ingested: the publisher download host did not resolve, and the PMC download endpoint returned an HTML download challenge. No substitute errors, confidence intervals, replicate counts per observation or statistical-significance claims were invented. This case is a frozen ProteinGym measurement curation, not a reproduction of the original sequencing pipeline or MoCHI fit.

## Structural correspondence and limitations

| Property | 5O2S | 5O2T |
| --- | --- | --- |
| Selected KRAS chain | label A / author A / entity 1 / model 1 | label A / author A / entity 1 / model 1 |
| Context | DARPin K27, GDP, Mg | DARPin K55, GTPγS (GSP), Mg; sulfate also present |
| Construct | GSH tag + KRAS 1–166, G12V | GSH tag + KRAS 1–166, G12V |
| Archive resolution | 3.22 Å | 2.19 Å |
| Unresolved reference Cα | 166 | 165–166 |
| Outside construct | 167–188 | 167–188 |
| Observed reference Cα | 165 | 164 |

The source structures are from [Guillard et al., Nature Communications 8, 16111 (2017)](https://doi.org/10.1038/ncomms16111). The archived 5O2T title says K27. Weng Figure 4 explicitly identifies **5O2S as K27 and 5O2T as K55**, supported by their nucleotide contexts; both the conflicting deposited title and the curated context remain visible in the audit. The frozen mmCIF files are unmodified.

The mapper first resolves `_pdbx_poly_seq_scheme` label chain, author chain and entity. It joins the unique `_struct_ref_seq` P01116 alignment, label 4–169 to reference 1–166, then verifies every construct residue against the exact reference and `_struct_ref_seq_dif` declared differences. Thus reference G12 maps to label 15 / author 12 / observed V12. The three-residue tag is excluded. Atom chain, entity, author numbering, insertion code and residue identity must agree with the scheme. Model 1 is selected; the highest occupancy Cα is used, with blank alternate location preferred on ties. Nonstandard residues, ambiguous correspondence, undeclared mismatches and gapped unequal-span alignments fail closed. This bounded importer does not claim general mapping support for arbitrary proteins or structures.

A proper-rotation Kabsch fit uses the **164 shared observed reference Cα pairs**. RMSD is **1.5076231048929027 Å**, coverage **164/188 = 0.8723404255**. Every reported displacement uses the same fitted coordinates. The stored transform maps right onto left as `mapped = rotation @ right + translation` using column vectors. Gemmi 0.7.5 independently returns **1.507623104892868 Å**, an absolute RMSD difference of **3.46 × 10⁻¹⁴ Å**; rotation and translation also agree within 10⁻⁸. Fits with fewer than three points, collinear correspondences or nonfinite coordinates are rejected. Selected-position fitting reports its explicit mask and exclusions; coverage always uses the full 188-residue reference denominator. Omitted or empty position lists mean all shared observed positions.

These are **two experimental complexes with the same G12V mutation**. Different nucleotide, partner and crystallographic contexts prevent interpreting their difference as the effect of a mutation, or as a single mechanistic explanation for a measured variant. No mutant structure was predicted.

## Reproducible small prior

The supported inference is the sum of frozen [BLOSUM62](https://doi.org/10.1073/pnas.89.22.10915) substitution entries, in half-bit units. The precomputed file includes all 3,202 observed single substitutions. The worker also scores validated combinations by summing entries; it does not model epistasis. `WT` is an explicit no-substitution control with empty-sum score 0, not an experimental WT score. For example, G12D scores −1. The prior is substitution compatibility, **not abundance, K55 binding, folding energy, pathogenicity or treatment-response prediction**. There was no new model training, performance benchmark or calibration.

The matrix is frozen from Biopython 1.86's [BLOSUM62 data file](https://raw.githubusercontent.com/biopython/biopython/biopython-186/Bio/Align/substitution_matrices/data/BLOSUM62). The accompanying [Biopython License Agreement](https://raw.githubusercontent.com/biopython/biopython/biopython-186/LICENSE.rst) applies to distribution files without a different individual header license; both the matrix and complete license are included. The matrix header does not claim a distinct permissive license. Biopython contains some separately dual-licensed files; that fact is not used to relabel this matrix as BSD-only.

## Reproduction and reuse

Run from the repository root after installing the pinned scientific requirements into a virtual environment:

```sh
python3 -m venv .venv
.venv/bin/pip install -r scientific/requirements.txt
.venv/bin/python scripts/curate-case.py
.venv/bin/python -m unittest discover -s scientific/tests -v
```

The curator rebuilds outputs offline from checked-in frozen sources. To reacquire raw CSVs, download the [official v1.3 archive](https://marks.hms.harvard.edu/proteingym/ProteinGym_v1.3/DMS_ProteinGym_substitutions.zip) and extract only the two named `DMS_ProteinGym_substitutions/RASK_HUMAN_Weng_2022_*.csv` files. Compare their manifest hashes before replacing anything. The two reference metadata rows were selected from the [official reference table](https://raw.githubusercontent.com/OATML-Markslab/ProteinGym/main/reference_files/DMS_substitutions.csv); that table's `main` URL is not an immutable version, so frozen bytes/hashes are authoritative. Reacquire structures from `https://files.rcsb.org/download/5O2S.cif` and the corresponding `5O2T.cif` URL, and the isoform from [UniProt P01116-2 FASTA](https://rest.uniprot.org/uniprotkb/P01116-2.fasta). There is no background refresh.

The manifest records each asset's relative path, SHA-256, byte size, source URL and terms. ProteinGym's v1.3 Zenodo deposit states MIT (frozen deposit metadata included); the original article and associated study material are CC BY 4.0 with attribution; UniProt content is CC BY 4.0; wwPDB coordinates are CC0. Derived JSON retains the contributing-source attribution and limitations. Acquisition date: 13 September 2026 UTC, corresponding to 14 September in the user's time zone.

The worker accepts one JSON request on stdin and returns one typed JSON result on stdout. Diagnostics go to stderr. IDs are restricted to `5O2S` and `5O2T`; no arbitrary file/URL input is accepted. Input is capped at 1 MB and baseline requests at 10,000 variants.

```sh
printf '%s' '{"type":"comparison","leftId":"5O2S","rightId":"5O2T","positions":[]}' | .venv/bin/python -m scientific.worker
printf '%s' '{"type":"baseline","variants":["WT","G12D"]}' | .venv/bin/python -m scientific.worker
```

Tests include 30 explicit source-mmCIF mapping expectations across six edge classes (ordinary, tag offset, author offset, insertion code, unresolved coordinates, different author/label chains), plus 30 row-validation fixtures and actual G12V mappings. These are **software fixtures**, not externally reviewed biological assertions. Internal software verification is complete for the curated scope; independent biological expert review and prospective research-user validation remain pending.
