'use client';
import { useMemo } from 'react';
import type { CaseData } from '@/lib/investigation/client';
import type { Comparison, InvestigationState, PriorBaseline } from '@/lib/investigation/schema';
import { Icon } from './icons';
export function SelectionPanel({ data, state, comparison, baseline, onVariant, onNotebook, onAssays, onPrior, busy }: {
    data: CaseData;
    state: InvestigationState;
    comparison: Comparison;
    baseline: PriorBaseline;
    onVariant: (variant: string) => void;
    onNotebook: () => void;
    onAssays: () => void;
    onPrior: () => void;
    busy: boolean;
}) {
    const selected = useMemo(() => data.observations.find(o => o.variant === state.selectedVariant), [data.observations, state.selectedVariant]);
    const singles = useMemo(() => data.observations.filter(o => o.positions.length === 1 && state.selectedPositions.includes(o.positions[0]) && !o.variant.includes(':')).slice(0, state.selectedPositions.length === 1 ? 19 : 12), [data.observations, state.selectedPositions]);
    const prior = baseline.scores.find(s => s.variant === state.selectedVariant);
    const title = state.selectedVariant || (state.selectedPositions.length === 1 ? `${data.manifest.reference.sequence[state.selectedPositions[0] - 1]}${state.selectedPositions[0]}` : state.selectedPositions.length ? `${state.selectedPositions.length} residues` : 'Explore KRAS');
    return <div className="selection-panel">
    <section className="selection-identity"><span className="eyebrow">{state.selectedVariant ? 'Selected variant' : state.selectedPositions.length ? 'Reference selection' : 'Start an investigation'}</span><h2 className="selection-name">{title}</h2><p>{state.selectedVariant ? `Reference ${state.selectedPositions.length ? `position${state.selectedPositions.length > 1 ? 's' : ''} ${state.selectedPositions.join(', ')}` : 'sequence'} · P01116-2` : state.selectedPositions.length ? 'Inspect the structure, then compare substitutions at this position.' : 'Select a residue on the protein or search for a variant to connect structure with measurements.'}</p></section>
    {!state.selectedPositions.length && !state.selectedVariant && <section className="panel-section"><h3>Start with a variant</h3><div className="suggestion-buttons">{['G12D', 'G12V', 'Q61H'].map(v => <button key={v} className="mono" onClick={() => onVariant(v)}>{v}<Icon name="arrow" width="15"/></button>)}</div><p className="caption">Shortcuts into the curated dataset.</p></section>}
    {state.selectedVariant && <section className="panel-section"><div className="section-title"><h3>Measured outcomes</h3><span className="subtle-badge">Yeast assays</span></div><div className="measure"><span>Abundance</span><strong>{selected?.abundance?.toFixed(3) ?? '—'}</strong></div><div className="measure"><span>K55 binding</span><strong>{selected?.binding?.toFixed(3) ?? '—'}</strong></div><p className="caption">Unitless fitness. Higher values indicate better performance in each assay. {selected ? 'A dash means not measured.' : 'This variant has no row in the curated paired dataset.'}</p><button className="panel-link" onClick={onAssays}>Compare in assay explorer <Icon name="arrow" width="16"/></button></section>}
    {!state.selectedVariant && state.selectedPositions.length > 0 && <section className="panel-section"><div className="section-title"><h3>Explore substitutions</h3><span className="subtle-badge">Measured</span></div><p className="caption">Choose a variant to see abundance and binding values.</p>{state.selectedPositions.length > 1 && <p className="caption">First 12 single substitutions shown. Use the assay explorer to filter all variants at your selected residues.</p>}<div className="variant-choices">{singles.map(o => <button key={o.variant} className="mono" onClick={() => onVariant(o.variant)}>{o.variant}</button>)}</div>{!singles.length && <p className="empty-message">No measured single substitutions at these positions.</p>}<button className="panel-link" onClick={onAssays}>Open all assay variants <Icon name="arrow" width="16"/></button></section>}
    {state.selectedPositions.length > 0 && <section className="panel-section"><h3>Structural context</h3><div className="coverage-list">{state.selectedPositions.map(p => <div key={p}><strong className="mono">{data.manifest.reference.sequence[p - 1]}{p}</strong><span>{data.manifest.structures.every(s => s.coverage.includes(p)) ? 'In both structures' : data.manifest.structures.some(s => s.coverage.includes(p)) ? 'Partial coverage' : 'Unresolved'}</span><span className="mono">{comparison.displacements.find(d => d.position === p)?.distance.toFixed(2) ?? '—'} Å</span></div>)}</div><p className="caption">Cα displacement after the declared fit. Both experimental structures carry G12V; selecting a variant does not change their coordinates.</p></section>}
    {state.selectedVariant && <section className="panel-section"><details className="advanced-detail"><summary>Substitution compatibility <span className="mono">{prior?.score ?? '—'}</span></summary><p className="caption">BLOSUM62 prior. Compatibility of the substitution, not a prediction of binding or abundance.</p><p className="caption">{baseline.description}</p><button disabled={busy} onClick={onPrior}>Calculate selected / panel priors</button><p className="caption">{baseline.limitations.join(' ')}</p><a href={baseline.sourceUrl} target="_blank" rel="noreferrer">Method source ↗</a></details></section>}
    <section className="panel-section next-step"><span className="eyebrow">Next step</span><h3>Turn evidence into a question.</h3><p className="caption">Record what you observe, note competing explanations, and choose a follow-up experiment.</p><button className="primary" onClick={onNotebook}><Icon name="notebook" width="17"/> Open research notebook</button></section>
  </div>;
}
export function ComparisonPanel({ data, comparison, scope, onScope, onRun, busy }: {
    data: CaseData;
    comparison: Comparison;
    scope: string;
    onScope: (scope: string) => void;
    onRun: () => void;
    busy: boolean;
}) {
    return <><section className="panel-section"><span className="eyebrow">Descriptive structure comparison</span><h2>Two binding contexts</h2><p className="caption">Both structures carry G12V. The binder and nucleotide differ, so this pair does not isolate a mutation effect.</p></section>
    <section className="panel-section structure-pair">{data.manifest.structures.map((s, i) => <article key={s.id}><div className="section-title"><a className="structure-reference" href={`https://www.rcsb.org/structure/${s.pdbId}`} target="_blank" rel="noreferrer"><i className={`structure-dot ${i === 0 ? 'orange' : 'cyan'}`}/>{s.pdbId} ↗</a><span className="subtle-badge">Chain {s.chainId}</span></div><h3>{i === 0 ? 'DARPin K27 · GDP' : 'DARPin K55 · GTPγS'}</h3><span className="caption">KRAS G12V · {s.coverage.length}/188 residues resolved</span><details><summary>Experimental details</summary><p className="caption">{s.context}</p><p className="caption">{s.method} · SHA-256 <span className="hash">{s.sha256}</span></p></details></article>)}</section>
    <section className="panel-section"><div className="section-title"><h3>Alignment</h3><span className="subtle-badge">Cα atoms</span></div><div className="alignment-result"><strong>{comparison.rmsd.toFixed(3)}<small>Å RMSD</small></strong><span>{comparison.count} matched atoms<br />{(comparison.coverage * 100).toFixed(1)}% reference coverage</span></div><label>Fit scope<select value={scope} onChange={e => onScope(e.target.value)}><option value="all">All shared residues</option><option value="core">Outside switches · 30–38 / 60–76</option><option value="selected">Selected residues</option></select></label>{scope === 'selected' && <p className="caption">Select at least three shared residues with Shift-click.</p>}<button className="primary" disabled={busy} onClick={onRun}><Icon name="compare" width="16"/> Recalculate fit</button><details className="advanced-detail"><summary>Scope & exclusions</summary><p>{comparison.fitScope}</p><p className="caption">{comparison.algorithm} · {comparison.kind}</p>{comparison.exclusions.map((x, i) => <p className="caption" key={i}>{x}</p>)}</details></section>
    <section className="panel-section"><h3>Uncertainty</h3><p className="caption">These are experimental X-ray structures. Prediction confidence measures pLDDT and PAE are unavailable. Resolution and missing residues are recorded in the source details.</p></section></>;
}
export function SourcesPanel({ data }: {
    data: CaseData;
}) {
    return <><section className="panel-section"><span className="eyebrow">Provenance</span><h2>Evidence you can trace.</h2><p className="caption">Frozen source files, reference numbering and explicit limitations travel with each export.</p></section><section className="panel-section">{data.manifest.provenance.map((p, i) => <article className="source-item" key={i}><a href={p.url} target="_blank" rel="noreferrer">{p.source} ↗</a><p className="caption">{p.license} · Retrieved {p.retrievedAt.slice(0, 10)}</p></article>)}</section><section className="panel-section"><h3>Assay methods</h3>{data.manifest.assays.map(a => <details className="advanced-detail" key={a.id}><summary>{a.name}</summary><p>{a.description}</p><p className="caption">{a.direction} · {a.units}</p><a href={a.sourceUrl} target="_blank" rel="noreferrer">Assay source ↗</a></details>)}</section><section className="panel-section"><h3>Case limitations</h3>{data.manifest.limitations.map((l, i) => <p className="limitation" key={i}>{l}</p>)}</section></>;
}
