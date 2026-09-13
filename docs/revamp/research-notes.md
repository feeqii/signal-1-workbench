# Signal-1 research notes

**Reviewed:** 13 September 2026. **Purpose:** choose a useful product and a defensible scientific programme; this is not a claim of completed biological validation. The [audit](repository-audit.md) records repository and runtime findings. The [proposal](upgrade-proposal.md) makes the resulting design choices.

## Findings that change the seed

Three parts of the original idea are already well served: target–disease aggregation, molecular viewing/alignment, and molecular storytelling. Open Targets, Mol*/ChimeraX, and MolViewStories respectively provide those capabilities. Signal-1 should combine them around a decision that the researcher owns: **which perturbations and measurements would distinguish competing explanations of this target's behaviour?** This differentiation is a product hypothesis, not demonstrated demand or a novelty claim.

A generic variant-effect leaderboard is too far from that decision. A better first scientific case uses **paired, assay-specific outcomes** so that a binding phenotype can be considered alongside abundance. The ambitious destination includes interpretable mechanistic models and experiment selection, with simple baselines and measured incremental value. ProteinGym supplies a comparison framework; it does not by itself establish target validity, mechanism, drug efficacy or clinical utility.

## Research method and limits

Primary provider documentation, original papers, official repositories and a small number of public API/reference-sequence requests were used. Sources below were all checked on the review date. “Current” refers to the retrieved documentation, not a promise about a future release. Web search exposed relevant material from dynamic pages whose direct text extraction was empty or blocked; those limitations are identified. No interview, paid service, model training, new structure prediction, assay-score ingestion, benchmark execution or external communication occurred.

The original Weng publication was read through its indexed primary full text/abstract and official article metadata; the Nature page's direct extraction failed. Its supplementary measurements and fitting details still require a dedicated reproduction pass. ProteinGym reference metadata was inspected, not the full score datasets. No model or dataset license should be inferred from the license of an adjacent repository.

## What existing tools already solve

| Tool / primary reference | Established capability | Signal-1 consequence |
|---|---|---|
| [Open Targets Platform](https://platform-docs.opentargets.org/) | Integrates and scores target–disease evidence and connects targets, diseases, drugs and variants | Use upstream context; do not recreate a weaker general target-ranking platform |
| [PDBe-KB services](https://www.ebi.ac.uk/pdbe/pdbe-kb/services) and [component library](https://www.ebi.ac.uk/pdbe/pdb-component-library/) | Aggregated structural views and reusable sequence/3D components | “Sequence beside structure” is table stakes. Investigate component reuse rather than rebuilding every track |
| [Mol* scenarios](https://molstar.org/viewer-docs/faqs-scenarios/) | Selection, representations and superposition workflows | Retain the engine; own the mapping, scientific scope and result record |
| [ChimeraX Matchmaker](https://www.cgl.ucsf.edu/chimerax/docs/user/tools/matchmaker.html) and [AlphaFold commands](https://www.cgl.ucsf.edu/chimerax/docs/user/commands/alphafold.html) | Sequence-guided structural fitting, linked sequence analysis and predicted-model/PAE inspection | A powerful reference workflow and later numerical cross-check, not a feature list to claim as unique |
| [MolViewStories](https://molstar.org/mol-view-stories/) | Interactive molecular scenes, authoring, export and sharing; site cites its 2026 publication and displayed v1.1.0 | Drop “molecular storytelling” as the principal differentiator. Export interoperable scenes within an investigation |
| [MaveDB concepts](https://www.mavedb.org/docs/mavedb/getting-started/key-concepts.html) | Deposited experimental variant-effect score sets with reference context | A later source for measured outcomes; retain score-set identity and assay semantics |
| [ProteinGym](https://github.com/OATML-Markslab/ProteinGym) | Evaluation resources and existing variant-prediction baselines | Compare against established methods, and report the exact task and frozen release |
| [MoCHI](https://github.com/lehner-lab/MoCHI) | Interpretable models relating measured phenotypes to latent traits in suitable DMS designs | Reproduce/adapt established mechanistic methods before inventing a sequence/structure network |

This comparison supports a workflow differentiation, not a claim that no other research software connects these concepts. A broader competitor study and real-user observation would still be needed before commercial positioning.

## Provider access, semantics and reuse

These are implementation constraints taken from provider material, not legal advice or a blanket license clearance. Record both the upstream record license and the derived artifact's terms in future exports.

| Source | Access and identity contract | Reuse / operational consequence | Primary references |
|---|---|---|---|
| UniProt | REST resources and query fields; accession, taxon, isoform, sequence and sequence version must be explicit | Copyrightable database content uses CC BY 4.0. Exact gene search is a convenience, not a complete biological identifier | [Programmatic access](https://www.uniprot.org/help/programmatic_access), [license](https://www.uniprot.org/help/license/) |
| RCSB / wwPDB | Entry, polymer entity, entity instance and assembly are separate objects; instance API chain IDs are `label_asym_id` | API and archive data are CC0; preserve original deposition citations. Do not conflate author chain names with label chain IDs | [Data API](https://data.rcsb.org/), [usage policies](https://www.rcsb.org/pages/usage-policy) |
| SIFTS / PDBe | Residue-level UniProt–PDB correspondences, including discontinuities and annotated differences | Add mapping as required infrastructure. Version the mapping and verify against sequence; a PDB cross-reference alone is insufficient | [SIFTS](https://www.ebi.ac.uk/pdbe/docs/sifts/), [methodology](https://www.ebi.ac.uk/pdbe/docs/sifts/methodology.html) |
| AlphaFold DB | Prediction metadata, exact coordinate and confidence assets; model and database versions are distinct | DB data are CC BY 4.0. Persist the resolved model asset instead of later loading “latest by accession.” Both API hosts returned 403 during the audit, so current live contract details remain partly unverified | [FAQ](https://alphafold.ebi.ac.uk/faq), [official database](https://www.alphafold.ebi.ac.uk/) |
| Open Targets | GraphQL `/api/v4/graphql` for individual entities; official guidance points systematic queries to downloads/BigQuery | Platform data are marked CC0; code Apache 2.0. Do not assume separately fetched upstream data inherit those terms. Preserve source and indication rather than treating an aggregate score as truth | [API](https://platform-docs.opentargets.org/data-access/graphql-api), [license](https://platform-docs.opentargets.org/licence) |
| ChEMBL | REST target, molecule, mechanism and activity resources; preserve pagination and target-component matching | Database CC BY-SA 3.0. A molecule name may require a molecule lookup. Distinguish mechanism, measured activity and clinical phase; retain assay, units, relation qualifiers and references | [Data services](https://chembl.gitbook.io/chembl-interface-documentation/web-services/chembl-data-web-services), [general FAQ](https://chembl.gitbook.io/chembl-interface-documentation/frequently-asked-questions/general-questions) |
| MaveDB | Score sets, reference mapping and CSV measurements via API; public revisions can be superseded/deprecated | License is selected per score set; CC0 is recommended, not guaranteed. Store immutable identifiers and license, with an explicit refresh flow | [API quickstart](https://www.mavedb.org/docs/mavedb/programmatic-access/api-quickstart.html), [publishing](https://www.mavedb.org/docs/mavedb/submitting-data/publishing.html) |

No provider-specific throughput allowance was established. The future system should use bounded concurrency, timeouts, retry-after handling, cache revalidation and snapshot imports. It should expose `unavailable`, `not found`, `partial`, `stale` and `unsupported` separately. Neither documentation access nor one successful request establishes a service-level guarantee.

## Scientific methods and implications

### Identity and structural comparison

[SIFTS methodology](https://www.ebi.ac.uk/pdbe/docs/sifts/methodology.html) specifically addresses unobserved internal residues and differences among coordinate, experimental construct and UniProt sequences. This supports a mapping-first design. Our engineering recommendation is to retain those coordinate systems rather than collapse them to an integer residue index.

[Gemmi's analysis documentation](https://gemmi.readthedocs.io/en/latest/analysis.html) describes sequence alignment, superposition, neighbour search and conformer-aware structural operations. The retrieved page is labelled **0.7.6-dev**; this is research documentation, not a recommended production pin. Select a released version and validate exact outputs before implementation. Its numerical routines are a plausible server-side foundation; Mol* remains the rendering layer.

For a comparison, define the atom correspondence and fit mask first; calculate a rigid transform and then report both fit statistics and coverage. Domain-relative movement, unresolved residues, ligand/assembly differences and alternate conformations belong beside the metric. A low RMSD is not proof of biological equivalence. A local distance change is not proof of altered affinity. These are proposed interpretation rules, not results from this repository.

### AlphaFold confidence and mutation limits

The [AlphaFold2 confidence training material](https://www.ebi.ac.uk/training/online/courses/alphafold/inputs-and-outputs/evaluating-alphafolds-predicted-structures-using-confidence-scores/) separates local pLDDT from PAE. The [local-confidence lesson](https://www.ebi.ac.uk/training/online/courses/alphafold/inputs-and-outputs/evaluating-alphafolds-predicted-structures-using-confidence-scores/plddt-understanding-local-confidence/) explains why confident local domains do not imply confident inter-domain placement. Keep per-residue and domain-pair views; do not compress them into a mutation-effect score.

The [database FAQ](https://www.alphafold.ebi.ac.uk/faq), available through indexed text in this audit, cautions against interpreting destabilising point mutations as unfolded predictions. It does not justify a universal statement that all mutation-related structural analysis is impossible. Specific research methods can test carefully bounded relationships; the application must identify that method and its evidence. The [original AlphaFold paper](https://www.nature.com/articles/s41586-021-03819-2) establishes a structure-prediction method, not Signal-1's proposed functional assay predictor.

### Variant modelling: sequence baselines first, but do not stop there

[Meier et al., NeurIPS 2021](https://proceedings.neurips.cc/paper_files/paper/2021/hash/f51338d736f95dd42427296047067694-Abstract.html) provides a primary precedent for zero-shot protein-language-model mutation scoring. The official [ESM repository](https://github.com/facebookresearch/esm) exposes pretrained representations and variant-scoring examples. Treat its archived status and checkpoint-specific license/provenance as engineering considerations. A frozen representation plus a regularized head is a testable baseline, not a claim that a new trained model is automatically necessary.

[Biswas et al., Nature Methods 2021](https://www.nature.com/articles/s41592-021-01100-y) demonstrates data-efficient representation-based protein engineering in specific experimental settings. It motivates a low-label baseline comparison; its sample efficiency must not be promised for KRAS or other targets.

[SaProt's official implementation](https://github.com/westlake-repl/SaProt) provides an existing structure-aware model family, so “sequence + structure fusion” alone is not a novel contribution. Evaluate a published structure-aware comparator before training a bespoke fusion model. Its predicted-structure quality, structure coverage, pretraining exposure, compute requirements and model license must be recorded separately from sequence-only baselines.

### Evaluation framework and dataset version

[ProteinGym's NeurIPS paper](https://proceedings.neurips.cc/paper_files/paper/2023/hash/cac723e5ff29f65e3fcbb0739ae91bee-Abstract-Datasets_and_Benchmarks.html) supplies a unified evaluation framework across prediction settings. The [official repository](https://github.com/OATML-Markslab/ProteinGym) currently identifies **v1.3**, publishes metrics and precomputed baselines, and licenses its project under MIT. Upstream assay reuse and checkpoint licenses still need their own records. Freeze a release and hashes before running an experiment; the inspected `main` reference metadata should not be silently described as a frozen release.

For Signal-1, the relevant claims differ: within-assay interpolation, new positions, new mutation combinations, another assay context, and an unseen protein family. They require different splits. Our proposed protocols are specified in the proposal; random variant splits alone do not support all of them. Precomputed model scores are a baseline resource, not a new training accomplishment.

### Mechanism-specific opportunity: KRAS abundance and binding

The [ProteinGym substitution reference table](https://raw.githubusercontent.com/OATML-Markslab/ProteinGym/main/reference_files/DMS_substitutions.csv) contains `RASK_HUMAN_Weng_2022_abundance` and `RASK_HUMAN_Weng_2022_binding-DARPin_K55`. Both specify a 188-residue reference and include single and multiple mutants. These two rows support choosing a paired-outcome feasibility case; they do not establish which variants overlap, replicate quality, experiment costs, or a valid therapeutic prediction. Metadata lists different preprint DOI suffixes for the two rows, so publication provenance must be reconciled before release.

The original [Weng et al. KRAS study](https://pmc.ncbi.nlm.nih.gov/articles/PMC10866706/) is published in Nature 626 (2024), DOI [10.1038/s41586-023-06954-0](https://doi.org/10.1038/s41586-023-06954-0). It studies abundance and interactions and uses an explicit experimental/modeling design to infer energetic effects. Its conclusions are prior work, not discoveries available to claim again. Signal-1 can make such evidence easier to examine and use to design follow-up comparisons.

The audit separately checked [UniProt P01116](https://rest.uniprot.org/uniprotkb/P01116.json): its displayed isoform is K-Ras4A (`P01116-1`, 189 residues), while K-Ras4B is `P01116-2`. This creates a concrete test for the new mapping contract. A reference-sequence check is recorded in [kras-reference-check.json](kras-reference-check.json); raw measurement quality remains unassessed.

[MoCHI's official repository](https://github.com/lehner-lab/MoCHI), citing Faure and Lehner, Genome Biology 25, 303 (2024), supports fitting relationships between measured phenotypes and explicit latent traits. It requires a model design and suitable measurements/error estimates. A future reproduction would test identifiability and residuals before labelling anything a folding/binding free-energy estimate. Subtracting two normalized assay scores would not provide that inference.

### Experimental selection and uncertainty

[Greenman, Amini and Yang, PLOS Computational Biology 2025](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1012639) finds that uncertainty quality and selection utility vary across tasks and that uncertainty-based optimization need not beat greedy selection. This directly argues against promising that an “active learning” feature will save experiments. Its [official code](https://github.com/microsoft/protein-uq) is a useful reproducibility reference.

Signal-1 should distinguish selecting high-value candidates from learning the landscape and discriminating a mechanism. Our recommendation is to compare random, diversity, greedy and uncertainty-aware policies under the same batch budget, including controls and repeated measurements. A mechanistic objective needs additional evaluation against hypotheses or a suitable experimental model; top-k fitness recovery alone cannot validate it.

### Reproducible 3D outputs

[MolViewSpec](https://molstar.org/mol-view-spec-docs/) defines a declarative description of molecular scenes with reusable data and visual operations. Its [schema](https://molstar.org/mol-view-spec-docs/tree-schema/) is a strong candidate for scene interchange. It does not replace Signal-1's project database, immutable evidence records, computation provenance or permissions. Pin the viewer/spec versions and test a round trip using exact local assets; never promise cross-viewer pixel identity.

## Decisions supported, assumptions still open

| Decision | Evidence level | What would change it |
|---|---|---|
| Keep Mol* and Next; rebuild scientific state and workflow around them | Repository review plus mature upstream capabilities | A measured interaction or deployment limitation that cannot be addressed within these tools |
| Use mechanism investigation as the product; variant learning as a module | Reasoned synthesis of existing tools and scientific task requirements | Researcher observation showing comparison/reporting is enough, or that the target decision requires nonstructural evidence first |
| Start with KRAS paired assay feasibility; keep EGFR as a negative mapping regression case | Verified public reference metadata and current identity mismatch | Inadequate overlapping labels, inaccessible raw data/rights, assay mismatch, or a stronger researcher-backed case |
| Add structure features only after simple and published comparators | Existing sequence/structure methods; limited task-specific evidence | Reproducible improvement under matched data, leakage controls, budget and coverage |
| Defer automated mechanistic/active-learning claims | Original methods and uncertainty benchmark | Reproduced domain-specific results and eventually prospective experimental evidence |

The unresolved decisions that matter are the first research user's actual experimental question, what outcome their assay measures, and whether a partner can review a completed case. Those uncertainties do not block a coherent proposal, but they should block claims of validated utility. Compute budget, pilot hosting and license review become implementation gates after the proposal is approved.
