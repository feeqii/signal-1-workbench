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
| M1.6 linked views | Implemented and under final production browser verification; automated selection identity tests included. |
| M1.7 missing/stale confidence | Pass for local case: experimental confidence unavailable, null preserved; dimensions validated and stale jobs guarded. No live AlphaFold provider claim. |
| M1.8 evidence distinctions | Implemented: measured assay fitness, descriptive structure statistic, published prior and authored claim separately labeled with sources. Formal 20-item domain review remains pending. |
| M1.9 experimental brief | Software workflow exercised with candidates, WT control, repeats, expected observations and contradictory evidence. Domain reviewer approval remains pending. |
| M1.10 durable round trip | Actual API and fresh-process tests pass; final production camera/scene verification pending below. |
| M1.11 job recovery | Pass: idempotency, cancellation/late finalization, repeated failures, expired leases and forced-process recovery tested. Recurring application worker needs no provider. |
| M1.12 accessibility | Named controls, visible focus, sequence/table alternatives, keyboard brief trap implemented. Final narrow/keyboard check below; dedicated screen-reader audit not completed. |
| M1.13 lifecycle/performance | Final browser cycle check below. Instrumented GPU/heap/worker growth, p95 selection/reopen latency and 30fps targets on a declared laptop workload are not yet established. |
| M1.14 prior provenance | Pass: pinned published BLOSUM62 matrix and source/license, known-entry tests, additive combinations and explicit non-predictive limitations. |
| M1.15 release checks | Node/scientific tests, lint/typecheck/build and production API CI are configured. Local final results below; remote CI has not run because no push was requested. |

## Independent reviews

Scientific specification and implementation reviewed and approved. Backend review identified and then approved fixes for recurring recovery, incompatible job links, database ownership and exact provenance hashes. UI review identified linked evidence highlighting, transition edit preservation, default camera restoration, and SVG tooltip rendering; fixes and scoped re-review are in progress.

## Final production checks

Pending final production build, API run and browser verification. This section will be updated with observed results rather than inferred passes.
