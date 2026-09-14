# Signal 1: Protein Mechanisms and Experimental Design

## 1. Scientific direction

Signal 1 should become a general protein investigation platform that connects exact molecular identity, experimental measurements, structural context, competing explanations, and the next experimental round. Researchers should be able to start with their own sequence or accession, add their structures and measurements, and obtain a reproducible investigation whose available analyses grow with the evidence. The central scientific output should be a reasoned experimental choice with explicit expected outcomes.

The existing implementation is a useful foundation: durable investigations, linked sequence and structure selection, mapped KRAS measurements, quantitative structure comparison, and portable exports. Its scope is deliberately fixed to one case. The next iteration should generalize the underlying scientific records and implement a complete second workflow, including importing subsequent measurements. Adding another curated protein would test portability but would not, by itself, deliver arbitrary-protein support.[^1]

Three findings materially strengthen this direction. First, MaveDB already offers linked variant heatmaps and AlphaFold structure inspection, so importing measurements and colouring a protein is an established capability.[^2] Second, Speak to a Protein describes literature retrieval, structural analysis, code execution and a live molecular scene; conversational protein analysis is also an active product category. Its preprint identifies residue-index interoperability as a remaining difficulty.[^3] Third, recent PDZ research shows that construct extensions can alter mutational and allosteric effects. Sequence context is consequently part of the scientific question, not just metadata to clean up.[^4]

**Recommendation:** build six connected capabilities in the next programme: general import; context-aware measurements; structural ensembles and interfaces; competing fitted models; experiment selection; and result-driven revision. Deliver these through separately testable increments while preserving one coherent investigation. Prediction should support mechanism testing and experimental choices; it should not become an isolated leaderboard feature.

The distinctive product hypothesis is that researchers benefit from carrying the same biological identity and evidence record through this entire cycle. The more ambitious research hypothesis is that selecting perturbation-and-measurement combinations to discriminate competing explanations can improve decisions under a fixed experimental budget. Neither hypothesis is established by the current repository or by the cited tools. Both can be tested without claiming a general autonomous discovery system.

The immediate release should enable a new protein to enter through the same importer as KRAS, complete a contextual evidence review, create an experiment panel, and accept a new results file. The subsequent scientific release should fit and compare a small family of mechanistic and predictive models, then evaluate whether their suggested experiments are more informative than transparent alternatives.

## 2. Arbitrary-protein support

The product promise should be: **bring a protein and the evidence available for it; retain a useful investigation even when some analyses are unavailable.** A sequence-only investigation, a structure-only investigation, and a richly measured protein should all be legitimate starting states. Operational limits on file size and computation should be explicit and independent of biological identity.

Accept an accession with an explicitly selected sequence, a FASTA file, or a structure accompanied by a selected polymer sequence. An accession is an annotation on a sequence identity, not a requirement that every protein be in a public database. Store the submitted sequence, normalized sequence, sequence digest, organism when known, construct boundaries, tags, and the relation to any reference. Unknown organism or accession must remain unknown. MaveDB's support for sequence-based targets and multiple targets provides a useful interoperability precedent.[^5]

| Available input | Immediate scientific workspace | Additional requirements |
| --- | --- | --- |
| Sequence only | Sequence annotations, hypotheses, variant library and experimental panel | Structures and measurements can be added later |
| Sequence plus one structure | Coverage, local environment, mapped annotations and contacts | A second comparable structure is needed for a structural difference |
| Several structures | Reviewed correspondences, contextual overlays and ensemble summaries | Comparable atoms and stated fit/evaluation regions |
| One measured assay | Variant-effect landscape, quality review and outcome-specific modelling | Adequate observations and a defined prediction task |
| Several assays or conditions | Contextual comparisons and competing measurement models | Comparable constructs, pairing rules and measurement uncertainty |
| Sequential results | Frozen predictions, round comparison and model revision | Stable sample identities and recorded experimental deviations |

Import should proceed through staging, parsing, identity resolution, mapping, validation and publication of an immutable snapshot. The researcher sees an import review with detected sequences, chains, assay columns and conflicts. Row-level errors should be downloadable and explainable. A partial import can be committed only after an explicit selection of accepted rows; silently discarding troublesome observations undermines the investigation.

Support single and combination substitutions in the first complete slice, with exact reference checking and full altered-sequence reconstruction. Design the variant record to support insertions, deletions, replacement segments and custom sequences, then add validated parsers incrementally. Preserve unsupported input as an unattached source artifact with a reason. Nonstandard or uncertain residues may be retained in identity records while individual methods declare whether they support them.

A capability evaluator should return available, missing-input, ambiguous or unsupported for each method. It should explain, for example, that a structure has no observed coordinates for the chosen site, or that a folding/binding model needs additional readouts. This permits genuine breadth of input without pretending that every protein supports the same scientific conclusion.

## 3. Molecular identity and experimental context

Replace the single accession and residue-number assumptions with an explicit identity model. A reference sequence, experimental construct, molecular entity, chain instance, biological assembly and structural model are different records. An experiment may perturb a tagged domain while the displayed structure contains a truncated construct in a complex. Both can relate to a common reference without being interchangeable.

SIFTS provides residue-level links between PDB and UniProt, and its methodology addresses unobserved residues and discrepancies between coordinate and full sequences.[^6] RCSB exposes entry, entity, chain-instance and assembly objects separately.[^7] Use these resources as evidence for deposited structures, followed by sequence validation. For uploaded or engineered structures, align the declared polymer sequence to the submitted construct and represent explicit gaps and differences. An offset inferred from the first observed residue is insufficient.

The current extractor supports a unique P01116 archive alignment with equal spans. This is appropriate for its frozen case but cannot become general merely by removing the accession check. The new mapper must handle repeated sequence motifs, insertion codes, missing internal residues, tags, alternate locations, multiple copies and ambiguous alignments. Keep candidate mappings when evidence is ambiguous and require an explicit resolution before an affected calculation.[^1]

The common residue key should include sequence identity and reference position. Structural selections add asset, model, assembly operator, chain instance, author number, insertion code and atom identity. A homodimer can map two distinct physical residues onto the same sequence position; a selection must preserve whether one copy or both was intended. Unresolved residues remain selectable in sequence and experiments without acquiring fabricated coordinates.

Create a separate context record for each measurement: construct, sequence background, partner sequence, assay, cell or biochemical system, treatment, concentration, temperature, time and batch when provided. Distinguish unspecified values from measured values. A different domain boundary or binding partner must create a different context even if the focal substitution has the same label.

This is a scientific expansion. The 2026 domain-extension study found that extending or pruning one PDZ domain changed subsets of stability, binding and allosteric effects.[^4] A separate 2026 study compared seven interaction landscapes across five homologous PDZ domains and found both shared patterns and protein-specific allosteric sites.[^8] These studies motivate context comparison and cautious transfer between homologues; they do not establish universal portability of mechanisms.

The resulting product should let a researcher ask whether an observation is stable across constructs, partners or conditions. A context-comparison view would show matched variants, changed experimental variables, mapping coverage and uncertainty before offering any interpretation. This is a stronger scientific use of multiple proteins than placing their structures beside one another.

## 4. Experimental evidence and uncertainty

Replace the two fixed abundance/binding columns with separate assay, measurement, sample, context and processing records. Store measurements in long form: each row identifies a variant or sample, assay, context, observed value, unit, value relation, replicate and source. Keep uncertainty type, bounds or standard error, sample count, missingness and quality flags when supplied. A source score and an imputed value must have distinct provenance and evidence types.

MaveDB distinguishes experiments from score sets and can retain uncertainty columns, replicates, counts and processing descriptions.[^9] Its formats are a strong import target, alongside generic CSV/TSV and frozen ProteinGym releases. The general importer should offer explicit column mapping and previews instead of inferring biological meaning from a column named "fitness". Missing, below-detection, not-assayed and failed-quality-control values need distinct representations.

A preprocessing record should preserve the raw bytes, selected rows, normalization, exclusions and software version. Never overwrite the source measurements. A later reanalysis becomes a derived dataset with its own identity. Known standard errors should not be treated as standard deviations; technical repeats should not be counted as independent biological samples. If replicate-level data are unavailable, the interface should still support descriptive review while leaving statistical confidence unquantified.

The first analytical tools should be informative and auditable: complete variant tables, substitution matrices, selectable assay axes, paired-coverage reports, replicate agreement, missingness summaries, and context-specific contrasts. Scatterplots should preserve all rows through an appropriate rendering strategy or explicitly disclose sampling. The current approximately 1,500-point display sample is an implementation choice, not an assay reduction method.[^1]

For paired outcomes, show the subset that can legitimately be compared and the reason each excluded row is missing. Differences between normalized assay scores are descriptive contrasts unless a justified measurement model connects the scales. A statistical residual of binding after conditioning on abundance can identify candidates for follow-up; it does not automatically identify a binding-energy change or an allosteric mechanism.

PTEN is a useful second case because published abundance measurements and a separate activity-focused scan provide different readouts.[^10][^11] Their experimental systems and processing differ, so they should be linked as contextual evidence rather than silently merged into one thermodynamic experiment. This case should test whether the software can express meaningful uncertainty and incompatibility while still helping a researcher plan follow-up.

The result should be a workspace that makes disagreements inspectable. A researcher should be able to see whether apparent conflict arises from measurement noise, a changed construct, a changed biological context, incomplete mapping, or an unresolved explanation. Formal multiple-testing and interval procedures belong to named analytical methods, with assumptions and diagnostics preserved in the computation record.

## 5. Structural mechanisms and ensembles

Generalize the two-structure viewer into a selected set of experimental and predicted structural states. Organize structures by construct, ligand, partner, nucleotide, modification, method and condition. Preserve this context beside quantitative comparisons. A collection of crystal structures is a sampled structural catalogue, not automatically an equilibrium ensemble or a measured transition trajectory.

Implement a structural analysis package with reviewed correspondences, independently selectable fit and evaluation masks, per-residue displacement, domain-relative motion, local contact differences, interface membership and missing-coverage reports. Fit the shared core and evaluate a moving domain without refitting the motion away. Comparisons should record coordinate units, atom selection, exclusions, transformation and both coverage denominators: the full reference and the requested region.

Gemmi provides sequence alignment, superposition and neighbour-search building blocks, including treatment of symmetry and alternate locations.[^12] Reuse those primitives behind a tested Signal 1 contract. Define contacts using a documented distance and atom-selection rule, retain assembly operators, and distinguish biological assembly contacts from crystal-neighbour contacts. A contact graph is descriptive geometry. Its shortest path or centrality is not evidence of a causal allosteric route.

The useful linked views are: a structure-by-residue coverage matrix; a contact-difference map; an interface inspector; a domain-motion comparison; and a variant-by-context evidence overlay. Display measured effects at the selected substitution when available, with an explicit aggregation policy for residue-level summaries. Keep conflicting substitutions visible instead of flattening every position to one unexplained average.

For predicted structures, retain the originating model, input sequence, model version and confidence assets. AlphaFold's pLDDT and PAE describe different aspects of structural confidence.[^13] Prediction outputs must be interpreted according to their producer and version: an experimental B factor is not pLDDT, and high local confidence does not validate a domain interface or a mutation-effect prediction. Confidence values should attach to the exact atoms or tokens described by the producer.

PLIP can contribute typed ligand-contact analysis, but its documentation notes that hydrogen addition can cause run-to-run differences.[^14] Preserve prepared coordinates and tool versions if this module is added. Start with deterministic distance-based contacts and introduce chemical interaction classes as a separately verified method. This keeps the first structural expansion feasible while leaving a substantial route to richer chemistry.

A later ensemble module can import externally produced trajectories or multiple predictions, calculate contact occupancy and structural variability, and connect those results to hypotheses. It must record sampling and frame selection. Launching molecular dynamics, estimating kinetics or generating mutant structures is a separate computational capability, not implied by visualizing a set of coordinates.

## 6. Fitted mechanisms and competing explanations

The scientifically ambitious modelling layer should compare explanations of measurements. Let the researcher specify a small model family: independent outcome-specific effects; a shared latent trait with assay-specific responses; or a folding/binding model when the experimental design supports it. A model record includes its equations or executable definition, assumptions, fitted parameters, input snapshot, error model and applicable contexts.

MoCHI provides an existing framework for interpretable DMS models, including specified biophysical transformations and epistatic terms.[^15] Its implementation accepts a model-design table relating phenotypes to traits and files containing variant fitness and error estimates.[^16] Integrate a pinned reproduction of this workflow before designing a custom mechanistic neural network. The existing KRAS score files lack the original replicate-level evidence required for the stronger claims contemplated in the roadmap.[^1]

One proposed measurement model is y(v,c,a) = g(a,c, z(v,c)) + noise, where v is variant, c is experimental context, a is assay, and z denotes latent properties. The model specifies what each assay observes and which parameters are shared across contexts. A generic latent variable must remain a latent variable. Naming it folding energy requires the corresponding physical model, scale conventions, identifiability and appropriate experimental support.

Provide an identifiability report: parameter trade-offs, uncertainty, sensitivity to initialization, residual patterns, held-out performance and alternative models with similar fits. If two explanations cannot be distinguished by the present data, preserve that ambiguity and turn it into a candidate experimental question. A failed or underdetermined fit should still produce a diagnostic report that improves the investigation.

For epistasis, define the reference prediction explicitly. A double-mutant residual depends on the measurement scale and the model used to predict combined effects. Distinguish observed non-additivity from inferred energetic coupling. The 2022 doubledeepPCA work is a practical reproduction candidate because it couples multiple phenotypes and genetic backgrounds to an explicit thermodynamic design.[^17]

Two deeper research directions follow. First, compare how inferred effects change with a domain extension, partner or background. Second, test whether structural contacts or homologous positions improve those predictions after simple sequence and context baselines are established. The 2026 comparative PDZ maps provide a relevant future transfer benchmark, with a separate held-out protein rather than a random split of its variants.[^8]

The scientific deliverable should include both successful and rejected explanations, their predictive limits, and the observations that could resolve them. This would add substantial inferential depth to the current notebook while keeping the distinction between measured evidence, fitted explanation and researcher hypothesis visible.

## 7. Experimental design and the results loop

Change the experiment-panel row from a variant alone to an experiment: variant, construct/background, partner, assay, condition, controls, repeats and estimated cost when known. The same variant measured in a second assay can be more informative than another mutation in the original assay. Multiple rows for one variant are therefore valid when their measurement contexts differ.

Offer three explicit objectives: distinguish competing explanations, improve knowledge of an outcome landscape, or optimize a specified property. Each requires different evaluation. The lead objective for Signal 1 should be mechanism discrimination. A researcher defines explanations and expected observations, then compares which feasible experiments would separate them.

Begin with a transparent disagreement view. For each candidate experiment, show predictions or qualitative expectations under each explanation, the uncertainties that could obscure the difference, relevant structural context, and feasibility. Keep qualitative expectations qualitative. When calibrated probabilistic models exist, an experimental-design method can estimate expected information gain: the anticipated reduction in uncertainty over the candidate explanations after observing an outcome. The calculation is conditional on the chosen model family and observation model.

Build panels subject to explicit limits: total experimental capacity, mandatory controls, repeats, available constructs, mutable regions, assay capacity and diversity. Preserve researcher changes and reasons. Suggest a small Pareto set of panels trading off expected informativeness, cost and coverage rather than hiding these priorities in one universal score. Deduplicate by experiment identity, not variant label.

There is promising precedent for iterative learning. ALDE reports an enzyme-engineering campaign improved through successive model-guided experimental rounds.[^18] However, a separate uncertainty benchmark found that uncertainty-aware optimization did not outperform greedy selection in its tested settings.[^19] These results support building and evaluating the loop; they do not establish that a particular acquisition method will help Signal 1's mechanistic tasks.

Before execution, freeze the panel, its hypotheses, predictions, uncertainty, method version and dataset revision. On results import, match sample identifiers, retain failed and missing measurements, record substitutions to the plan, and create a new evidence snapshot. Compare observations with the frozen predictions before refitting. Display which explanations lost support, which remain indistinguishable, and which measurements would now be useful.

Retrospective evaluation must hide future outcomes from every selector and its features. Replaying a fully observed historical dataset can test selection behaviour, but cannot reproduce unmeasured assay choices or establish real laboratory savings. Use simulation with known mechanisms for algorithm checks, historical datasets for constrained replay, and eventually a researcher-designed prospective round for usefulness.

The visible workflow becomes a recurring scientific record: question, evidence, explanations, panel, outcomes, revision. Its value should be judged by improved decisions and fewer unsupported inferences, alongside the practical time required to complete the work.

## 8. Method portfolio and ambitious extensions

Use a method registry whose entries declare required inputs, supported alphabets and perturbations, compute requirements, output meaning, validation evidence and known limitations. Methods should write standard result artifacts attached to an investigation revision. Input compatibility and scientific applicability are separate checks.

| Method family | Role in Signal 1 | Proposed priority |
| --- | --- | --- |
| Reference validation, mapping and structural geometry | Establish comparable evidence and expose coverage | Core next release |
| Replicate-aware descriptive statistics and contextual contrasts | Identify observations needing explanation | Core next release |
| Additive/regularized sequence and context models | Provide understandable predictive baselines | First modelling increment |
| MoCHI-style measurement models | Infer explicitly specified latent mechanisms when supported | Lead scientific extension |
| Pretrained sequence and structure-aware models | Compare priors and measured-data predictions | Evaluated supporting methods |
| Expected-information and disagreement-based selection | Choose feasible experiments that distinguish explanations | Lead research experiment |
| Homologue and construct transfer | Test which inferred effects generalize | Subsequent ambitious extension |

ProteinGym supplies established prediction comparisons and identifies v1.3 as adding further model baselines.[^20] FLIP2 extends evaluation to practical shifts, including different positions and wild-type backgrounds; its authors report that simpler models often match or outperform fine-tuned language models.[^21] Signal 1 should consequently evaluate a compact baseline ladder under the intended generalization task, with identical data access and tuning budgets.

SaProt is one candidate structure-aware comparator, with checkpoint-specific input requirements documented by its maintainers.[^22] A model trained for sequence compatibility or a broad benchmark should not automatically be labelled a binding-specific predictor. An ensemble's disagreement is also not a calibrated probability that a biological explanation is wrong. Store eligibility, missingness, held-out performance and calibration with each result.

Boltz-2 is relevant to a later protein-small-molecule module, but its documented affinity feature is for a small-molecule ligand binding a protein. It is not a general protein-protein affinity predictor for the KRAS-DARPin case.[^23] Independent 2026 preprint evaluation reports limitations in particular screening comparisons, against computational free-energy estimates rather than universal experimental ground truth.[^24] This makes it a candidate to evaluate on a specified task, not the centre of the immediate mechanism platform.

A grounded research assistant could help retrieve evidence, propose analyses and draft contrasting explanations. Its durable outputs should be typed claims linked to citations and computation records. Natural-language convenience should use the same validated methods as the visible controls. Avoid making arbitrary generated code the only reproducible description of an important scientific result.


## 9. Validation and scientific programme

Validate generality through structurally different cases, not a growing list of polished presets. Every released example should enter through the ordinary importer with its source manifest and mapping decisions. Keep the existing KRAS case as a regression reference, then add a cross-assay case and a mechanistic reproduction case. Sequence-only and ambiguous-mapping fixtures are equally important for verifying honest behaviour.

| Case | What it tests | Evidence requirement before release |
| --- | --- | --- |
| Existing KRAS abundance/K55 | Backward compatibility, saved work and numerical comparison | Preserve source bytes and legacy export interpretation |
| PTEN abundance plus activity | Different sequence length, assay types and biological systems | Freeze original sources; verify sequence, overlap and assay distinctions |
| PSD95-PDZ3 or GRB2-SH3 doubledeepPCA | Domain constructs, partners and a specified measurement model | Reproduce published processing/model inputs and uncertainty |
| Unannotated FASTA with a local structure | No accession, custom mapping and one-structure workflow | Independently checked correspondence and conflict fixtures |
| Sequence-only and repeat/indel cases | Missing structure, unsupported methods and ambiguity | Meaningful workflow and explicit unsupported states |
| Held-out enzyme or homologue benchmark | Transfer beyond the initial cases | Locked split and measurement semantics before training |

The PTEN and domain examples are proposed cases supported by available publications; their complete source files and new mappings have not been curated in this cycle.[^10][^11][^17] Choosing them is a research-design recommendation, not a completed data-validation result. Prefer a domain expert's real question if it provides a stronger test of the same capabilities.

Use four evaluation layers. Data integrity checks verify identity, mappings, source hashes, measurement units and export round trips. Numerical checks compare known transformations and independent implementations with stated tolerances. Scientific evaluation tests generalization, uncertainty, model identifiability and selection under fixed budgets. User evaluation examines whether researchers produce more defensible experiments and can correctly explain what the evidence supports.

For prediction, keep all measurements of a held-out variant/background together as required by the scientific question. Fit preprocessing and calibration on permitted partitions only. Report learning curves, eligible coverage, performance on each assay and structure-availability group, and uncertainty intervals over appropriate independent units. A new-protein claim needs held-out proteins or families; a random variant split does not test it.

For selection, compare random, diversity, greedy and mechanism-disagreement policies using the same candidate set, initial observations, assay costs and control budget. Measure predictive log score or decision error when a probabilistic model is justified; otherwise report a predefined, domain-reviewed discrimination rubric. Top-k fitness recovery measures optimization and must not stand in for mechanism discovery.

Before a broad release, run a formative study with approximately five to eight relevant researchers on matched tasks. This is a proposed study size for identifying workflow failures, not a powered estimate of scientific benefit. A subsequent prospective experimental round should preserve pre-result predictions and independently review whether the resulting evidence changed the intended decision.

## 10. Architecture and delivery sequence

Retain the current Next/React, Mol* and Python architecture. Its saved revisions, recovery and export discipline are worth preserving. Replace the frozen-case assumption with immutable investigation datasets, a sequence/context registry, private asset storage and job-specific dependency records. No distributed service fleet is required to establish scientific generality.

The most important code changes span several layers. The TypeScript schemas fix the KRAS accession, reference length and assay names; the case loader fixes paths; the Python mapper fixes an accession and alignment class; jobs bound positions to 188; the viewer UI and exports contain case-specific labels.[^1] Generalization therefore needs a domain migration, a generic importer, and capability-driven rendering rather than a search-and-replace of constants.

| Increment | Reviewable result | Gate to proceed |
| --- | --- | --- |
| A. General investigation core | Sequence/context records, immutable datasets and legacy migration | Existing KRAS work survives, including exports and calculations |
| B. Bring your protein and evidence | FASTA/accession, structure and assay import; zero/one/many structures | A new protein completes the workflow without source edits |
| C. General mapping and linked views | Contextual sequence, structure and assay inspection | Independent mappings and cross-view selection agree |
| D. Basic experimental rounds | Frozen expectations, panels and result import | New outcomes preserve the original plan and evidence |
| E. Structural and assay depth | Interfaces, ensemble comparisons and uncertainty | Independent numerical and measurement checks pass |
| F. Mechanistic model workbench | Reproduced models, diagnostics and comparisons | Held-out checks support the displayed claims |
| G. Selection research | Budget-matched selectors and candidate pilot | Improvement, failure or uncertainty is reported transparently |

The first implementation milestone should combine A through D. A researcher imports an arbitrary reference, adds a structure and measurements when available, records two explanations, exports a panel, imports results and reopens the changed investigation. This proves the platform abstraction before deeper model execution becomes a dependency.

Store uploaded assets outside the application's public directory. Resolve them by immutable identifiers; keep staging separate from committed datasets. Scientific jobs should receive a validated input bundle and limited output location, with declared runtime, memory and file limits. Local execution should remain available for geometry and statistical baselines. Larger model jobs can later use separately configured workers without sending private sequences to a remote provider by default.

Separate byte integrity from numerical reproducibility. Exact source hashes and archived results should survive export unchanged. Recomputed floating-point results should be compared under recorded tolerances and runtime information instead of requiring universal bit equality across platforms. Changed source data or method settings should create a new result and invalidate only dependent calculations.

The programme succeeds when a researcher can investigate a new protein, express why an explanation remains uncertain, choose a discriminating experiment and learn from its outcome within the same recoverable record. This is a substantially larger scientific ambition than the current case, with concrete intermediate releases and a credible way to test whether the extra complexity earns its place.

## Sources

[^1]: Signal 1 local repository, commit `3b4719e`, reviewed 14 September 2026. Files: [README](../../README.md), [case schema and loader](../../src/lib/investigation/case.ts), [investigation schema](../../src/lib/investigation/schema.ts), [scientific mapping](../../scientific/case_data.py), [job definitions](../../src/lib/investigation/jobs.ts), [assay view](../../src/components/investigation/evidence.tsx), [implementation evidence](../revamp/implementation-status.md). Local access; newer implementation not present on the public main branch at review time. Application and scientific tests passed in the preceding review in this task; no new biological validation is implied.
[^2]: MaveDB. [Visualizations](https://www.mavedb.org/docs/mavedb/finding-data/visualizations.html). Official documentation, accessed 14 September 2026. Linked heatmaps, residue selection and AlphaFold structure display.
[^3]: Navarro, C., et al. [Speak to a Protein: An Interactive Multimodal Co-Scientist for Protein Analysis](https://arxiv.org/html/2510.17826v1). arXiv:2510.17826v1, 1 October 2025. Preprint; system description and case studies, not an independent comparative effectiveness trial.
[^4]: Hidalgo-Carcedo, C., et al. [Allosteric and energetic remodeling of a PDZ domain by protein domain extensions](https://pubmed.ncbi.nlm.nih.gov/41714636/). Nature Communications 17, 2934, 19 February 2026. DOI: 10.1038/s41467-026-69673-w. Primary abstract and figure descriptions inspected through PubMed; publisher PDF text also available in indexed retrieval.
[^5]: MaveDB. [Targets](https://www.mavedb.org/docs/mavedb/submitting-data/targets.html). Official documentation, accessed 14 September 2026. Sequence-based, accession-based and multi-target records.
[^6]: PDBe. [SIFTS methodology](https://www.ebi.ac.uk/pdbe/docs/sifts/methodology.html) and [SIFTS overview](https://www.ebi.ac.uk/pdbe/docs/sifts/). Official documentation, accessed 14 September 2026. Residue correspondences and unobserved regions.
[^7]: RCSB PDB. [Web APIs overview](https://www.rcsb.org/docs/programmatic-access/web-apis-overview). Official documentation, accessed 14 September 2026. Entry/entity/instance/assembly hierarchy and search interfaces.
[^8]: Marti-Aranda, A., and Lehner, B. [Seven complete comparative maps of allosteric mutations in a protein family](https://www.nature.com/articles/s41467-026-71005-x). Nature Communications, 21 April 2026. DOI: 10.1038/s41467-026-71005-x. Publisher PDF and indexed primary text inspected; [PMC copy](https://pmc.ncbi.nlm.nih.gov/articles/PMC13284222/).
[^9]: MaveDB. [Key concepts](https://www.mavedb.org/docs/mavedb/getting-started/key-concepts.html). Official documentation, accessed 14 September 2026. Experiments, score sets, uncertainty columns, counts and derived analyses.
[^10]: Matreyek, K. A., et al. [Multiplex assessment of protein variant abundance by massively parallel sequencing](https://pubmed.ncbi.nlm.nih.gov/29785012/). Nature Genetics 50, 874-882, 2018. DOI: 10.1038/s41588-018-0122-z. Primary abstract and author-hosted paper identified; complete new case curation remains pending.
[^11]: Mighell, T. L., Evans-Dutson, S., and O'Roak, B. J. [A Saturation Mutagenesis Approach to Understanding PTEN Lipid Phosphatase Activity and Genotype-Phenotype Relationships](https://pmc.ncbi.nlm.nih.gov/articles/PMC5986715/). American Journal of Human Genetics 102, 943-955, 2018. DOI: 10.1016/j.ajhg.2018.03.018. Primary indexed text; distinguishes measured estimates and imputation.
[^12]: Gemmi. [Structure analysis](https://gemmi.readthedocs.io/en/stable/analysis.html). Official stable documentation, retrieved page labelled 0.7.5; accessed 14 September 2026. Alignment, superposition, neighbour and contact search. Numerical conventions must be checked against the pinned runtime.
[^13]: EMBL-EBI. [Evaluating AlphaFold2's predicted structures using confidence scores](https://www.ebi.ac.uk/training/online/courses/alphafold/inputs-and-outputs/evaluating-alphafolds-predicted-structures-using-confidence-scores/) and [AlphaFold DB FAQ](https://alphafold.ebi.ac.uk/faq). Official training and documentation, accessed 14 September 2026. Producer-specific confidence interpretation.
[^14]: PLIP maintainers. [Protein-Ligand Interaction Profiler](https://github.com/pharmai/plip). Official implementation, accessed 14 September 2026. Interaction typing and preparation-related reproducibility limitations; repository cites the 2025 update, DOI: 10.1093/nar/gkaf361.
[^15]: Faure, A. J., and Lehner, B. [MoCHI: neural networks to fit interpretable models and quantify energies, energetic couplings, epistasis, and allostery from deep mutational scanning data](https://link.springer.com/article/10.1186/s13059-024-03444-y). Genome Biology 25, 303, 2 December 2024.
[^16]: Lehner laboratory. [MoCHI implementation](https://github.com/lehner-lab/MoCHI). Official repository, accessed 14 September 2026. Model-design format, supported transformations, phenotype files and error estimates.
[^17]: Faure, A. J., et al. [Mapping the energetic and allosteric landscapes of protein binding domains](https://www.nature.com/articles/s41586-022-04586-4). Nature 604, 175-183, 6 April 2022. Primary text and supplementary-file descriptions inspected; complete reproduction remains pending.
[^18]: Yang, J., et al. [Active learning-assisted directed evolution](https://www.nature.com/articles/s41467-025-55987-8). Nature Communications 16, 714, 2025. A specific experimental engineering demonstration, not a guarantee for arbitrary proteins.
[^19]: Greenman, K. P., Amini, A. P., and Yang, K. K. [Benchmarking uncertainty quantification for protein engineering](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1012639). PLOS Computational Biology, 2025. Retrospective uncertainty, active-learning and optimization comparisons on specified landscapes.
[^20]: OATML/Marks laboratory. [ProteinGym](https://github.com/OATML-Markslab/ProteinGym). Official repository, accessed 14 September 2026; listed release PG_v1.3, 28 April 2025. Published baseline and benchmark inventory, not a performed Signal 1 evaluation.
[^21]: Didi, K., et al. [FLIP2: Expanding Protein Fitness Landscape Benchmarks for Real-World Machine Learning Applications](https://flip.protein.properties/). Author-maintained project and results site, listed as ICML 2026. [Official repository](https://github.com/J-SNACKKB/FLIP). Accessed 14 September 2026. Paper link did not resolve in this session; conclusions here are limited to the detailed official project material.
[^22]: Westlake REPL. [SaProt implementation](https://github.com/westlake-repl/SaProt). Official repository, accessed 14 September 2026. Checkpoint-specific structure-aware input requirements and mutation-scoring examples.
[^23]: Boltz maintainers. [Prediction instructions](https://github.com/jwohlwend/boltz/blob/main/docs/prediction.md) and [official repository](https://github.com/jwohlwend/boltz). Accessed 14 September 2026. Small-molecule affinity input scope and separate output semantics.
[^24]: Wan, S., Zhang, X., Xue, X., and Coveney, P. V. [On the Reliability of AI Methods in Drug Discovery: Evaluation of Boltz-2 for Structure and Binding Affinity Prediction](https://arxiv.org/abs/2603.05532). arXiv:2603.05532v1, 2 March 2026. Preprint; abstract inspected, with comparator and scope retained.
