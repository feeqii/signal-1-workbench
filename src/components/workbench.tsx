"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { DraftSession, completedJobDisposition, withDraftTransition, request, type CaseData, type ClientJob, } from "@/lib/investigation/client";
import { validateState, type InvestigationState, type SavedInvestigation, type Comparison, type PriorBaseline, } from "@/lib/investigation/schema";
import { briefText, locateTarget, selectPosition, selectVariant, } from "@/lib/investigation/view-state";
import { Evidence } from "@/components/investigation/evidence";
import { cameraSnapshotsEqual } from "@/lib/investigation/camera-persistence";
import { Notebook } from './investigation/notebook';
import { Sequence } from './investigation/sequence';
import { Icon } from './investigation/icons';
import { Dialog } from './investigation/dialog';
import { SelectionPanel, ComparisonPanel, SourcesPanel } from './investigation/context-panels';
type Panel = 'selection' | 'comparison' | 'notebook' | 'sources';
const MolstarViewer = dynamic(() => import("./molstar-viewer").then((m) => m.MolstarViewer), {
    ssr: false,
    loading: () => (<div className="molecular-viewport viewer-loading">
        Starting molecular instrument…
      </div>),
});
const explain = (error: unknown) => error instanceof Error
    ? error.message
    : "The operation could not be completed.";
export function Workbench() {
    const [data, setData] = useState<CaseData | null>(null), [state, setState] = useState<InvestigationState | null>(null), [saved, setSaved] = useState<SavedInvestigation | null>(null), [investigations, setInvestigations] = useState<SavedInvestigation[]>([]);
    const [recoverable, setRecoverable] = useState<InvestigationState | null>(null);
    const [panel, setPanel] = useState<Panel | null>(null);
    const [assaysOpen, setAssaysOpen] = useState(false);
    const [focusMode, setFocusMode] = useState(false);
    useEffect(() => {
        if (!assaysOpen) return;
        const opener = document.activeElement as HTMLElement | null;
        const frame = requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.assay-drawer button')?.focus({preventScroll:true}));
        return () => {
            cancelAnimationFrame(frame);
            requestAnimationFrame(() => {
                if (opener && opener !== document.body && opener !== document.documentElement && opener.isConnected && opener.getClientRects().length && !opener.closest('[inert]')) opener.focus({preventScroll:true});
                else document.querySelector<HTMLButtonElement>('.tool-rail button[aria-label="Open assay explorer"]')?.focus({preventScroll:true});
            });
        };
    }, [assaysOpen]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [quickSearch, setQuickSearch] = useState('');
    const [searchError, setSearchError] = useState('');
    const [narrow, setNarrow] = useState(true);
    const panelRef = useRef<HTMLElement>(null);
    const returnFocus = useRef<HTMLElement | null>(null);
    useEffect(() => {
        const media = window.matchMedia('(max-width: 1100px)');
        setNarrow(media.matches);
        if (!media.matches)
            setPanel('selection');
        const resize = () => setNarrow(media.matches);
        media.addEventListener('change', resize);
        return () => media.removeEventListener('change', resize);
    }, []);
    const panelOpen = !!panel;
    useEffect(() => {
        if (!panelOpen)
            return;
        returnFocus.current = document.activeElement as HTMLElement;
        if (narrow)
            panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
        const listener = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
                setPanel(null);
                requestAnimationFrame(() => returnFocus.current?.focus({ preventScroll: true }));
            }
            if (event.key === 'Tab' && narrow && !document.querySelector('dialog[open]')) {
                const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary') || []).filter(el => el.getClientRects().length);
                const first = items[0], last = items.at(-1);
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                }
                else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        };
        document.addEventListener('keydown', listener);
        return () => document.removeEventListener('keydown', listener);
    }, [panelOpen, narrow]);
    const [transitioning, setTransitioning] = useState(false);
    const session = useRef<DraftSession | null>(null), [saveStatus, setSaveStatus] = useState("Loading case…"), [error, setError] = useState(""), [comparison, setComparison] = useState<Comparison | null>(null), [baseline, setBaseline] = useState<PriorBaseline | null>(null), [job, setJob] = useState<ClientJob | null>(null), [jobNotice, setJobNotice] = useState(""), [working, setWorking] = useState(false);
    useEffect(() => {
        const listener = (event:KeyboardEvent) => {
            if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return;
            if (focusMode) setFocusMode(false);
            else if (!panelOpen) setAssaysOpen(false);
        };
        document.addEventListener('keydown', listener);
        return () => document.removeEventListener('keydown', listener);
    }, [focusMode, panelOpen]);
    const [scope, setScope] = useState('all'), [focus, setFocus] = useState(0), [reset, setReset] = useState(0), [brief, setBrief] = useState(false);
    const refreshList = useCallback(async () => {
        const response = await request<{
            investigations: SavedInvestigation[];
        }>("/api/investigations");
        setInvestigations(response.investigations);
    }, []);
    const install = useCallback(async (value: SavedInvestigation, caseData: CaseData) => {
        session.current = new DraftSession(value);
        setState(value.state);
        setSaved(value);
        setSaveStatus(`Saved · revision ${value.revision}`);
        setError("");
        setJob(null);
        setJobNotice("");
        setComparison(caseData.comparison);
        setScope("all");
        setBaseline(caseData.baseline);
        setRecoverable(null);
        setSearchError('');
        setQuickSearch('');
        try {
            const backup = localStorage.getItem(`signal-draft-${value.id}`);
            if (backup)
                setRecoverable(validateState(JSON.parse(backup), caseData.manifest));
            const pending = localStorage.getItem(`signal-job-${value.id}`);
            if (pending) {
                const pendingJob = await request<ClientJob>(`/api/jobs/${pending}`);
                if (session.current?.saved.id === value.id)
                    setJob(pendingJob);
            }
        }
        catch (error) {
            setJobNotice(`Recovery information: ${explain(error)}`);
        }
        for (const id of [value.state.comparisonJobId, value.state.baselineJobId])
            if (id) {
                try {
                    const restored = await request<ClientJob>(`/api/jobs/${id}`);
                    if (session.current?.saved.id === value.id &&
                        restored.status === "completed" &&
                        restored.result) {
                        if (restored.type === "comparison") {
                            setComparison(restored.result as Comparison);
                            const requested = restored.input.positions as number[] | undefined;
                            setScope(!requested?.length ? 'all' : requested.length === 162 && requested.every(p => !(p >= 30 && p <= 38) && !(p >= 60 && p <= 76)) ? 'core' : 'selected');
                        }
                        else
                            setBaseline(restored.result as PriorBaseline);
                    }
                }
                catch (error) {
                    setJobNotice(`Saved calculation could not be restored: ${explain(error)}`);
                }
            }
    }, []);
    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const [caseData, response] = await Promise.all([
                    request<CaseData>("/api/case"),
                    request<{
                        investigations: SavedInvestigation[];
                    }>("/api/investigations"),
                ]);
                if (!active)
                    return;
                setData(caseData);
                setInvestigations(response.investigations);
                const first = response.investigations[0] ??
                    (await request<SavedInvestigation>("/api/investigations", {
                        method: "POST",
                        body: "{}",
                    }));
                if (active) {
                    await install(first, caseData);
                    await refreshList();
                }
            }
            catch (error) {
                if (active) {
                    setError(explain(error));
                    setSaveStatus("Could not load investigation");
                }
            }
        })();
        return () => {
            active = false;
        };
    }, [install, refreshList]);
    const edit = useCallback((next: InvestigationState) => {
        const current = session.current;
        if (!current)
            return;
        if (!current.edit(next))
            return;
        setState(next);
        setSaveStatus("Unsaved changes");
        try {
            localStorage.setItem(`signal-draft-${current.saved.id}`, JSON.stringify(next));
        }
        catch { }
    }, []);
    const flush = useCallback(async () => {
        const current = session.current;
        if (!current)
            throw new Error("No investigation loaded.");
        setSaveStatus("Saving…");
        try {
            const result = await current.flush();
            if (session.current === current) {
                setSaved(result);
                setState(current.state);
                setSaveStatus(`Saved · revision ${result.revision}`);
                setError("");
                try {
                    localStorage.removeItem(`signal-draft-${result.id}`);
                }
                catch { }
                await refreshList();
            }
            return result;
        }
        catch (error) {
            if (session.current === current) {
                setSaveStatus("Save failed · draft retained");
                setError(explain(error));
            }
            throw error;
        }
    }, [refreshList]);
    useEffect(() => {
        if (!state || !session.current?.dirty)
            return;
        const timer = setTimeout(() => {
            void flush().catch(() => { });
        }, 700);
        return () => clearTimeout(timer);
    }, [state, flush]);
    useEffect(() => {
        const guard = (event: BeforeUnloadEvent) => {
            if (session.current?.dirty) {
                event.preventDefault();
                event.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", guard);
        return () => window.removeEventListener("beforeunload", guard);
    }, []);
    useEffect(() => {
        if (!job)
            return;
        if (job.status === "completed" && job.result) {
            const current = session.current;
            if (!current || transitioning)
                return;
            const disposition = completedJobDisposition(job, current);
            if (disposition === "defer")
                return;
            try {
                localStorage.removeItem(`signal-job-${job.investigationId}`);
            }
            catch { }
            if (disposition === "attached")
                return;
            if (disposition === "attach") {
                if (job.type === "comparison")
                    setComparison(job.result as Comparison);
                else
                    setBaseline(job.result as PriorBaseline);
                edit({
                    ...current.state,
                    [job.type === "comparison" ? "comparisonJobId" : "baselineJobId"]: job.id,
                });
                setJobNotice("Calculation complete · attached to this investigation.");
            }
            else
                setJobNotice("Calculation completed for an earlier revision. Current selection was preserved; run again to attach a current result.");
            return;
        }
        if (job.status === "failed") {
            setJobNotice(job.error || "Calculation failed.");
            return;
        }
        if (!["queued", "running"].includes(job.status))
            return;
        let active = true;
        const timer = setTimeout(async () => {
            try {
                const result = await request<ClientJob>(`/api/jobs/${job.id}`);
                if (active)
                    setJob(result);
            }
            catch (error) {
                if (active) {
                    setJobNotice(explain(error));
                    setJob(null);
                }
            }
        }, 800);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [job, edit, transitioning]);
    async function openInvestigation(id: string) {
        const current = session.current;
        if (!data || !current || current.locked || transitioning)
            return;
        setWorking(true);
        setTransitioning(true);
        try {
            await withDraftTransition(current, () => request<SavedInvestigation>(`/api/investigations/${id}`), value => install(value, data), flush);
        }
        catch (error) {
            setError(explain(error));
        }
        finally {
            setWorking(false);
            setTransitioning(false);
        }
    }
    async function createInvestigation(copy = false) {
        const current = session.current;
        if (!data || !current || current.locked || transitioning)
            return;
        setWorking(true);
        setTransitioning(true);
        try {
            await withDraftTransition(current, () => request<SavedInvestigation>("/api/investigations", {
                method: "POST",
                body: JSON.stringify(copy ? { state: { ...current.state, title: `${current.state.title.slice(0, 113)} (copy)` } } : {}),
            }), async (value) => { await install(value, data); await refreshList(); }, copy ? () => Promise.resolve() : flush);
        }
        catch (error) {
            setError(explain(error));
        }
        finally {
            setWorking(false);
            setTransitioning(false);
        }
    }
    async function run(type: "comparison" | "baseline") {
        const current = session.current;
        if (!current)
            return;
        setWorking(true);
        setJobNotice("");
        try {
            const snapshot = await flush();
            const input = type === "comparison"
                ? {
                    leftId: snapshot.state.view.leftId,
                    rightId: snapshot.state.view.rightId,
                    positions: scope === "selected"
                        ? snapshot.state.selectedPositions
                        : scope === "core"
                            ? Array.from({ length: 188 }, (_, i) => i + 1).filter((p) => !(p >= 30 && p <= 38) && !(p >= 60 && p <= 76))
                            : [],
                }
                : {
                    variants: [
                        ...new Set([
                            ...(snapshot.state.selectedVariant
                                ? [snapshot.state.selectedVariant]
                                : []),
                            ...snapshot.state.panel.map((p) => p.variant),
                        ]),
                    ],
                };
            if (type === "baseline" &&
                !(input as {
                    variants?: string[];
                }).variants?.length)
                throw new Error("Select a variant or add variants to the panel first.");
            if (scope === "selected" &&
                type === "comparison" &&
                snapshot.state.selectedPositions.length < 3)
                throw new Error("Select at least three shared residues for a selected-residue fit.");
            const result = await request<ClientJob>("/api/jobs", {
                method: "POST",
                body: JSON.stringify({
                    investigationId: snapshot.id,
                    inputRevision: snapshot.revision,
                    type,
                    input,
                }),
            });
            if (session.current === current) {
                try {
                    localStorage.setItem(`signal-job-${snapshot.id}`, result.id);
                }
                catch { }
                setJob(result);
            }
        }
        catch (error) {
            setJobNotice(explain(error));
        }
        finally {
            setWorking(false);
        }
    }
    async function exportSaved(format: "json" | "md" | "csv" | "mvsx") {
        try {
            const snapshot = await flush();
            const anchor = document.createElement("a");
            anchor.href = `/api/investigations/${snapshot.id}/export?format=${format}`;
            anchor.download = "";
            anchor.click();
        }
        catch (error) {
            setError(explain(error));
        }
    }
    async function importFile(file?: File) {
        const current = session.current;
        if (!file || !data || !current || current.locked || transitioning)
            return;
        setWorking(true);
        setTransitioning(true);
        try {
            await withDraftTransition(current, async () => request<SavedInvestigation>("/api/investigations/import", {
                method: "POST", body: await file.text(),
            }), async (value) => { await install(value, data); await refreshList(); }, flush);
        }
        catch (error) {
            setError(explain(error));
        }
        finally {
            setWorking(false);
            setTransitioning(false);
        }
    }
    function chooseVariant(variant: string) {
        if (!data || !session.current)
            return;
        try {
            edit(selectVariant(session.current.state, variant, data.manifest.reference.sequence));
            setPanel("selection");
            setError("");
        }
        catch (error) {
            setError(explain(error));
        }
    }
    function choosePosition(position: number) {
        if (session.current)
            edit(selectPosition(session.current.state, position));
    }
    if (!data || !state || !saved || !comparison || !baseline)
        return (<main className="boot">
        <span className="brand-mark">S1</span>
        <h1>Signal / investigation</h1>
        <p role="status">{saveStatus}</p>
        {error && <p role="alert">{error}</p>}
        <button onClick={() => window.location.reload()}>Retry loading</button>
      </main>);
    const { manifest } = data, structures = manifest.structures.filter((s) => [state.view.leftId, state.view.rightId].includes(s.id)), busy = working || (!!job && ["queued", "running"].includes(job.status));
    const setCamera = (camera: NonNullable<InvestigationState["view"]["camera"]>) => {
        const current = session.current?.state;
        if (current &&
            !cameraSnapshotsEqual(camera, current.view.camera))
            edit({ ...current, view: { ...current.view, camera } });
    };
    const selectionLabel = state.selectedVariant || (state.selectedPositions.length === 1
        ? `${manifest.reference.sequence[state.selectedPositions[0] - 1]}${state.selectedPositions[0]}`
        : state.selectedPositions.length ? `${state.selectedPositions.length} residues` : 'No selection');
    const closePanel = () => { setPanel(null); requestAnimationFrame(() => returnFocus.current?.focus({ preventScroll: true })); };
    const openPanel = (value: Panel) => { setFocusMode(false); setPanel(panel === value ? null : value); };
    const activeJob = !!job && ['queued', 'running'].includes(job.status);
    const panelTitle = panel === 'comparison' ? 'Compare structures' : panel === 'notebook' ? 'Research notebook' : panel === 'sources' ? 'Sources & methods' : 'Selection details';
    const jobStatus = (job || jobNotice) && <div className={`job-status ${job?.status === 'failed' ? 'job-error' : ''}`} role="status"><div><strong>{job ? `${job.type === 'comparison' ? 'Structure alignment' : 'Substitution prior'} · ${job.status}` : 'Calculation update'}</strong><span>{jobNotice}</span></div>{activeJob ? <button onClick={() => void request<ClientJob>(`/api/jobs/${job!.id}`, { method: 'DELETE' }).then(setJob).catch(e => setJobNotice(explain(e)))}>Cancel</button> : <button disabled={working} onClick={() => void run(job?.type || 'comparison')}>Run again</button>}</div>;
    return (<main className={`instrument ${focusMode ? 'focus-mode' : ''}`}>
      <header className="topbar" inert={narrow && !!panel && !focusMode}>
        <button className="brand" aria-label="Open investigation settings" onClick={() => setSettingsOpen(true)}><span className="brand-mark"><Icon name="molecule" width="23" height="23"/></span><span>signal<span className="brand-one">1</span></span></button>
        <span className="header-divider"/>
        <button className="investigation-picker" onClick={() => setSettingsOpen(true)}><span className="eyebrow">INVESTIGATION</span><span>{state.title}<Icon name="down" width="14"/></span></button>
        <div className="top-actions"><span className="save-status" role="status" title={saveStatus}><i className={saveStatus.startsWith('Saved') ? 'saved-dot' : 'saving-dot'}/><span>{saveStatus.startsWith('Saved') ? 'All changes saved' : saveStatus}</span></span><button className="brief-button" onClick={() => setBrief(true)}>Review brief <Icon name="arrow" width="16"/></button></div>
      </header>
      {recoverable && <div className="error-banner"><span>A local unsaved draft is available.</span><button onClick={() => { edit(recoverable); setRecoverable(null); }}>Restore local draft</button><button onClick={() => { try {
        localStorage.removeItem(`signal-draft-${saved.id}`);
    }
    catch { } setRecoverable(null); }}>Keep saved version</button></div>}
      {error && <div className="error-banner" role="alert"><span>{error} Local edits are retained.</span><button onClick={() => void flush().catch(() => { })}>Retry save</button><button onClick={() => void createInvestigation(true)}>Save as new investigation</button></div>}
      {transitioning && <div className="transition-banner" role="status">Opening investigation…</div>}
      <div className={`workspace ${panel && !focusMode ? 'has-panel' : ''}`} aria-busy={transitioning}>
        <nav className="tool-rail" aria-label="Workspace tools" inert={transitioning || (narrow && !!panel && !focusMode)}>
          <div className="rail-primary">
            <button aria-label="Explore structure" aria-pressed={panel === 'selection' && !focusMode} onClick={() => openPanel('selection')}><Icon name="molecule"/><span>Explore</span></button>
            <button aria-label="Compare structures" aria-pressed={panel === 'comparison' && !focusMode} onClick={() => openPanel('comparison')}><Icon name="compare"/><span>Compare</span></button>
            <button aria-label="Open assay explorer" aria-expanded={assaysOpen && !focusMode} onClick={() => { setFocusMode(false); setAssaysOpen(!assaysOpen); }}><Icon name="assays"/><span>Assays</span></button>
            <button aria-label="Open research notebook" aria-pressed={panel === 'notebook' && !focusMode} onClick={() => openPanel('notebook')}><Icon name="notebook"/><span>Notebook</span>{(state.findings.length + state.panel.length) > 0 && <i className="rail-count">{state.findings.length + state.panel.length}</i>}</button>
          </div>
          <div className="rail-secondary"><button aria-label="Sources and methods" aria-pressed={panel === 'sources' && !focusMode} onClick={() => openPanel('sources')}><Icon name="sources"/><span>Sources</span></button><button aria-label="Investigation settings" onClick={() => setSettingsOpen(true)}><Icon name="settings"/><span>Settings</span></button></div>
        </nav>
        <section className="canvas-workspace" inert={transitioning || (narrow && !!panel && !focusMode)}>
          <section className="molecular-stage" aria-label="Linked molecular workspace">
            <div className="canvas-heading"><div className="canvas-title"><span className="eyebrow">HUMAN · P01116-2</span><h1>KRAS<span>Binding in context</span></h1></div><form className="canvas-search" onSubmit={e => { e.preventDefault(); try {
        const next = locateTarget(session.current!.state, quickSearch, manifest.reference.sequence);
        edit(next);
        setPanel('selection');
        setSearchError('');
    }
    catch (error) {
        setSearchError(explain(error));
    } }}><Icon name="search" width="16"/><input aria-label="Find variant or residue" value={quickSearch} onChange={e => setQuickSearch(e.target.value)} placeholder="Find G12D or residue 61"/><button aria-label="Find selection" type="submit"><Icon name="arrow" width="16"/></button></form></div>
            {searchError && <div className="search-error" role="alert">{searchError}</div>}
            <div className="scene-context"><div className="pair-legend"><span><i className="structure-dot orange"/>5O2S <small>K27 · GDP</small></span><span><i className="structure-dot cyan"/>5O2T <small>K55 · GTPγS</small></span></div><span className="scene-caveat">G12V in both structures · different binding contexts</span></div>
            <div className={`viewport-grid ${state.view.mode}`}>
              {state.view.mode === 'overlay' ? <MolstarViewer key="overlay" investigationId={saved.id} structures={structures} frameStructure={manifest.structures.find(s => s.id === comparison.leftId)!} comparison={comparison} positions={state.selectedPositions} camera={state.view.camera} onCamera={setCamera} onPosition={choosePosition} focus={focus} reset={reset}/> : structures.map(s => <div className="split-scene" key={s.id}><span className="split-label"><i className={`structure-dot ${s.id === comparison.leftId ? 'orange' : 'cyan'}`}/>{s.pdbId}</span><MolstarViewer investigationId={saved.id} structures={[s]} frameStructure={manifest.structures.find(s => s.id === comparison.leftId)!} comparison={comparison} positions={state.selectedPositions} camera={state.view.camera} onCamera={setCamera} onPosition={choosePosition} focus={focus} reset={reset}/></div>)}
            </div>
            <div className="canvas-selection"><button className="selection-chip" onClick={() => { setFocusMode(false); setPanel('selection'); }}><span className="selection-indicator"/><span><small>{state.selectedVariant ? 'VARIANT' : 'SELECTION'}</small><strong className="mono">{selectionLabel}</strong></span><Icon name="chevron" width="16"/></button><span className="canvas-hint">Drag to rotate · Scroll to zoom · Click a residue</span></div>
            <div className="canvas-toolbar"><div className="view-toggle" aria-label="Structure view"><button aria-pressed={state.view.mode === 'overlay'} onClick={() => edit({ ...state, view: { ...state.view, mode: 'overlay', camera: state.view.mode === 'overlay' ? state.view.camera : null } })}><Icon name="layers" width="15"/>Overlay</button><button aria-pressed={state.view.mode === 'split'} onClick={() => edit({ ...state, view: { ...state.view, mode: 'split', camera: state.view.mode === 'split' ? state.view.camera : null } })}>Split</button></div><div className="camera-tools"><button title="Focus selected residues" disabled={!state.selectedPositions.length} onClick={() => setFocus(v => v + 1)}><Icon name="focus" width="17"/><span>Focus selection</span></button><button title="Reset camera" aria-label="Reset camera" onClick={() => { edit({ ...state, view: { ...state.view, camera: null } }); setReset(v => v + 1); }}><Icon name="reset" width="17"/></button><button title={focusMode ? 'Exit focus mode' : 'Expand molecular view'} aria-label={focusMode ? 'Exit focus mode' : 'Expand molecular view'} aria-pressed={focusMode} onClick={() => setFocusMode(!focusMode)}><Icon name={focusMode ? 'close' : 'expand'} width="17"/></button></div><button className="fit-summary" onClick={() => { setFocusMode(false); setPanel('comparison'); }}><span className="mono">{comparison.rmsd.toFixed(3)} Å</span><span>RMSD</span><Icon name="chevron" width="14"/></button></div>
          </section>
          {!focusMode && <Sequence sequence={manifest.reference.sequence} structures={structures} state={state} onChange={edit}/>}
          {(activeJob || job?.status === 'failed' || (jobNotice && !job)) && jobStatus}
          <div className="assay-drawer" hidden={!assaysOpen || focusMode}><Evidence key={saved.id} observations={data.observations} comparison={comparison} selectedVariant={state.selectedVariant} positions={state.selectedPositions} onVariant={chooseVariant} onPosition={choosePosition} onClose={() => setAssaysOpen(false)}/></div>
          {!focusMode && !assaysOpen && <button className="assay-launcher" aria-label="Open assay explorer" onClick={() => setAssaysOpen(true)}><span><Icon name="assays" width="17"/><strong>Assay explorer</strong><span className="launcher-caption">Connect structure to measured outcomes</span></span><span><span className="mono">{data.observations.length.toLocaleString()} variants</span><Icon name="plus" width="16"/></span></button>}
        </section>
        {panel && !focusMode && narrow && <button className="panel-scrim" aria-label="Close details panel" onClick={closePanel} tabIndex={-1}/>}
        <aside ref={panelRef} className="context-panel" hidden={!panel || focusMode} inert={transitioning} role={narrow && panel && !focusMode ? 'dialog' : undefined} aria-modal={narrow && !!panel && !focusMode ? true : undefined} aria-label={panelTitle}><header className="context-heading"><span>{panelTitle}</span><button className="icon-button" aria-label="Close details panel" onClick={closePanel}><Icon name="close" width="17"/></button></header><div className="context-scroll"><div hidden={panel !== 'selection'}><SelectionPanel data={data} state={state} comparison={comparison} baseline={baseline} onVariant={chooseVariant} onNotebook={() => setPanel('notebook')} onAssays={() => { setAssaysOpen(true); if (narrow)
        setPanel(null); }} onPrior={() => void run('baseline')} busy={busy}/></div><div hidden={panel !== 'comparison'}><ComparisonPanel data={data} comparison={comparison} scope={scope} onScope={setScope} onRun={() => void run('comparison')} busy={busy}/>{jobStatus}</div><div hidden={panel !== 'notebook'}><Notebook key={saved.id} investigationId={saved.id} state={state} sequence={manifest.reference.sequence} onChange={edit} onVariant={chooseVariant}/></div><div hidden={panel !== 'sources'}><SourcesPanel data={data}/></div></div></aside>
      </div>
      {settingsOpen && <Dialog title="Your investigation" onClose={() => setSettingsOpen(false)}><div className="settings-grid" inert={transitioning}><section><label>Saved investigations<select value={saved.id} disabled={working} onChange={e => void openInvestigation(e.target.value)}>{investigations.map(i => <option key={i.id} value={i.id}>{i.state.title}</option>)}</select></label><label>Title<input value={state.title} maxLength={120} onChange={e => edit({ ...state, title: e.target.value })}/></label><label>Research question<textarea value={state.question} maxLength={2000} onChange={e => edit({ ...state, question: e.target.value })}/></label><div className="dialog-actions"><button className="primary" disabled={working} onClick={() => void createInvestigation()}>New investigation</button><button disabled={working} onClick={() => void createInvestigation(true)}>Make a copy</button></div></section><section className="settings-import"><Icon name="sources" width="24" height="24"/><h3>Continue from an export</h3><p className="caption">Import an investigation bundle to restore its findings, experiment plan and reproducible calculations.</p><label>Import investigation JSON<input type="file" accept=".json,application/json" disabled={working} onChange={e => void importFile(e.target.files?.[0])}/></label><p className="caption">Saved locally on this computer. Source files and revisions are preserved with your work.</p></section></div></Dialog>}
      {brief && <Dialog title="Investigation brief" onClose={() => setBrief(false)}><p className="caption">Your recorded reasoning, supporting selections, and experiment plan.</p><pre className="brief-text">{briefText(state)}</pre><div className="brief-actions"><button className="primary" onClick={() => void exportSaved('md')}>Export Markdown brief</button><button onClick={() => void exportSaved('csv')}>Export panel CSV</button><button onClick={() => void exportSaved('json')}>Export reproducibility JSON</button><button onClick={() => void exportSaved('mvsx')}>3D scene (.mvsx)</button></div><p className="caption">Exports include the saved revision, provenance and calculation context.</p></Dialog>}
    </main>);
}
