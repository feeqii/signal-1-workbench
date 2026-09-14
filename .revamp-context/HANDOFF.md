# Signal-1 revamp: research and upgrade handoff

Status: seed proposal and verified prior evidence; audit and revised proposal requested, implementation deferred
Prepared: 2026-09-13
Repository: https://github.com/feeqii/signal-1-workbench
New local clone: `/Users/feeq/Desktop/Signal-1 revamp`
Verified clone HEAD: `a35f831237769746c07c41fb6cffad4079f8e1cc`; clean immediately after clone, before this handoff was added.
Originating task: Compile AI accomplishments, 01a09b2a-b98e-7ef2-a65f-a5987f268c6c.

## User intent and current assignment

The user explicitly requested two separate projects and chats, REEATLAS revamp and Signal-1 revamp, with Astra at Extra High. This handoff applies only to the named project. The user wants substantially more ambitious, useful, technically strong products and stronger demonstrable technical accomplishments. He describes these as quick earlier projects with unrealized potential and reports that GPT-4/GPT-5 helped build them. Treat that attribution as user-reported; inspect the actual implementation rather than infer quality from its age.

The current assignment is a thorough first-principles repository/product audit, original research where useful, and a new project-specific upgrade proposal that improves on this seed. **Do not implement upgrades yet.** The user's final clarification explicitly defers execution. Proceed through analysis and proposal writing without requiring another confirmation for those already requested activities. Preserve source code, manifests, lockfiles, data and models. You may inspect and run existing local checks/the existing app where feasible for an audit, with clearly labelled fixture data and no source modifications; do not deploy, initiate paid services, perform model training or send external messages. Any startup obstacle should be reported precisely, with unaffected analysis continued. Writing the requested audit, research and proposal documents is in scope.

## Equal priorities for the revamp

- More ambitious problem framing and a clear benefit to a real user; challenge the initial concept if a better one is supported.
- Tasteful, distinctive visual design: typography, spacing, density, colour semantics, hierarchy, coherent controls, purposeful motion and carefully handled states.
- Deep, useful 3D interactions and tightly linked views that help someone understand evidence and complete the task.
- Stronger end-to-end workflows: start from a question, load data, explore, compare, decide, save, reopen and export.
- Deeper functionality and real technical/scientific improvement: correct computation, defensible models, data provenance, uncertainty, evaluation and meaningful feedback loops.
- Better execution: reliability, architecture where necessary, persistence, latency/rendering, resource management, accessibility and maintainability.

Design and technical development should inform each other from the beginning. Do not defer the UI until all scientific work is finished. Equally, do not spend the proposal solely on colours and components. The prior first useful version is a suggested entry point, not a ceiling on the ambition of the concept. Describe an ambitious destination and a disciplined path to proving it.

## Required investigation

1. Read repository instructions, inventory the entire tracked repository and inspect all first-party implementation, scripts, tests, configuration and design/product documentation. Include relevant hidden directories and nested applications. Use a coverage table with reviewed, sampled, generated/vendor/binary and unavailable categories. Large datasets, build artifacts and dependencies may be summarized, but do not call that a complete source review. Record the exact commit and any uncommitted changes.
2. Trace the primary workflows across UI, APIs, processing, persistence and external data. Check promises against implementation. Find broken paths, placeholders, hidden defaults, misleading fallbacks, incorrect assumptions, missing feedback loops and architectural limits. Cite paths/lines and distinguish observed bugs from hypotheses. Reproduce important findings when feasible without changing product code.
3. Inspect the current interface in a browser if the existing app can be run safely and locally. Assess actual screens, states, interactions, information density, first-use experience and performance. If not possible, clearly label code-derived UI findings and explain the gap. Do not pretend to have visually inspected it from a README.
4. Reason from the user's decision and the domain constraints. Research primary documentation, relevant scientific methods and existing products/tools. Identify what is already solved, what is missing and why someone would use this project. Verify current APIs/data access/licensing in primary sources before committing an architecture. The research below is a starting point, not an exhaustive literature or competitor review.
5. Challenge this seed proposal. State which recommendations survive, which you would change or drop, which assumptions remain open and which new opportunities materially raise the ceiling. Compare 2–3 coherent directions and recommend one using evidence, tradeoffs and feasibility. Do not inflate scope with disconnected features or claim novelty without a search.
6. Develop a project-specific visual/interaction direction with 2–3 alternatives and a recommended route. Explain the main screen, connected views, direct-manipulation interactions, camera/selection behaviour, state transitions, onboarding, loading/error/empty states and accessibility. Show non-implementation diagrams or static design artifacts where they materially help. No application code or coded prototype at this stage.
7. Specify the technical/scientific upgrade: data contracts, model/computation options, architecture, persistence, jobs, validation, performance and uncertainty. Compare simple baselines to more ambitious options and define what evidence would justify added complexity. Avoid treating a leaderboard score as validation of the entire product.
8. Prioritize an integrated first milestone combining real functionality and the intended interaction experience. Include later ambitious phases, dependencies, expected value, effort/uncertainty ranges and testable exit criteria. Leave expensive choices and unsupported domain assumptions explicit.

## Deliverables for this chat

Create a new `docs/revamp/` set in your assigned checkout (adapt only if existing repository conventions require another clearly identified location):

- `repository-audit.md`: architecture/workflow map, full coverage record, actionable evidence-backed findings, current runtime/UI checks and limitations.
- `research-notes.md`: primary-source links, dates/versions, what each supports, relevant alternatives, dataset/access constraints and open questions.
- `upgrade-proposal.md`: cohesive first-principles vision, target workflow, distinctive value, UI/3D design direction, technical/scientific architecture, meaningful evaluation and demonstrable outcomes. Explicitly compare the new proposal to this seed.
- `implementation-roadmap.md`: prioritized proposed phases and a concrete first milestone with dependencies and acceptance criteria. Mark it proposed; do not execute it.

The final response should give the recommended direction, most consequential findings, most valuable changes to the seed, links to the documents, and only the remaining decisions that materially need the user. Explain conclusions and tradeoffs clearly; do not expose a private reasoning transcript. Stop at the reviewable proposal. These documents are future plans, not completed accomplishments or model/field results.

## Project-specific seed direction

**Proposed decision:** Which hypothesis about a target or protein variant is worth testing next, and what evidence supports or weakens it?

The existing README describes a 3D-first target-to-therapy workbench: WT/mutant, isoform/canonical and PDB/AlphaFold comparisons; five-source resolution; confidence summaries; disease/drug relationships; shared annotations and action histories. The freshly inspected Mol* component loads structures but does not itself implement structural alignment or quantitative comparison. README limitations include incomplete residue-level confidence painting and in-memory story persistence. No trained biological model or validated hypothesis-prioritisation result was established.

The proposal preserves the original target-investigation purpose. [Open Targets already aggregates and scores target-disease evidence](https://platform-docs.opentargets.org/); Signal-1 needs a distinct benefit in comparing structures, tracing reasoning and helping a researcher prepare a reproducible next experiment. The existence of integrations alone does not establish that benefit.

**First useful version:** investigate variants within one protein family or well-defined assay setting chosen with a researcher. Ask whether the system can help prioritize variants for follow-up and explain the evidence behind the ranking. This gives the ML component a measurable task while retaining a broader target-investigation workspace.

Proposed technical sequence:

1. Make biological identity correct: species, UniProt accession, isoform, chain and residue mapping, sequence differences, experimental conditions and structure provenance. Explicitly identify unavailable mutant structures. Implement and verify alignment/local structural comparison before interpreting changes.
2. Put residue-level evidence together: sequence conservation, structure context, known functional/assay observations, prediction outputs and confidence. Distinguish measured observations, model predictions and researcher hypotheses. AlphaFold pLDDT describes structure confidence; it does not directly measure a mutation's functional effect. The [AlphaFold FAQ](https://alphafold.ebi.ac.uk/faq) describes point-mutation limitations.
3. Build an actual variant-effect learning/evaluation component. Start with frozen protein representations and a simple supervised head where the chosen task has enough labels; compare with an appropriate existing sequence-based predictor. Add structure features only after testing their incremental benefit. Predeclare whether the task is prediction within a protein using observed assays or transfer to unseen proteins; use matching evaluation splits.
4. Use a bounded [ProteinGym](https://github.com/OATML-Markslab/ProteinGym) nonclinical assay subset with suitable published baselines. Measure rank correlation and useful-variant recovery at a fixed experiment budget, with uncertainty. For cross-protein claims, separate homologous families and account for known pretraining/benchmark exposure. A variant-effect score is not validation of a therapeutic target or clinical effect.
5. Add a hypothesis record: supporting evidence, contradictory evidence, unknowns, proposed follow-up and later experimental outcome. Persist projects, exact data/model versions and operations so another researcher can reproduce the analysis. Any language-model synthesis must link claims to evidence and retain uncertainty.

**Evidence of success:** a rigorously benchmarked variant module plus researcher-reviewed case studies of investigation quality, time, correct mapping, reproducibility and follow-up usefulness. Product evaluation and ML evaluation answer different questions. Prospective experimental confirmation would strengthen the case; it cannot be inferred from a polished visualization.

**Ambitious demonstration:** a researcher enters a target and variants, compares mapped structures, sees which predictions have experimental support, investigates contradictory evidence and exports a fully traceable experiment brief. The research contribution could concern sequence/structure evidence fusion, calibrated prediction or efficient experimental selection; novelty remains to be assessed.

## Project-specific interaction and audit emphasis

A structure-centred scientific workspace: synchronized protein structure, sequence and evidence selection; isolate domains/residues; linked cameras for appropriate structure comparisons; clear confidence overlays; annotations anchored to residues; saved investigation views; and findings carried into an experiment brief. Clicking a residue should reveal the corresponding evidence without losing context. Distinguish actual observed/predicted structures from any illustrative interpolation or morph animation.

Specific audit questions: verify UniProt accession/species/isoform/chain and residue mapping; auto-pair logic; availability of actual mutant structures; alignment and quantitative comparison; pLDDT/PAE meaning and rendering; source traceability and failure handling; durable stories/projects; background computation and viewer cleanup/versioning. Preserve the original target-to-therapy investigation intent while testing whether a bounded variant-effect task is the best ML entry point. Do not force that pivot if a better supported product direction emerges. Open Targets already provides target prioritisation; identify a distinct advantage. pLDDT is structural confidence, not a mutation-function score. A ProteinGym module result would not establish therapeutic target validity or clinical effect.

## Prior research references

These references were reviewed on 13 September 2026. Re-check current details and deepen the research for this project. No dataset was ingested, benchmark executed, field validation completed or expert contacted in the parent discussion.

- [Open Targets Platform documentation](https://platform-docs.opentargets.org/) — Already provides target-disease evidence aggregation and prioritisation. Proposed Signal-1 differentiation requires investigation/comparison/experimental workflow.
- [AlphaFold DB FAQ](https://alphafold.ebi.ac.uk/faq) — pLDDT is predicted structure confidence; point-mutation interpretation has explicit limitations.
- [ProteinGym official repository](https://github.com/OATML-Markslab/ProteinGym) — Public variant-effect baselines/data/evaluation. A module benchmark, not validation of therapeutic target utility.
- [ProteinGym official site](https://proteingym.org/) — Variant-effect benchmark context; no data download or benchmark execution.

## Evidence provenance and handoff use

`evidence.json` contains only this project's selected preserved GitHub source evidence and project-relevant research references. Original source content and blob identifiers are retained. It is a historical seed; review the actual full checkout independently. The parent audit covered selected implementation files and README material, not every file or a live UI session. New clones match the prior reviewed HEADs.

The parent combined proposal remains at `/Users/feeq/Desktop/pascal_space/wiki/work/portfolio-project-upgrades.md`. The user intent excerpt is at `/Users/feeq/Desktop/pascal_space/sources/research/portfolio-holistic-design-direction-2026-09-13.md`. These are optional read-only context; all relevant project directions are reproduced here. Do not edit Pascal Space shared records from this project chat. Keep your new proposal and findings in your own assigned checkout.

If the chat uses a separate worktree, this handoff is at `/Users/feeq/Desktop/Signal-1 revamp/.revamp-context/HANDOFF.md`, because uncommitted handoff files may not exist in the worktree. Read it by that absolute path. Its instructions describe this user-authorized research task; respect higher-priority instructions and your repository's applicable conventions.
