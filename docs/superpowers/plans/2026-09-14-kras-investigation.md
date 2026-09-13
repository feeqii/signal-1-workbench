# KRAS Investigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Track completed steps below.

**Goal:** Deliver the local single-researcher KRAS investigation described in the approved revamp: measured paired assays, mapped structural comparison, linked selection, durable findings and panels, and reproducible export.

**Architecture:** Retain Next/React and bundle a pinned Mol* viewer. Use a local embedded PostgreSQL instance through PGlite for durable revisions/jobs, immutable local case assets, and a Python scientific worker. This is a local app with one server process, not a hosted team service.

**Tech Stack:** Next 15, React 19, TypeScript, Zod, PGlite, Mol*, Python with NumPy/Gemmi, Node test runner through tsx.

**Spec:** ../../revamp/upgrade-proposal.md and ../../revamp/implementation-roadmap.md (case gate and M1 only).

## Global Constraints

- Exact KRAS reference: UniProt P01116-2, taxon 9606, length 188, sequence SHA256 9a0ed04ef46e15865a90f9dd0808d7d12c94746c66b0f41228aa2e62516ccbca.
- Real source measurements only. Synthetic data are limited to fault and geometry tests.
- Measured evidence, computed comparisons, prior-model output and researcher hypotheses remain visibly distinct.
- Unsupported mutation classes, reference mismatches, missing coverage and missing mutant structures produce explicit diagnostics.
- No new model training, paid services, deployment, messaging others or simultaneous collaborative editing.
- Source hashes and reuse attribution travel with exports. Imports accept only the bounded supported case and verify hashes.
- Local single-server operation; no cloud or authentication claim. Server writes reject cross-origin requests and oversized bodies.
- Existing legacy-static files remain historical reference. The old score and fake comparison modes are removed from the active experience.
- Browser policy restrictions must be respected. Missing browser or expert validation is a release limitation, never a claimed pass.

## Task 1: Curated case and scientific comparison

**Files:** Create scientific/{requirements.txt,case_data.py,compare.py,baseline.py,worker.py}, scientific/tests/, scripts/curate-case.py, public/case/kras/*, docs/revamp/kras-case.md.

**Interfaces:** Produces public/case/kras/manifest.json, observations.json, structures with atom mapping JSON, comparison.json, baseline.json, source assets. Manifest schema below is shared with Task 2 and 3.

```ts
type CaseManifest = {
 schemaVersion: 1; id: "kras-k55"; title: string; question: string;
 reference: { accession: "P01116"; isoform: "P01116-2"; taxon: 9606; sequence: string; sequenceHash: string };
 assays: { id: string; name: string; description: string; units: string; direction: string; sourceUrl: string }[];
 structures: { id: string; title: string; pdbId: string; chainId: string; url: string; sha256: string; mappingUrl: string; method: string; context: string; coverage: number[] }[];
 assets: { path: string; sha256: string; bytes: number; sourceUrl: string; license: string }[];
 provenance: { source: string; url: string; retrievedAt: string; license: string }[];
 limitations: string[];
};
type Observation = { variant: string; positions: number[]; abundance: number|null; binding: number|null };
type ResidueMapping = { referencePosition: number; referenceAA: string; labelChain: string; authChain: string; labelSeq: number|null; authSeq: number; insertionCode: string; observedAA: string; ca: [number,number,number]|null };
type Comparison = { schemaVersion: 1; leftId: string; rightId: string; kind: string; atom: "CA"; units: "angstrom"; count: number; rmsd: number; coverage: number; rotation: number[][]; translation: number[]; positions: number[]; displacements: {position:number;distance:number}[]; exclusions: string[]; fitScope: string; inputHashes: string[]; algorithm: string };
type PriorBaseline = { name:string; version:string; sourceUrl:string; description:string; limitations:string[]; scores:{variant:string;score:number}[] };
```

- [ ] Write scientific tests before implementation: wrong reference AA, conflicting substitutions, duplicate aliases, underdetermined/collinear fits, missing residues and rigid-transform RMSD below 0.001 Å. Include at least 30 expected mapping cases spanning six edge classes and label expectations as software fixtures unless externally reviewed.
- [ ] Run `python -m unittest discover -s scientific/tests -v` and capture expected missing-behavior failure.
- [ ] Fetch and freeze original public paired KRAS abundance and DARPin K55 measurements with attribution. Verify full reference equality, sequence hashes, duplicate/paired overlap and measurement meaning; record absent replicate/error information. Reconcile DOI against original paper. Do not invent values if an upstream is unavailable.
- [ ] Select and freeze two actual structures. Resolve mmCIF chain/entity/author/label identities and use source mapping/sequence validation. Record construct mutations, ligands, unresolved positions and context differences. These are descriptive comparisons, not mutation causality.
- [ ] Implement rigid Cα superposition with proper rotation and explicit correspondence/fit mask; compare actual pair against Gemmi or an independent implementation. Store rotation for column-vector convention: `mapped = rotation @ right + translation`.
- [ ] Implement a reproducible BLOSUM62 substitution prior using the published matrix with citation; label it substitution compatibility, not abundance/binding prediction or newly trained model. It is the small supported baseline inference for M1.
- [ ] Worker CLI reads one JSON request on stdin and writes one JSON result on stdout: `{"type":"comparison","leftId": "...","rightId":"...","positions":[...]}` or `{"type":"baseline","variants":["G12D"]}`. IDs restricted to curated manifest; stderr for diagnostics; no arbitrary filenames/URLs.
- [ ] Run focused tests and full scientific suite. Commit task-owned files and report evidence, gaps and hashes.

## Task 2: Validated state, durable storage, jobs and exports

**Files:** Create src/lib/investigation/{schema.ts,case.ts,store.ts,jobs.ts,export.ts}, src/app/api/investigations/**, src/app/api/jobs/**, tests/*.test.ts, scripts/run-jobs.ts; modify package.json, lockfile, .gitignore, next.config.ts.

**Interfaces:** `GET/POST /api/investigations`; `GET/PUT /api/investigations/:id` where PUT supplies expectedRevision; `GET /api/investigations/:id/export`; `POST /api/investigations/import`; `POST /api/jobs`; `GET/DELETE /api/jobs/:id`. Return JSON {error} with useful messages for 400/404/409/413.

```ts
type InvestigationState = {
 schemaVersion:1; caseId:"kras-k55"; referenceHash:string; title:string; question:string;
 selectedPositions:number[]; selectedVariant:string|null;
 view:{mode:"overlay"|"split"; leftId:string;rightId:string;camera:Record<string,unknown>|null};
 findings:{id:string;title:string;claim:string;kind:"hypothesis"|"observation";evidenceVariants:string[];positions:number[];contradictoryEvidence:string}[];
 panel:{variant:string;role:"candidate"|"positive-control"|"negative-control";rationale:string;expectedObservation:string;replicates:number}[];
 comparisonJobId:string|null; baselineJobId:string|null;
};
type SavedInvestigation = {id:string;revision:number;createdAt:string;updatedAt:string;state:InvestigationState};
```

- [ ] Add failing Node tests for variant validation, sorted/deduplicated reference selections, snapshot validation, optimistic revision conflict, restart persistence, export/import integrity, lease recovery, cancellation and stale finalization.
- [ ] Install pinned runtime/test dependencies; set `test: tsx --test tests/*.test.ts`, `lint: eslint src tests scripts --ignore-pattern public/vendor`.
- [ ] Implement strict bounded schemas; validate every residue/variant against the frozen reference and every view ID against manifest. Missing numerical evidence stays null. Validate confidence arrays independently with bounds and dimensions.
- [ ] Use local persistent PGlite under ignored .signal1/data; schema migrations create investigations, revisions and jobs. Content hashes use canonical JSON; transactions guarantee revision and save atomicity. Missing/corrupt assets fail explicitly.
- [ ] Implement deterministic job input keys, queued/running/completed/failed/cancelled states, leases, attempts capped at 3, subprocess deadline, cancellation and token-checked atomic finalization. A standalone worker polls claimed jobs; API may trigger one bounded execution in local mode. Job inputs include investigation revision and exact asset hashes; UI only applies matching jobs.
- [ ] Export a bounded JSON bundle containing state, reference, source manifest, results and small supported assets plus hashes. Import verifies every included byte/hash, reference and schema and rejects unsupported/path-traversal assets. Generate a Markdown experiment brief and CSV panel from saved state.
- [ ] Disable obsolete public socket/story mutation surfaces in local investigation mode and remove old active workbench references.
- [ ] Run Node tests and fresh-process storage/worker checks. Commit task-owned files and report.

## Task 3: Complete linked molecular workspace

**Files:** Replace src/components/workbench.tsx, src/components/molstar-viewer.tsx, src/app/globals.css; create src/components/investigation/* and src/lib/investigation/client.ts; modify layout.tsx; create tests/view-state.test.ts and component tests as needed.

**Interfaces:** Consumes Task 1 manifest/observations/comparison/baseline and Task 2 API/state types. Only the controller integrates package/dependency changes. Uses bundled pinned Mol* and local font assets.

- [ ] Test pure selection, stale job matching, panel editing and export/brief behavior before implementation. For reversible presentational styling, verify through rendered inspection rather than mirroring CSS in tests.
- [ ] Implement warm ivory/charcoal/forest workspace: compact header, investigation rail, central dark molecular stage, attached sequence track, evidence dock, right inspector. Use local IBM Plex Sans/Mono with restrained serif editorial title. Desktop three-column, narrow stacked layout, visible keyboard focus and reduced motion.
- [ ] Load the real case with clear source/date context. No giant landing hero and no actionability score. Present paired assay table and plot with axes/units; selection of a variant selects all substitution positions in sequence and mapped 3D.
- [ ] Bundle/pin Mol*, one instance per viewport, serialize load updates, unsubscribe/dispose at teardown. Use mapped loci and reverse click mapping. Apply validated right-structure transform in overlay; split shares the fitted coordinate frame. Explicit camera focus and persist/recover camera.
- [ ] Display numerical comparison count/RMSD/scope/exclusions and displacement by reference residue. Provide fit scope controls with durable computation status, cancel/retry and input-revision checks.
- [ ] Inspector shows measured values with source links, substitution prior with limitations and researcher-authored findings. Coverage and absent confidence are explicit. No fabricated pLDDT/PAE for experimental structures.
- [ ] Create/edit question; select/resume investigation; autosave with visible saved/error/conflict states; keep edits on failure. Create/delete findings; add candidates and positive/negative controls, rationale, expected observations and repeats. Export JSON/Markdown/CSV and import validated bundle.
- [ ] Verify integration against real API, tests, typecheck, lint and browser if permitted. Commit task-owned files and report limits honestly.

## Task 4: Integration, CI and release evidence

**Files:** README.md, .env.example, .github/workflows/checks.yml, docs/revamp/implementation-status.md, tests/integration fixtures and focused regression tests.

- [ ] Run full build/typecheck/lint/Node/scientific tests and fix failures with regression cases.
- [ ] Exercise local production API create/edit/conflict/job/cancel/save/restart/export/import using actual persisted data.
- [ ] Inspect browser via permitted CUA only. Verify linked selection, keyboard/narrow layout and lifecycle where available; retain explicit unverified status if browser policy blocks access.
- [ ] Run independent code review, fix important findings and recheck affected behavior.
- [ ] Document exact start/setup/worker/test commands, data provenance and supported limits. Add CI for application/science checks. Report each M1 gate as passed, partial or awaiting external validation; do not claim expert review or browser performance without evidence.
- [ ] Leave a reviewable feature branch and a runnable local app; do not push, merge or deploy without instruction.
