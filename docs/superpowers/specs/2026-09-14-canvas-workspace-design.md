# Signal 1 — a workspace around the molecule

## First-principles review

The investigator needs to inspect a structure, connect a residue or variant to measurements, then record a hypothesis and an experiment. The former layout instead presents a configuration form, two different “Evidence” sections, a fit control, a long assay plot and a full editing notebook together. Its 330–365 px molecular viewport competes with three columns of text. Below 980 px the selection inspector moves beneath the entire page. Selection can show empty assay values with no immediate route to applicable variants. Finding and panel forms remain expanded even when they are not the current task.

## Direction

Use a persistent, large molecular canvas as the spatial anchor. A restrained light application frame surrounds a charcoal canvas with the existing amber/cyan structure identities. A 64 px navigation rail opens one contextual right panel at a time. At normal desktop sizes the canvas occupies at least two thirds of the working width with details open, and almost all of it with details closed. At narrow widths the canvas remains first; explicitly opened details use an accessible overlay instead of moving below a long page.

The alternatives were enlarging the old dashboard (does not resolve competing tasks) and a step-by-step wizard (hides structure context during reasoning). Choose a canvas with progressive disclosure so users can move freely while keeping the subject visible.

## Workflow and hierarchy

- Header: Signal 1, investigation title/menu, autosave status, Review brief.
- Rail: Explore, Assays, Notebook; Sources and investigation settings are secondary.
- Canvas: KRAS / Binding in context, compact experimental pair legend, Overlay/Split controls, focus and reset, optional distraction-free focus mode. The toolbar and sequence stay visually attached to the canvas.
- Selection: selecting a residue updates linked context. A selection chip exposes details. The details panel prioritizes measured outcomes for a variant, or provides single-substitution choices for a residue. Structure coverage and displacement follow; BLOSUM compatibility is disclosed separately.
- Comparison: structure provenance, fit scope and recalculation live in one panel. Always retain the brief caveat that these are two G12V structures in different binder/nucleotide contexts. No WT/mutant effect implication.
- Assays: collapsible bottom drawer with paired plot, searchable table and displacement. Filters and selection persist while the drawer is closed. No separate competing “Evidence” section. Exact variant match and linked residues stay clear. Keyboard users use the table and displacement controls; plot sampling stays disclosed.
- Notebook: Findings and Experiments tabs, summary-first saved entries with explicit editing disclosure. Current selection is attached when recording a finding. New entries preserve hypothesis/observation, contradictory evidence, controls, rationale, expected observation and repeats. Notebook drafts are scoped to the investigation, so unfinished text never attaches to another investigation.
- Investigation panel: title, research question, switch/new/copy/import and provenance. Reuse proven server/session behavior.

## Interaction and data constraints

Keep the existing schema, scientific calculations, hashes, attribution, import/export, optimistic revisions and job semantics. No dependencies, fake data, trained model, or deployed service are introduced. The scientific object is a protein, so user-facing copy says molecular/protein structure. A residue selection must not silently become a different panel variant. Disabled actions explain their prerequisites. Completed job chatter is removed from the permanent canvas; active/failure status remains visible and actionable. Mol* must resize with the container without disposing its context for panel toggles. Overlay/Split and fit changes still replace contexts safely. Preserve camera across closing UI panels.

All interactive controls have labels and visible focus; drawers and dialogs support Escape and restore focus. Narrow overlays must not trap users or cover their close control. At 390 px no document horizontal overflow. Reduced motion respected. The sequence uses a roving keyboard stop with arrow navigation; selection scrolls into the visible sequence without moving the page.

## Verification

Run existing regression tests, add meaningful tests for new selection summaries and draft scoping, run type/lint/production build. Inspect the real production app in Chrome. Exercise selection via 3D, sequence, exact variant search, assay points/table, and displacement; overlay/split, focus/reset, refit; findings and experiments, switch/reload persistence, all exports and invalid input paths. Check wide/narrow/zoomed layout and focus behavior. Record actual observations and limits in a report. Preserve the user’s saved investigation; use named QA copies for content edits. Leave a running local preview on the existing feature branch; no push or merge.
