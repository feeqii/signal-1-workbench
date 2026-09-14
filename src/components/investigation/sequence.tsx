'use client';
import { useEffect, useRef, useState } from 'react';
import type { CaseManifest, InvestigationState } from '@/lib/investigation/schema';
export function Sequence({ sequence, structures, state, onChange }: {
    sequence: string;
    structures: CaseManifest['structures'];
    state: InvestigationState;
    onChange: (state: InvestigationState) => void;
}) {
    const track = useRef<HTMLDivElement>(null);
    const selectionKey = state.selectedPositions.join(',');
    const [cursorState, setCursorState] = useState({ selectionKey, position: state.selectedPositions[0] || 1 });
    const cursor = cursorState.selectionKey === selectionKey ? cursorState.position : state.selectedPositions[0] || 1;
    const setCursor = (position: number) => setCursorState({ selectionKey, position });
    useEffect(() => {
        const position = state.selectedPositions[0];
        if (!position || !track.current)
            return;
        const item = track.current.querySelector<HTMLButtonElement>(`[data-position="${position}"]`);
        if (item) {
            const x = item.offsetLeft - track.current.offsetLeft;
            if (x < track.current.scrollLeft || x + item.offsetWidth > track.current.scrollLeft + track.current.clientWidth)
                track.current.scrollTo({ left: Math.max(0, x - track.current.clientWidth / 2) });
        }
    }, [state.selectedPositions]);
    function select(position: number, additive: boolean) {
        const positions = additive
            ? state.selectedPositions.includes(position)
                ? state.selectedPositions.filter(p => p !== position)
                : [...state.selectedPositions, position].sort((a, b) => a - b)
            : [position];
        onChange({ ...state, selectedVariant: null, selectedPositions: positions });
    }
    return <section className="sequence-section" aria-label="Reference sequence">
    <div className="sequence-heading"><span><strong>Sequence</strong> <span className="mono">P01116-2 · 188 aa</span></span><span className="sequence-help">Arrows to navigate · Shift-click to select several</span><button className="text-button" disabled={!state.selectedPositions.length} onClick={() => onChange({ ...state, selectedVariant: null, selectedPositions: [] })}>Clear selection</button></div>
    <div className="sequence-track" ref={track}>
      {sequence.split('').map((aa, i) => <button type="button" key={i} data-position={i + 1} tabIndex={cursor === i + 1 ? 0 : -1} className={`${state.selectedPositions.includes(i + 1) ? 'selected ' : ''}${structures.every(s => s.coverage.includes(i + 1)) ? '' : 'unresolved'}`} aria-label={`Reference residue ${aa}${i + 1}`} aria-pressed={state.selectedPositions.includes(i + 1)} title={`${aa}${i + 1} · ${structures.map(s => `${s.pdbId}: ${s.coverage.includes(i + 1) ? 'resolved' : 'unresolved'}`).join('; ')}`} onFocus={() => setCursor(i + 1)} onClick={e => select(i + 1, e.shiftKey)} onKeyDown={e => {
                const next = e.key === 'ArrowRight' ? Math.min(sequence.length, i + 2) : e.key === 'ArrowLeft' ? Math.max(1, i) : e.key === 'Home' ? 1 : e.key === 'End' ? sequence.length : null;
                if (next !== null) {
                    e.preventDefault();
                    setCursor(next);
                    track.current?.querySelector<HTMLButtonElement>(`[data-position="${next}"]`)?.focus({ preventScroll: true });
                    const item = track.current?.querySelector<HTMLButtonElement>(`[data-position="${next}"]`);
                    if (item && track.current)
                        track.current.scrollTo({ left: Math.max(0, item.offsetLeft - track.current.offsetLeft - track.current.clientWidth / 2) });
                }
            }}><small>{i === 0 || (i + 1) % 10 === 0 ? i + 1 : ' '}</small>{aa}</button>)}
    </div>
    <div className="sequence-regions"><span className="region-label">Jump to</span><button onClick={() => onChange({ ...state, selectedVariant: null, selectedPositions: Array.from({ length: 9 }, (_, i) => 30 + i) })}>Switch I <span>30–38</span></button><button onClick={() => onChange({ ...state, selectedVariant: null, selectedPositions: Array.from({ length: 17 }, (_, i) => 60 + i) })}>Switch II <span>60–76</span></button><span className="sequence-unresolved">Striped residues: absent from one or both structures</span></div>
  </section>;
}
