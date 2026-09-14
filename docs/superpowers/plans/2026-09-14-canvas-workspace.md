# Canvas Workspace Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for isolated components and review. Steps use checkboxes for tracking.

**Goal:** Replace the crowded KRAS dashboard with a cohesive interface centered on the molecular canvas.

**Architecture:** Keep durable investigation state and calculations in Workbench. Extract focused notebook and sequence components; present contextual panels and a collapsible assay drawer around the persistent molecular stage. Use existing React/Next/Mol* with authored CSS.

**Tech Stack:** React 19, Next 15, TypeScript, Mol* 5.11, existing PGlite backend.

**Spec:** `docs/superpowers/specs/2026-09-14-canvas-workspace-design.md`

## Global Constraints

- Existing scientific contracts, saved schema, autosave/recovery, imports/exports and real case data stay intact.
- No new dependencies. Sources in the parent project are read-only.
- Work in the existing `codex/kras-investigation` linked worktree; no push, merge, deployment or data deletion.
- Keep science caveats concise and accessible; no assay prediction or isolated mutation-effect claims.
- User authorized the complete reversible redesign and extensive Chrome testing. Continue without another approval cycle.

### Task 1: Assay drawer content

**Files:** Modify `src/components/investigation/evidence.tsx`; optional `src/components/investigation/evidence.css` imported by the component; `tests/evidence-render.test.ts`.

**Interfaces:** Preserve all existing Evidence props; add optional `onClose?: () => void`. Parent controls drawer visibility using `hidden` so filters persist. Evidence fills a bounded 310–360 px drawer; internal content can scroll.

- [x] Rename heading to “Assay explorer”, retain Paired assays / Variant table / Displacement. Provide a labeled Close assays control when onClose exists.
- [x] Reorganize compact heading/filter/content; keyboard tab navigation, explicit empty results, exact variant search, selected-residue filtering, paired sampling disclosure. Use type=button and descriptive labels. No unsupported clinical or causal interpretation.
- [x] Keep real click selection callbacks and numeric formatting. Add a concise selected variant readout beside the plot when available. Preserve existing <title> tooltips. Do not force 1,500 SVG points into the tab order.
- [x] Verify meaningful SSR evidence tests and lint; root handles browser interaction validation.

### Task 2: Focused notebook

**Files:** Create `src/components/investigation/notebook.tsx`; optional component CSS.

**Interfaces:** `Notebook({ investigationId, state, onChange, onVariant })` where state is InvestigationState, onChange(next: InvestigationState): void, onVariant(variant: string): void. Component is mounted with key=investigationId and hidden by its parent when not active; local unfinished forms cannot cross investigations. It may import addPanelVariant/editPanel from view-state and the reference sequence via a required `sequence: string` prop.

- [x] Findings/Experiments tabs show counts and compact, expandable saved entries. An explicit New finding form exposes title, kind, claim, contradictory evidence and a visible attachment summary. Add with current selection; edit/delete existing findings using onChange. Keep sensible empty states.
- [x] Experiment builder exposes variant, role, validation feedback, rationale, expected observation and repeats; starts from current selectedVariant or an empty input, never silently G12D for a residue-only selection. Use real helpers, inline errors and disabled/explained empty actions. Existing variants are editable; duplicate validation is visible.
- [x] Retain all rich existing schema fields. Local errors stay inside the notebook. No API calls and no global CSS edits; root handles dialog and layout.
- [x] Verify type/lint and report UI contract, root handles interaction tests.

### Task 3: Molecular shell, contextual panels and sequence

**Files:** Modify `src/components/workbench.tsx`, `src/app/globals.css`, `src/components/molstar-viewer.tsx`; create focused sequence, icon, dialog, and context-panel components as needed. Add behavior tests only where new selection logic warrants them.

- [x] Retain Workbench’s proven data/session/job code while replacing presentation and removing obsolete notebook form state.
- [x] Introduce explicit UI state for active panel, assay drawer and focus mode; panel contents depend on current selection and task. Provide header investigation switch, rail, canvas toolbar and one cohesive context panel.
- [x] Use responsive full-height layout, large viewport and compact sequence. Preserve molecular canvas while opening/closing panels. Recompute renderer size through ResizeObserver if Mol* requires it.
- [x] Add residue→single substitution discovery, clear selection, region shortcuts and keyboard sequence navigation; distinguish variant data from residue context and original G12V structures.
- [x] Use shared accessible dialog behavior for settings/brief/narrow details, focus restoration and Escape. Keep active/failure jobs visible with cancellation/retry; completed jobs visible only in relevant details.
- [x] Integrate Task 1 and 2, preserve import/export and source descriptions.

### Task 4: Review, iterate and test extensively in Chrome

**Files:** `docs/revamp/ui-review-2026-09-14.md` and any necessary fixes.

- [x] Run full application suite, lint, type checking and production build; use a dedicated QA investigation copy for editable flow testing.
- [ ] Inspect Chrome desktop layout and exercise 3D rotation/click, sequence, region shortcut, variant search/table/plot, displacement, focus/reset, overlay/split and refits.
- [ ] Exercise notebook create/edit, panel controls/validation, revisions/reload/switch, JSON/Markdown/CSV/MVSX exports. Check keyboard dialog focus/Escape, narrow layout and browser zoom.
- [x] Dispatch independent spec/code review, fix meaningful issues and recheck changed behavior.
- [ ] Record observed results and limitations; commit completed changes and leave the redesigned preview open in Chrome.

Observed coverage and the Mac-unlock limitation are recorded in `docs/revamp/ui-review-2026-09-14.md`; the remaining broad checklist entries are not claimed as fully covered.
