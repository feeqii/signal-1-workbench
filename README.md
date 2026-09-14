# Signal 1 · KRAS investigation

A local research workspace linking measured KRAS abundance and DARPin K55 binding assays to experimental structures, findings, and an experimental panel. This branch implements the first bounded investigation workflow from the approved revamp.

## Run locally

Requires Node.js 22 and Python 3.12 or newer on macOS or Linux. The database ownership lock uses POSIX `flock`; native Windows is not supported. Use one server per data directory.

```sh
npm ci --ignore-scripts
python3 -m venv .venv
.venv/bin/python -m pip install -r scientific/requirements.txt
npm run dev
```

Open [Signal 1](http://127.0.0.1:3000). For a production build, stop the development server, run `npm run build`, then `npm start`. Both commands bind to loopback. Do not expose this unauthenticated local app to a network.

The application owns an embedded PostgreSQL database through PGlite in `.signal1/data`. No PostgreSQL server or Docker setup is needed. Investigations, revisions, and calculation jobs survive process restarts. A recurring worker inside the application claims queued jobs and recovers expired leases; `npm run jobs` can request an immediate drain from an already running app. Python workers are stateless and do not open the database.

Optional settings are listed in `.env.example`: `SIGNAL1_DATA_DIR`, `SIGNAL1_PYTHON`, and `SIGNAL1_URL` for command-line checks. Set these in the process environment; helper scripts do not load `.env` files. For an alternate port, use `npm run dev -- --port 4311` or `npm start -- --port 4311`.

## Research workflow

1. Open or create an investigation and edit the research question.
2. Select a variant in the paired assay plot or searchable table. Its substitutions link to the reference sequence and mapped 3D structure. Sequence and structure clicks select reference residues.
3. Inspect experimental coverage, the fitted overlay/split view, and per-residue displacement. Recalculate a fit over all shared residues or a selected region.
4. Record observations or hypotheses with contradictory evidence. Add candidate variants and explicit positive/negative controls, rationale, expected observations, and repeats.
5. Review the brief and export the saved investigation. Import a JSON bundle to reopen an independently identified copy.

Edits autosave with revision checking. A failed save retains the local draft; conflicts require explicit recovery rather than silently overwriting another view.

## Evidence and boundaries

- Exact reference: UniProt **P01116-2**, 188 residues.
- **27,813** measured variants across the two ProteinGym v1.3 curated Weng assays; **23,072** have both readouts. Missing values remain missing. Fitness scores are not abundance concentrations or binding affinities.
- Experimental structures **5O2S / 5O2T**, chain A, both **G12V** with different binders, nucleotides, and crystal contexts. The full fit uses **164 Cα pairs**, RMSD **1.507623 Å**. This is a descriptive structural comparison, not an isolated mutation effect.
- BLOSUM62 is a published substitution compatibility prior, including an explicitly additive combination score. It is not a new trained model or a prediction of either assay. No model training is included.
- Experimental X-ray structures do not have AlphaFold pLDDT/PAE; the interface states their absence.
- Original replicate-level Supplementary Table 4 was not ingested. Replicate errors, statistical significance, expert biological approval, and prospective experimental usefulness are not claimed.

See [case provenance](docs/revamp/kras-case.md), the frozen [manifest](public/case/kras/manifest.json), and [implementation evidence](docs/revamp/implementation-status.md). All supported case assets are local and checksum-verified; investigation use needs no live scientific data service.

## Export formats

- **JSON**: saved state, complete source manifest, original and derived assets with hashes, and referenced completed calculations. Import validates the exact bounded case, checks every byte, and recomputes archived results before restoring new investigation/job identities.
- **Markdown**: research brief with evidence boundaries and provenance.
- **CSV**: experiment panel; spreadsheet formula prefixes are escaped.
- **MVSX**: portable MolViewSpec archive with both mmCIFs, fitted overlay, mapped residue colors, camera when saved, and coordinate attribution. A split workspace exports an overlay. Findings and measurements are carried by the separate JSON bundle.

## Verify

```sh
npm test
.venv/bin/python -m unittest discover -s scientific/tests -v
npm run lint
npm run typecheck
npm run build
```

With the application running against a disposable verification data directory:

```sh
SIGNAL1_URL=http://127.0.0.1:3000 node scripts/verify-api.mjs
```

The API check creates test investigations, validates revision conflicts and actual calculations, and exports/imports the full bundle. CI runs the application and scientific checks plus this production API workflow. Offline case regeneration is available through `.venv/bin/python scripts/curate-case.py`; it uses frozen source files and does not fetch replacements.

## Implementation map

- `src/components/workbench.tsx` and `components/investigation/`: linked research UI.
- `src/components/molstar-viewer.tsx`: pinned Mol* scene lifecycle, mappings, and camera.
- `src/lib/investigation/`: schemas, case validation, revisions, jobs, exports, and client save coordination.
- `scientific/`: validated residue correspondence, rigid comparison, and published substitution prior.
- `public/case/kras/`: immutable supported scientific case with attribution.
- `scripts/verify-api.mjs` and `.github/workflows/checks.yml`: integration checks.

The previous generic target resolver, temporary story sharing, and socket collaboration endpoints are retired in this workflow. Historical adapters and `legacy-static` remain reference material. Hosted collaboration, authentication, additional proteins, general structure uploads, trained predictors, and deployment are outside this implementation.
