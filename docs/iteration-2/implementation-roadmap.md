# Signal 1 next-iteration implementation roadmap

This is a proposed build programme based on the [research report](deep-research-report.md), targeting the local `3b4719e` implementation. No functionality described below has been implemented in this research cycle. Mechanistic investigation and experimental design are the lead objectives. Existing KRAS investigations and source assets must survive the transition.

## Release definition

The first release is complete when a researcher can create an investigation from a new sequence without editing application code, add zero or more structures and arbitrary supported assay columns, inspect mapping and measurement quality, write competing explanations, create a panel, import a subsequent results file and reopen the entire record. The same importer must load the KRAS regression case. A second hard-coded protein is not the acceptance criterion.

Subsequent releases add ensemble analysis, fitted models and evaluated experiment suggestions. Separate basic round tracking from advanced model-guided selection so the general workflow can ship before model performance is established.

## A. General scientific records and migration

**Result:** replace the fixed-case data model with versioned sequence, construct, context, dataset and investigation records.

Proposed records:

| Record | Required identity and relationships |
| --- | --- |
| Sequence | Normalized sequence, digest, alphabet, supplied identifiers and original source |
| Construct | Sequence identity, reference relationship, boundaries, tags and explicit alterations |
| Context | Construct, partner identities, assay environment, treatment, conditions and batch when supplied |
| Structure asset | Source bytes, format, model, assembly and chain instances, confidence provenance |
| Residue mapping | Reference identity/position to structural atom identity, method, coverage and ambiguity |
| Assay | Observable, units, direction, protocol, measurement and processing semantics |
| Measurement | Sample/variant, assay/context, value/relation, uncertainty, replicate, quality and source row |
| Dataset snapshot | Immutable source and derived artifacts, import decisions and processing lineage |
| Model run | Inputs, method/runtime, parameters, eligibility, diagnostics and result artifacts |
| Hypothesis | Statement, context, supporting/conflicting evidence and expected observations |
| Experiment/round | Variant plus measurement context, controls, repeats, frozen expectations and outcomes |

Start in `src/lib/investigation/schema.ts`, `case.ts`, `store.ts` and `export.ts`. Replace global `188` limits with validation against the referenced sequence. Keep runtime resource limits separate. Replace exactly two required structures with zero-to-many assets and an optional active comparison. Preserve uncertainty and missingness as typed fields rather than coercing them into numbers.

Define a version-2 bundle and an explicit version-1 migration. Import old bundles with the old validator first; create a new dataset revision through migration without modifying the archived bytes. Preserve prior result identities or an explicit old-to-new identity map, original scenes, findings and panel roles. Mark old panel rows as having unspecified assay/context fields until populated; do not invent experimental details.

**Acceptance:** the original KRAS export can be migrated, reopened and re-exported with intact reference, evidence, findings and calculations. Zero-structure and one-structure investigations save successfully. Two contexts for one variant remain distinct. Invalid positions still fail against their actual reference. Existing conflict/recovery behaviour remains verified.

## B. Import pipeline and capability evaluation

**Depends on A. Result:** a reviewable importer shared by user data and examples.

Implement staged import records and immutable assets outside `public/`. Begin with FASTA, local mmCIF/PDB, CSV/TSV and existing KRAS bundles. Add accession-based discovery and MaveDB adapters through the same normalized records, preserving provider response versions and source identifiers. A public match must never silently replace a submitted sequence.

Stages: receive and hash sources; parse; identify sequences/chains/assays; resolve reference and construct relationships; map residues and variants; preview accepted/conflicting rows; commit a dataset snapshot atomically. Keep interrupted imports resumable or safely discardable without creating partial committed datasets. Bound decompressed size, row counts and parser resource consumption, and reject path traversal in imported archives.

Create a capability evaluator with machine-readable reasons for unavailable analyses. Sequence review and experiment authoring require no structure. Local contacts require mapped coordinates. Structural comparison needs an adequate nondegenerate correspondence. Model fitting needs suitable measurements. Probabilistic experiment selection needs an explicit observation model and usable uncertainty.

**Acceptance:** import an unannotated FASTA, a new protein with one structure, and a protein with measurements but no structure. Errors identify source rows and expected residues. Uploaded material is not available through public static paths. A provider outage preserves the local workflow. A partial import requires an explicit accepted-row decision. No scientific job runs on an ambiguous mapping.

## C. General mapping and linked scientific views

**Depends on A/B. Result:** robust mapping and a workspace that reflects the imported biology.

Replace the P01116-specific path in `scientific/case_data.py` with separate deposited-structure and uploaded-construct mapping methods. Use validated SIFTS evidence when appropriate and sequence alignment with explicit correspondence for custom structures. Preserve author and label numbering, insertion codes, model identifiers, chain copies and assembly operators. Do not use a single residue offset as a general solution.

Update `scientific/compare.py`, job validators, `molstar-viewer.tsx`, `scene.ts`, `sequence.tsx`, `context-panels.tsx` and `workbench.tsx`. Derive target labels, sequence length, region shortcuts and structural context from records. Support a single primary sequence with mapped partner chains in the initial UI while retaining identities needed for multi-target assays.

Generalize `evidence.tsx`: selectable assay axes, long-form tables, explicit context filters, coverage/missingness and uncertainty. Provide sequence/table alternatives for every precision 3D interaction. Use virtualization or appropriate canvas rendering for larger data; expose any downsampling and retain complete accessible tables.

**Acceptance:** independently reviewed fixtures cover tags, internal gaps, insertion codes, repeated motifs, alternate locations, homomer copies and unresolved residues. Selections agree across every view. Ambiguous positions remain ambiguous. Independent superposition agrees under a declared numerical tolerance. A source-code scan finds case-specific biology only in example assets, migrations and explicitly case-specific tests.

## D. Basic experimental rounds in the first release

**Depends on A/B/C. Result:** a complete research cycle before model-guided recommendations.

Replace panel uniqueness by variant with uniqueness by experiment identity. Add stable sample IDs and explicit assay/context, control role, planned repeats and expected observations under each hypothesis. Permit repeated variants in distinct assays or conditions.

Freeze a round before importing its results. Import a result sheet through the generic importer, matching stable sample IDs and flagging unmatched or changed experiments. Retain failed measurements, substitutions to the plan and missing outcomes. Create a new dataset and hypothesis revision without rewriting the original plan. A qualitative expectation remains qualitative.

**Acceptance:** author two competing explanations, export a panel, import a result file, review plan deviations and reopen both the pre-result and post-result states. CSV formula escaping remains in place. New results do not modify frozen predictions or historical evidence. This closes the first general-platform release.

## E. Structural ensembles and assay analysis

**Depends on first release. Result:** substantive scientific depth beyond general input.

Add structure-by-residue coverage, independent fit/evaluation masks, domain-relative displacement, distance-based contact differences and interface inspection. Preserve biological assembly versus crystal-neighbour provenance. Add typed chemical interactions only after coordinate preparation and tool behaviour are reproducible.

Add replicate summaries, contextual contrasts and an explicit preprocessing history. Store raw and derived values separately. Introduce assay-specific statistical procedures as named methods with retained assumptions and diagnostics. Do not convert arbitrary paired scores into energies or infer missing error estimates.

**Acceptance:** rigid-transform, moving-domain, missing-coverage and contact-boundary fixtures produce expected results. A context change cannot silently share normalized values. Measurement uncertainties retain their original meaning. Representative UI tasks pass keyboard, narrow-layout and realistic-workload checks.

## F. Mechanistic model workbench

**Depends on A/B and adequate evidence; use E for integrated structural review. Result:** reproduced, inspectable models and competing explanations.

Create a method registry and standard run/result contract. Start with additive or regularized outcome-specific baselines, followed by a pinned MoCHI reproduction on a suitable published domain dataset. Retain the model-design file, input/error semantics, transformations, reference state, seeds, environment, fitted parameters and diagnostics.

Implement held-out predictions, residuals, uncertainty and sensitivity to initialization. Present parameter non-identifiability and equally plausible models. Energy labels require the corresponding measurement model and support. Generic latent models retain generic latent-property names.

Add one pretrained sequence comparator and, if justified, a structure-aware comparator under matched data access. Freeze checkpoint identity and examine eligibility and coverage before comparison. GPU inference belongs in an isolated worker with a separately declared budget; geometry and simple statistical baselines should remain locally runnable.

**Acceptance:** reproduce a declared published result or document the discrepancy before any adaptation. Test split integrity, preprocessing leakage and known synthetic latent-model behaviour. Compare models on held-out positions/backgrounds appropriate to the claim. A method with no improvement remains a recorded negative result and does not become the default merely because it is more complex.

## G. Experiment-selection research

**Depends on D/F. Result:** a budget-matched comparison of selection policies attached to the real panel editor.

Implement manual, random, diversity and greedy selectors first. Add disagreement-based panels, then expected-information selection where probabilistic assumptions are defensible. Choose experiments, including assay/context, rather than only variants. Require feasibility, controls and repeats to consume the same budget in every policy.

Run simulation with known mechanisms and retrospective replay with hidden future labels. Separate mechanism discrimination, landscape learning and property optimization metrics. Preserve candidate sets, seeds, initial observations, model updates, costs and all attempted policies. Show researcher overrides and the consequences for panel coverage.

**Acceptance:** a selector cannot read hidden outcomes, directly or through preprocessing. Results report uncertainty over appropriate repeats or independent tasks. A negative comparison is deliverable evidence. Prospective usefulness requires a separately designed laboratory round; retrospective gains alone do not establish fewer experiments in practice.

## Evaluation set and release evidence

Use KRAS for migration; PTEN for cross-assay context; PSD95-PDZ3 or GRB2-SH3 for a mechanistic reproduction; an unannotated local sequence for identity generality; and synthetic pathological mapping fixtures for failure modes. Freeze new sources and check reference sequences before declaring any case supported. A held-out FLIP2 enzyme or homologue task can subsequently test extrapolation without turning the product into a generic benchmark dashboard.

The delivery record should contain import manifests, reviewed mappings, numerical comparisons, saved round trips, dataset/model split manifests, model diagnostics and representative researcher-created briefs. Report software correctness, scientific validity and observed user benefit separately.

Proposed user study: five to eight relevant researchers complete matched tasks using their normal workflow and Signal 1. Review time-to-brief, identity mistakes, unsupported claims, control quality and whether the proposed experiment distinguishes the stated explanations. This is formative evaluation; any claim of quantified scientific benefit requires an appropriate later study design.

## Sequencing and decision rules

Build A, B, C and D as the first vertical release. E deepens the evidence; F deepens the inference; G tests decision support. F can be researched independently once source data are ready, but its UI should depend on the same general records. This ordering avoids blocking arbitrary-protein usability on model training while preserving the ambitious end-to-end direction.

Keep advanced simulation, general docking, de novo generation, hosted collaboration and a conversational assistant as separately justified extensions. None is necessary for the first general mechanism workflow. Add them when a specific research question requires their outputs and the validation can be specified.

No calendar or compute-cost promise is assigned here: staffing, hardware, candidate dataset quality and reviewer availability are not established. Use the acceptance gates to estimate each increment after the schema and first import spike. The next concrete development task is A/B: the general dataset and identity migration with an end-to-end import fixture, followed immediately by linked views and a basic results round trip.
