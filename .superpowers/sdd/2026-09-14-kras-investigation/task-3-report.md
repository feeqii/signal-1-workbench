# Task 3 implementation report

Implemented the linked KRAS investigation workspace in the task-owned UI files. Replaced the legacy landing hero, actionability score, confidence placeholder and story UI with the warm ivory/forest scientific instrument: compact header, investigation outline, charcoal molecular stage, attached reference sequence, evidence dock, and interpretation inspector. IBM Plex Sans and Mono are local pinned font assets. Responsive layouts stack at narrow widths, controls have visible focus, and animation is suppressed for reduced motion.

## Behaviors

- Loads the complete `/api/case` dataset. Paired assay scatter bounds plotted DOM points to approximately 1,500 evenly sampled observations with an honest displayed count, and includes the selected variant. Full table has search, selected-position filtering and 40-row pagination. Axis labels declare unitless fitness. Displacement profile links back to reference residues.
- Variant selection preserves every substituted position. Sequence supports individual selection and shift-click multiselection. Bundled Mol* 5.11.0 `PluginContext` loads the frozen local mmCIFs, restricts cartoon display to the curated chain, maps reference positions to label coordinates and maps molecular clicks back through the same mapping. A tested column-major transform applies `R @ right + t`. Overlay and split share the left structure's coordinate/camera frame. Explicit focus and reset controls, camera persistence and separate structure colors are present. Scene initialization and disposal are serialized; subscriptions are removed. WebGL failure leaves sequence/assay interactions available.
- The structural description explicitly identifies two experimental G12V structures with distinct nucleotide/binder contexts; it does not describe the fit as a mutation effect. pLDDT/PAE are explicitly unavailable for experimental structures. Coverage, fit count/RMSD/scope/exclusions and selected residue displacement are shown. Prior evidence is distinct from measured abundance and binding with limitations/source links.
- Select/create/resume investigations; edit title/question; serialized autosave with optimistic revision checks, retained drafts, local draft recovery, retry and save-as-new conflict recovery. Saves adopt server-normalized state only when no newer local edits would be overwritten. Navigation to another saved investigation and import flush first.
- Persistent editable researcher findings with kind, claim, supporting variants/positions, contradictory evidence and deletion. Experimental panels include candidates, positive/negative controls, rationale, expected observations, editable repeats and deletion; duplicate variants and invalid repeat counts are rejected.
- Fit scope choices include all shared, outside switch regions 30–38 and 60–76, and selected positions. Durable jobs show status, input revision, cancel/retry, locally recover the pending ID after reload, and attach results only to the matching investigation/revision with no unsaved edits. Completed cached jobs are handled too. Stored result IDs restore their outputs on resume.
- Broad brief preview with Escape/keyboard focus containment, plus save-before-download JSON, Markdown, panel CSV and controller-provided MVSX scene export. Import uses the validated bundle endpoint.

## TDD and checks

Observed failing tests before implementing selection, revision guard, panel edit validation, brief text preservation, transform conversion, serialized draft saving and mapped residue helpers. A subsequent failing normalization test drove adoption of server-returned state. Final command `node --import tsx --test tests/view-state.test.ts tests/investigation-client.test.ts`: **9 passed**. These exercise actual pure state/client behavior, including an in-flight edit followed by a second write against the incremented revision and a failing save that keeps the draft.

Task-owned ESLint files passed with no warnings. Full TypeScript check passed. No dependencies were added. No tests were written for CSS values or framework behavior.

## Verification limits

Actual browser/WebGL interaction, responsive visual inspection, focus behavior and color-vision simulation have **not yet been verified** by this subtask. Controller owns final integrated CUA inspection; the earlier administrator policy issue must not be bypassed with another browser/Playwright. The stated development server at `http://127.0.0.1:4311/` refused a local HTTP probe at the time of this report; no server was started or stopped. API endpoints conform to controller-provided types, but final real API + browser flow verification remains with the controller. The implementation is not represented here as visually verified.

## Files

`src/components/workbench.tsx`, `src/components/molstar-viewer.tsx`, `src/components/investigation/evidence.tsx`, `src/lib/investigation/client.ts`, `src/lib/investigation/view-state.ts`, `src/app/globals.css`, `src/app/layout.tsx`, `tests/view-state.test.ts`, `tests/investigation-client.test.ts`.

## Integrated inspection follow-up

Controller successfully inspected the actual WebGL workspace in CUA at 1440px and the default narrower viewport; both experimental structures rendered. Follow-up corrections:

- Exact trimmed/case-normalized variant queries now rank the exact variant before combination matches, while retaining the selected-position filter and stable ordering of remaining results. A failing regression test preceded the correction.
- Camera persistence now observes Mol*'s `camera.changed` notifications after rendered updates rather than taking early pointer/wheel snapshots. The observer waits for 250ms without further rendered movement, then captures the current snapshot. This covers direct control mutations, explicit Focus selection and reset. Teardown cancels the pending timer and removes the subscription. Tests use the actual bundled Mol* Camera, simulate successive rendered control changes and explicit focus, and verify the final snapshot and disposal behavior. Both new tests were observed failing before implementation.
- Prior method description, detailed limitations and source link are collapsed under a disclosure. The score and the statement “Substitution compatibility, not a prediction of assay outcomes” remain visible.

Targeted UI/client tests now total **12 passing**. Full TypeScript and owned-file ESLint checks pass. Node emits its expected experimental warning for the deterministic MockTimers test API. These follow-up changes await focused controller CUA reinspection; no browser claim is inferred from unit tests.

## Review corrections: linked evidence, transitions, camera reset, SVG titles

- Shared selected positions now highlight every overlapping rendered assay point and table row by default. Exact selected variants retain distinct amber styling; overlapping residue variants use green. The classification regression exercises residue-only selection, exact multi-substitution selection and unrelated variants.
- Open/create/import operations lock the source draft synchronously before saving, keep it locked through asynchronous loading and installation, and make the workspace inert with a visible transition status. Programmatic edit attempts are also rejected while locked. Failed transitions unlock and preserve the original draft. Regression tests reproduce edits attempted both immediately after switching and while the destination is loading, and verify save-before-install and failure recovery. Existing autosave identity guards prevent late source responses from updating a different installed session.
- Molecular view restoration now applies the canonical camera when a saved camera is null, and responds to investigation identity changes independently from scene structure identity. Ordinary selections do not remount the viewport. A regression with the real Mol* Camera verifies null-camera reset and saved-camera restoration.
- Assay SVG titles now receive one template-string child. An actual React server-render test was observed producing an empty title and the React 19 warning before the fix, then the expected variant/measured-value tooltip after the fix.

The four UI/client test files now have **17 passing tests**; scoped ESLint passes. Full TypeScript checking at this point reports only an independently edited controller-owned `tests/support/store-owner.ts:28` optional-call error, communicated to the controller without changing that file. Controller has already verified working WebGL after reload, editable findings/panels, reopening and brief keyboard containment. These latest corrections still require focused CUA reinspection.

## Transition/completed-job race follow-up

Completed calculations now defer every completion side effect while a switch is active, while the source draft is locked, or when the installed investigation is not the job owner. This check precedes recovery-pointer deletion, result display and draft attachment. The completion effect also reruns when transition state clears, so a failed destination load reprocesses the pending job after unlock with the original exact-revision/dirty checks. A successful switch leaves the original investigation's pending-job pointer intact for recovery on reopen.

Two regression tests were observed failing before the disposition guard was implemented. They exercise completion during a failing transition, dirty-state rejection after unlock, successful switching to another investigation, and eligibility on reopening the original. All **19 targeted UI/client tests pass**, along with full TypeScript checking and scoped ESLint.
