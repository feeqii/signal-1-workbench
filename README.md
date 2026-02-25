# Signal-1: 3D-First Target Workbench

Signal-1 is a 3D-first biology interface for target triage. The goal is simple: keep structural evidence, confidence signals, and therapy context in one decision surface so teams can move from "what changed?" to "is this target actionable?" faster.

This repo is the baseline implementation.

## Problem We Are Solving

Modern target evaluation is fragmented:

- Structure interpretation happens in one tool, target/disease/drug context in others.
- WT vs mutant, isoform vs canonical, and PDB vs AlphaFold comparisons are manual and slow.
- Confidence data (pLDDT/PAE) is often hidden behind separate files or workflows.
- Collaboration is ephemeral; analysis steps are not consistently reproducible or shareable.

Result: high context-switching cost, slower decisions, and weaker traceability.

## Baseline Solution In This Repo

Signal-1 ships a working, open-source-first baseline with these capabilities:

### 1. 3D-first workspace with Mol*
- Mol* is the center of the UI, not a side panel.
- Structures can be loaded as a pair for direct visual comparison.
- Scene reload and structure switching are first-class actions.

### 2. Live compare modes
- `WT vs mutant`
- `Isoform vs canonical`
- `Experimental PDB vs AlphaFold`
- Default compare pairs are automatically selected from resolved target metadata.

### 3. Confidence storytelling
- AlphaFold `pLDDT` and `PAE` payloads are fetched and summarized in the UI.
- Parsing runs in a Web Worker (`public/workers/confidence.worker.js`) to keep the main thread responsive.
- The workbench exposes confidence rollups (mean pLDDT, high/low-confidence residues, PAE mean/max).

### 4. Target-to-therapy context in-session
- Disease associations and drug context are shown in a target-centric graph.
- Node selection is interactive and tracked as part of the analysis record.

### 5. Collab + playback story
- Key actions are recorded as timestamped events (`target-loaded`, `mode-changed`, `annotation-added`, etc.).
- Stories are shareable by URL.
- Multi-user cursors + residue annotation sync run over WebSocket rooms.

### 6. Open-source data integration through one adapter layer
- `UniProt` for canonical protein identity and metadata
- `RCSB` for experimental structure metadata
- `AlphaFold DB` for predicted structures and confidence documents
- `Open Targets` for target-disease-drug evidence
- `ChEMBL` for mechanism-linked compounds

All upstreams are normalized via a single BFF endpoint: `GET /api/resolve?gene=...`

## Why This Is Useful

This baseline compresses the triage loop into one place:

- Faster structural reasoning: compare modes and confidence overlays are immediate.
- Better translational context: disease and drug evidence stays adjacent to structure analysis.
- Higher reproducibility: analysis becomes a shareable story instead of a screenshot trail.
- Easier evolution: adapter-based architecture isolates upstream API churn from the UI.

## Architecture

- Frontend: `Next.js` (App Router), `React`, `Tailwind CSS`
- 3D rendering: `Mol*` loaded in-browser
- BFF/API normalization: Next route handlers in `src/app/api/*`
- Realtime channel: `Socket.IO` at `src/pages/api/socket.ts`
- Caching: in-memory by default, optional Redis REST via `src/lib/cache.ts`
- Background compute: worker-based confidence parsing

## Key Files

- `src/components/workbench.tsx`: main 3D-first product surface
- `src/components/molstar-viewer.tsx`: Mol* bootstrapping + structure loading
- `src/components/therapy-graph.tsx`: target-disease-drug graph UI
- `src/app/api/resolve/route.ts`: open-data adapter/orchestration endpoint
- `src/app/api/story/route.ts`: story share/load API
- `src/pages/api/socket.ts`: collaboration transport
- `public/workers/confidence.worker.js`: pLDDT/PAE summarization

## Run Locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Optional Environment Variables

- `REDIS_REST_URL`: Redis REST endpoint for shared cache
- `REDIS_REST_TOKEN`: Redis REST token
- `ALPHAFOLD_API_BASE`: override AlphaFold adapter base URL

## Current Baseline Boundaries

- Story persistence is in-memory (process-local); not durable across restarts.
- Authn/authz and role-based collaboration controls are not yet implemented.
- No server-side job queue yet for heavy structural pre-processing.
- Confidence is currently surfaced as numeric storytelling, not residue heatmap painting in-viewer.

## API Change Resilience Notes

- AlphaFold access goes through an adapter with legacy fallback support.
- Open Targets and other external payloads are normalized before reaching UI components.
- This architecture is designed so upstream API/version changes can be handled in one place.
