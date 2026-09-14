# KRAS implementation evidence

Updated 14 September 2026. This report records implementation evidence separately from the proposed M1 research/release gates. The local workflow is implemented; external biological validation and a complete hardware performance study remain pending.

## Scope and architecture

One local researcher, exact KRAS P01116-2 reference, the paired ProteinGym v1.3 abundance/K55 case, two experimental structures, durable research state, bounded scientific jobs, and reproducible exports. Next/React and pinned Mol* render local assets; one application process owns PGlite PostgreSQL. Python runs stateless calculations. No new model training, generic uploaded structures, hosted collaboration or deployment is included.

All parent project `sources/` files and the original checkout are preserved. Implementation lives on `codex/kras-investigation` in the sibling `signal-1-implementation` worktree.

## Verified scientific evidence

- 27,813 union variants; 26,012 abundance, 24,873 binding, 23,072 paired, 2,940 abundance-only and 1,801 binding-only. All complete source mutated sequences match reconstructed P01116-2 substitutions; no duplicate aliases are accepted.
- Reference sequence SHA-256: `9a0ed04ef46e15865a90f9dd0808d7d12c94746c66b0f41228aa2e62516ccbca`.
- Actual 5O2S/5O2T chain A fit: 164 shared Cα pairs, RMSD 1.5076231048929027 Å; independent Gemmi result differs by 3.46e-14 Å. Missing residues are excluded with full-reference coverage stated.
- Seventeen scientific tests pass, including 60 mapping fixtures in six edge classes, degenerate/reflection fits, actual mmCIF identity, variant validation and frozen data reconstruction. These are software fixtures, not an expert-approved gold set.
- Original replicate-level measurements/errors were not ingested. Both structures carry G12V, different nucleotide/binder/crystal contexts and truncated constructs. The 5O2T deposited-title discrepancy is disclosed.

## Reliability and workflow evidence

Automated tests cover revision conflicts, saves while edits arrive, draft recovery, bounded validation, reference mismatch, source tampering, exact job hash sets, cancellation, lease replacement, stale finalization, selection/transform mapping, camera persistence and research panel/brief content.

A separate Node process was forcibly killed after committing two research revisions and claiming a job. A fresh process recovered the exact saved state and both revisions, reclaimed the abandoned job with a new lease token, and retained its identity. Concurrent ownership and ownership after the short-lived lock helper exits are also tested. The lock file is never unlinked.

Actual local API verification has exercised case loading, create/save, HTTP 409 conflicts, comparison idempotency, 164-residue scientific computation, full bundle export and independently identified import with recomputation. An application restart recovered the exact saved investigation and job reference. The retained `scripts/verify-api.mjs` repeats this workflow against a running disposable database.

CUA browser inspection has rendered the actual gold/cyan Mol* overlay at 1440×1000, linked sequence and variant selection, created a candidate and WT control with repeats/rationale, added a finding with contradictory evidence, reopened saved state, and inspected the generated brief. The brief traps keyboard focus and closes with Escape. Additional production checks are recorded below when complete.

## M1 gate assessment

| Gate | Evidence / remaining requirement |
|---|---|
| M1.1 reference identity | Pass: exact accession/isoform/taxon/sequence/hash, full mutated sequence equality. |
| M1.2 invalid input | Pass for the supported substitution case: invalid reference, position, aliases, conflicts and mutation classes rejected. General isoform/upload support is outside scope. |
| M1.3 reviewed mappings | Partial: 60 software mapping fixtures and actual-coordinate checks pass. Independent expert gold-set approval remains pending. |
| M1.4 valid comparison scope | Supported case passes: distinct bounded structures, both G12V, explicit context. Generic WT/mutant modes and resolver retired. EGFR/1IVO is not a supported case. |
| M1.5 numerical comparison | Pass: correspondences, fit mask, transform, count, coverage, units, exclusions, rigid and degenerate controls, independent actual-pair result. |
| M1.6 linked views | Pass for the supported case: variant/table selection, keyboard Q61 selection and direct 3D picking (mapped residue 40) verified. Residue highlights have automated identity coverage. |
| M1.7 missing/stale confidence | Pass for local case: experimental confidence unavailable, null preserved; dimensions validated and stale jobs guarded. No live AlphaFold provider claim. |
| M1.8 evidence distinctions | Implemented: measured assay fitness, descriptive structure statistic, published prior and authored claim separately labeled with sources. Formal 20-item domain review remains pending. |
| M1.9 experimental brief | Software workflow exercised with candidates, WT control, repeats, expected observations and contradictory evidence. Domain reviewer approval remains pending. |
| M1.10 durable round trip | Pass on the local runtime: actual API, fresh-process recovery, focused camera reopen and portable scene hashes verified; final fit transitions and baseline inference also pass. Cross-platform numerical bit equality has not been checked. |
| M1.11 job recovery | Pass: idempotency, cancellation/late finalization, repeated failures, expired leases and forced-process recovery tested. Recurring application worker needs no provider. |
| M1.12 accessibility | Named controls, visible focus, sequence/table alternatives, keyboard brief trap implemented. 390px layout has no page overflow; narrow brief/export and keyboard focus/Escape checked. Dedicated screen-reader and actual 200% browser zoom audits are not completed. |
| M1.13 lifecycle/performance | Twenty split/overlay cycles retained two/one canvas elements respectively with no visible errors. A separate transform-change test found a lost-canvas-context bug, fixed by replacing the canvas when the validated scene changes. Instrumented GPU/heap/worker growth, p95 selection/reopen latency and 30fps targets on a declared laptop workload are not yet established. |
| M1.14 prior provenance | Pass: pinned published BLOSUM62 matrix and source/license, known-entry tests, additive combinations and explicit non-predictive limitations. |
| M1.15 release checks | Local tests, lint/typecheck, production build and actual production API workflow and cancellation/retry pass; CI is configured. Remote CI has not run because no push was requested. |

## Independent reviews

Scientific specification and implementation reviewed and approved. Backend review identified and then approved fixes for recurring recovery, incompatible job links, database ownership and exact provenance hashes. UI review identified linked evidence highlighting, transition edit preservation, default camera restoration, and SVG tooltip rendering; all fixes and scoped re-reviews are approved. Final integration review additionally caught copied calculation ownership, imported camera validation and initial source integrity gaps; all were fixed with regression tests and approved. Browser testing caught camera JSONB ordering and canvas reuse issues; both fixes were reviewed.

## Final production checks

- Full application suite: 52 tests passed. Scientific suite: 17 tests passed. Lint, TypeScript and Next production build passed; initial page JavaScript 143 kB before the lazy molecular bundle.
- Runtime: Node 22.22.0, Python 3.14.6 on this macOS host; CI declares Node 22 and Python 3.12. NumPy 2.4.3, Biopython 1.86, Gemmi 0.7.5, Mol* 5.11.0 and PGlite 0.5.8 are pinned.
- Actual production API: case/create/save/conflict, idempotent comparison, independent editable copy, JSON/Markdown/CSV/MVSX export, full import and recomputed results passed through the retained verification script.
- Actual production cancellation/retry: cancellation returned cancelled; retry reused the same job identity and completed with the expected three BLOSUM scores. The clean preview completed its own G12D baseline calculation.
- Camera: actual focused view saved and reopened; saved revision stayed unchanged over a six-second idle check. The earlier JSONB field-order save loop is fixed using value equality and avoiding redundant Mol* camera updates.
- Scene: extracted both coordinate assets from the MVSX zip and matched their manifest SHA-256 values; verified CC0/source attribution and exact saved position/target in the scene document.
- Browser: 1440×1000 desktop, 390×844 narrow layout with document width 390, keyboard residue selection, direct 3D residue picking, exact variant search, finding and panel authoring, brief focus trap/Escape and keyboard export checked through CUA. Temporary viewport overrides are reset for delivery.
- Browser lifecycle: 20 complete split/overlay cycles gave exactly two/one canvases after each load and no visible errors. This is a DOM/resource-use smoke check, not a GPU or heap leak proof, p95 latency benchmark, or camera frame-rate claim.
- Transform-change regression passed in the final production build: outside-switch fit (138 Cα, 0.438 Å RMSD) followed by all/shared, outside-switch and all/shared fits retained one working canvas each time. Research records generated during testing are preserved separately under ignored `.signal1/verification-data-2026-09-14`; the delivered default workspace is clean.

The local implementation is ready for researcher review. It does not satisfy the external expert, prospective utility, complete accessibility or instrumented hardware performance gates by itself. Imports recompute and compare results exactly on the installed runtime; portability across differing numerical platforms remains unverified.
