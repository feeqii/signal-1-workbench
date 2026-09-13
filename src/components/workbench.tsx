"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DraftSession,
  completedJobDisposition,
  withDraftTransition,
  request,
  type CaseData,
  type ClientJob,
} from "@/lib/investigation/client";
import {
  validateState,
  type InvestigationState,
  type SavedInvestigation,
  type Comparison,
  type PriorBaseline,
} from "@/lib/investigation/schema";
import {
  addPanelVariant,
  briefText,
  editPanel,
  selectPosition,
  selectVariant,
} from "@/lib/investigation/view-state";
import { Evidence } from "@/components/investigation/evidence";
const MolstarViewer = dynamic(
  () => import("./molstar-viewer").then((m) => m.MolstarViewer),
  {
    ssr: false,
    loading: () => (
      <div className="molecular-viewport viewer-loading">
        Starting molecular instrument…
      </div>
    ),
  },
);
const explain = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "The operation could not be completed.";
export function Workbench() {
  const [data, setData] = useState<CaseData | null>(null),
    [state, setState] = useState<InvestigationState | null>(null),
    [saved, setSaved] = useState<SavedInvestigation | null>(null),
    [investigations, setInvestigations] = useState<SavedInvestigation[]>([]);
  const [recoverable, setRecoverable] = useState<InvestigationState | null>(
    null,
  );
  const briefRef = useRef<HTMLElement>(null);
  const [transitioning, setTransitioning] = useState(false);
  const session = useRef<DraftSession | null>(null),
    [saveStatus, setSaveStatus] = useState("Loading case…"),
    [error, setError] = useState(""),
    [comparison, setComparison] = useState<Comparison | null>(null),
    [baseline, setBaseline] = useState<PriorBaseline | null>(null),
    [job, setJob] = useState<ClientJob | null>(null),
    [jobNotice, setJobNotice] = useState(""),
    [working, setWorking] = useState(false);
  const [inspector, setInspector] = useState("evidence"),
    [variantInput, setVariantInput] = useState("G12D"),
    [role, setRole] =
      useState<InvestigationState["panel"][number]["role"]>("candidate"),
    [scope, setScope] = useState("all"),
    [focus, setFocus] = useState(0),
    [reset, setReset] = useState(0),
    [brief, setBrief] = useState(false),
    [findingTitle, setFindingTitle] = useState(""),
    [findingClaim, setFindingClaim] = useState(""),
    [findingKind, setFindingKind] = useState<"hypothesis" | "observation">(
      "hypothesis",
    ),
    [findingContradiction, setFindingContradiction] = useState("");
  const refreshList = useCallback(async () => {
    const response = await request<{ investigations: SavedInvestigation[] }>(
      "/api/investigations",
    );
    setInvestigations(response.investigations);
  }, []);
  const install = useCallback(
    async (value: SavedInvestigation, caseData: CaseData) => {
      session.current = new DraftSession(value);
      setState(value.state);
      setSaved(value);
      setSaveStatus(`Saved · revision ${value.revision}`);
      setError("");
      setJob(null);
      setJobNotice("");
      setComparison(caseData.comparison);
      setBaseline(caseData.baseline);
      setRecoverable(null);
      try {
        const backup = localStorage.getItem(`signal-draft-${value.id}`);
        if (backup)
          setRecoverable(validateState(JSON.parse(backup), caseData.manifest));
        const pending = localStorage.getItem(`signal-job-${value.id}`);
        if (pending) {
          const pendingJob = await request<ClientJob>(`/api/jobs/${pending}`);
          if (session.current?.saved.id === value.id) setJob(pendingJob);
        }
      } catch (error) {
        setJobNotice(`Recovery information: ${explain(error)}`);
      }
      for (const id of [value.state.comparisonJobId, value.state.baselineJobId])
        if (id) {
          try {
            const restored = await request<ClientJob>(`/api/jobs/${id}`);
            if (
              session.current?.saved.id === value.id &&
              restored.status === "completed" &&
              restored.result
            ) {
              if (restored.type === "comparison")
                setComparison(restored.result as Comparison);
              else setBaseline(restored.result as PriorBaseline);
            }
          } catch (error) {
            setJobNotice(
              `Saved calculation could not be restored: ${explain(error)}`,
            );
          }
        }
    },
    [],
  );
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [caseData, response] = await Promise.all([
          request<CaseData>("/api/case"),
          request<{ investigations: SavedInvestigation[] }>(
            "/api/investigations",
          ),
        ]);
        if (!active) return;
        setData(caseData);
        setInvestigations(response.investigations);
        const first =
          response.investigations[0] ??
          (await request<SavedInvestigation>("/api/investigations", {
            method: "POST",
            body: "{}",
          }));
        if (active) {
          await install(first, caseData);
          await refreshList();
        }
      } catch (error) {
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
    if (!current) return;
    if (!current.edit(next)) return;
    setState(next);
    setSaveStatus("Unsaved changes");
    try {
      localStorage.setItem(
        `signal-draft-${current.saved.id}`,
        JSON.stringify(next),
      );
    } catch {}
  }, []);
  const flush = useCallback(async () => {
    const current = session.current;
    if (!current) throw new Error("No investigation loaded.");
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
        } catch {}
        await refreshList();
      }
      return result;
    } catch (error) {
      if (session.current === current) {
        setSaveStatus("Save failed · draft retained");
        setError(explain(error));
      }
      throw error;
    }
  }, [refreshList]);
  useEffect(() => {
    if (!state || !session.current?.dirty) return;
    const timer = setTimeout(() => {
      void flush().catch(() => {});
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
    if (!job) return;
    if (job.status === "completed" && job.result) {
      const current = session.current;
      if (!current || transitioning) return;
      const disposition = completedJobDisposition(job, current);
      if (disposition === "defer") return;
      try {
        localStorage.removeItem(`signal-job-${job.investigationId}`);
      } catch {}
      if (disposition === "attached") return;
      if (disposition === "attach") {
        if (job.type === "comparison") setComparison(job.result as Comparison);
        else setBaseline(job.result as PriorBaseline);
        edit({
          ...current.state,
          [job.type === "comparison" ? "comparisonJobId" : "baselineJobId"]:
            job.id,
        });
        setJobNotice("Calculation complete · attached to this investigation.");
      } else
        setJobNotice(
          "Calculation completed for an earlier revision. Current selection was preserved; run again to attach a current result.",
        );
      return;
    }
    if (job.status === "failed") {
      setJobNotice(job.error || "Calculation failed.");
      return;
    }
    if (!["queued", "running"].includes(job.status)) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const result = await request<ClientJob>(`/api/jobs/${job.id}`);
        if (active) setJob(result);
      } catch (error) {
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
  useEffect(() => {
    if (!brief) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") setBrief(false);
      if (event.key === "Tab") {
        const items =
          briefRef.current?.querySelectorAll<HTMLButtonElement>("button");
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, [brief]);
  async function openInvestigation(id: string) {
    const current = session.current;
    if (!data || !current || current.locked || transitioning) return;
    setWorking(true);
    setTransitioning(true);
    try {
      await withDraftTransition(current,
        () => request<SavedInvestigation>(`/api/investigations/${id}`),
        value => install(value, data), flush);
    } catch (error) {
      setError(explain(error));
    } finally {
      setWorking(false);
      setTransitioning(false);
    }
  }
  async function createInvestigation(copy = false) {
    const current = session.current;
    if (!data || !current || current.locked || transitioning) return;
    setWorking(true);
    setTransitioning(true);
    try {
      await withDraftTransition(current,
        () => request<SavedInvestigation>("/api/investigations", {
          method: "POST",
          body: JSON.stringify(copy ? { state: current.state } : {}),
        }),
        async value => { await install(value, data); await refreshList(); },
        copy ? () => Promise.resolve() : flush);
    } catch (error) {
      setError(explain(error));
    } finally {
      setWorking(false);
      setTransitioning(false);
    }
  }
  async function run(type: "comparison" | "baseline") {
    const current = session.current;
    if (!current) return;
    setWorking(true);
    setJobNotice("");
    try {
      const snapshot = await flush();
      const input =
        type === "comparison"
          ? {
              leftId: snapshot.state.view.leftId,
              rightId: snapshot.state.view.rightId,
              positions:
                scope === "selected"
                  ? snapshot.state.selectedPositions
                  : scope === "core"
                    ? Array.from({ length: 188 }, (_, i) => i + 1).filter(
                        (p) => !(p >= 30 && p <= 38) && !(p >= 60 && p <= 76),
                      )
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
      if (
        type === "baseline" &&
        !(input as { variants?: string[] }).variants?.length
      )
        throw new Error("Select a variant or add variants to the panel first.");
      if (
        scope === "selected" &&
        type === "comparison" &&
        snapshot.state.selectedPositions.length < 3
      )
        throw new Error(
          "Select at least three shared residues for a selected-residue fit.",
        );
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
        } catch {}
        setJob(result);
      }
    } catch (error) {
      setJobNotice(explain(error));
    } finally {
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
    } catch (error) {
      setError(explain(error));
    }
  }
  async function importFile(file?: File) {
    const current = session.current;
    if (!file || !data || !current || current.locked || transitioning) return;
    setWorking(true);
    setTransitioning(true);
    try {
      await withDraftTransition(current,
        async () => request<SavedInvestigation>("/api/investigations/import", {
          method: "POST", body: await file.text(),
        }),
        async value => { await install(value, data); await refreshList(); }, flush);
    } catch (error) {
      setError(explain(error));
    } finally {
      setWorking(false);
      setTransitioning(false);
    }
  }
  function chooseVariant(variant: string) {
    if (!data || !session.current) return;
    try {
      edit(
        selectVariant(
          session.current.state,
          variant,
          data.manifest.reference.sequence,
        ),
      );
      setVariantInput(variant);
      setInspector("evidence");
      setError("");
    } catch (error) {
      setError(explain(error));
    }
  }
  function choosePosition(position: number) {
    if (session.current) edit(selectPosition(session.current.state, position));
  }
  function addToPanel() {
    if (!data || !session.current) return;
    try {
      edit(
        addPanelVariant(
          session.current.state,
          variantInput,
          data.manifest.reference.sequence,
          role,
        ),
      );
      setInspector("panel");
      setError("");
    } catch (error) {
      setError(explain(error));
    }
  }
  function panelEdit(
    index: number,
    patch: Partial<InvestigationState["panel"][number]>,
  ) {
    if (!session.current) return;
    try {
      edit(editPanel(session.current.state, index, patch));
      setError("");
    } catch (error) {
      setError(explain(error));
    }
  }
  function addFinding() {
    if (!session.current || !findingTitle.trim() || !findingClaim.trim())
      return;
    const current = session.current.state;
    edit({
      ...current,
      findings: [
        ...current.findings,
        {
          id: crypto.randomUUID(),
          title: findingTitle.trim(),
          claim: findingClaim.trim(),
          kind: findingKind,
          positions: current.selectedPositions,
          evidenceVariants: current.selectedVariant
            ? [current.selectedVariant]
            : [],
          contradictoryEvidence: findingContradiction,
        },
      ],
    });
    setFindingTitle("");
    setFindingClaim("");
    setFindingContradiction("");
    setInspector("findings");
  }
  const selected = useMemo(
    () => data?.observations.find((o) => o.variant === state?.selectedVariant),
    [data, state?.selectedVariant],
  );
  if (!data || !state || !saved || !comparison || !baseline)
    return (
      <main className="boot">
        <span className="brand-mark">S1</span>
        <h1>Signal / investigation</h1>
        <p role="status">{saveStatus}</p>
        {error && <p role="alert">{error}</p>}
        <button onClick={() => window.location.reload()}>Retry loading</button>
      </main>
    );
  const { manifest } = data,
    structures = manifest.structures.filter((s) =>
      [state.view.leftId, state.view.rightId].includes(s.id),
    ),
    prior = baseline.scores.find((s) => s.variant === state.selectedVariant),
    busy = working || (!!job && ["queued", "running"].includes(job.status));
  const setCamera = (
    camera: NonNullable<InvestigationState["view"]["camera"]>,
  ) => {
    const current = session.current?.state;
    if (
      current &&
      JSON.stringify(camera) !== JSON.stringify(current.view.camera)
    )
      edit({ ...current, view: { ...current.view, camera } });
  };
  return (
    <main className="instrument">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Signal 1 home">
          <span className="brand-mark">S1</span>
          <span>
            SIGNAL <small>INVESTIGATION</small>
          </span>
        </Link>
        <div className="top-context">
          <strong>{state.title}</strong>
          <span className="mono">KRAS / P01116-2 / HUMAN</span>
        </div>
        <div className="top-actions">
          <span className="save-status" role="status">
            {saveStatus}
          </span>
          <button onClick={() => setBrief(true)}>
            Review brief <span aria-hidden>↗</span>
          </button>
        </div>
      </header>
      {recoverable && (
        <div className="error-banner">
          <span>
            A local unsaved draft is available for this investigation.
          </span>
          <button
            onClick={() => {
              edit(recoverable);
              setRecoverable(null);
            }}
          >
            Restore local draft
          </button>
          <button
            onClick={() => {
              try {
                localStorage.removeItem(`signal-draft-${saved.id}`);
              } catch {}
              setRecoverable(null);
            }}
          >
            Keep saved version
          </button>
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          <span>{error} Local edits are retained.</span>
          <button onClick={() => void flush().catch(() => {})}>
            Retry save
          </button>
          <button onClick={() => void createInvestigation(true)}>
            Save as new investigation
          </button>
        </div>
      )}
      {transitioning && <div className="job-status" role="status">Switching investigation… Editing resumes when the destination is ready.</div>}
      <div className="workspace" inert={transitioning} aria-busy={transitioning}>
        <aside className="investigation-rail">
          <div className="rail-heading">
            <span className="eyebrow">01 / Investigation</span>
            <button
              className="small-button"
              disabled={working}
              onClick={() => void createInvestigation()}
            >
              + New
            </button>
          </div>
          <label>
            Saved investigations
            <select
              aria-label="Saved investigations"
              value={saved.id}
              disabled={working}
              onChange={(e) => void openInvestigation(e.target.value)}
            >
              {investigations.some((i) => i.id === saved.id) ? null : (
                <option value={saved.id}>{state.title}</option>
              )}
              {investigations.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.state.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Title
            <input
              value={state.title}
              maxLength={120}
              onChange={(e) => edit({ ...state, title: e.target.value })}
            />
          </label>
          <label>
            Research question
            <textarea
              className="question-input"
              value={state.question}
              maxLength={2000}
              onChange={(e) => edit({ ...state, question: e.target.value })}
            />
          </label>
          <div className="rail-section">
            <span className="eyebrow">Experimental structures</span>
            {structures.map((s, i) => (
              <div className="structure-card" key={s.id}>
                <div className="structure-id">
                  <span
                    className={`structure-dot ${s.id === comparison.leftId ? "orange" : "cyan"}`}
                  />
                  <a
                    href={`https://www.rcsb.org/structure/${s.pdbId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {s.pdbId}
                  </a>
                  <span>Chain {s.chainId}</span>
                </div>
                <p>{s.title}</p>
                <small>{s.context}</small>
                <div className="coverage-line">
                  <span
                    style={{
                      width: `${(s.coverage.length / manifest.reference.sequence.length) * 100}%`,
                    }}
                  />
                </div>
                <small>
                  {s.coverage.length}/{manifest.reference.sequence.length}{" "}
                  reference residues · {s.method}
                </small>
                <span className="structure-label">
                  {i === 0 ? "A" : "B"} / KRAS G12V
                </span>
              </div>
            ))}
            <p className="caption">
              Both structures carry G12V. Different binder and nucleotide
              contexts; this is not a wild-type versus mutant comparison.
            </p>
          </div>
          <div className="rail-section">
            <span className="eyebrow">Research record</span>
            <button
              className="rail-link"
              onClick={() => setInspector("findings")}
            >
              Findings{" "}
              <span>{state.findings.length.toString().padStart(2, "0")}</span>
            </button>
            <button className="rail-link" onClick={() => setInspector("panel")}>
              Experimental panel{" "}
              <span>{state.panel.length.toString().padStart(2, "0")}</span>
            </button>
            <label className="import-button">
              Import investigation
              <input
                aria-label="Import investigation JSON"
                type="file"
                accept=".json,application/json"
                disabled={working}
                onChange={(e) => void importFile(e.target.files?.[0])}
              />
            </label>
          </div>
          <details className="provenance">
            <summary>Case provenance & limitations</summary>
            {manifest.provenance.map((p, i) => (
              <p key={i}>
                <a href={p.url} target="_blank" rel="noreferrer">
                  {p.source}
                </a>
                <br />
                <small>
                  Retrieved {p.retrievedAt.slice(0, 10)} · {p.license}
                </small>
              </p>
            ))}
            {manifest.limitations.map((l, i) => (
              <p key={i}>{l}</p>
            ))}
          </details>
        </aside>
        <section className="analysis-column">
          <div className="stage-heading">
            <div>
              <span className="eyebrow">02 / Molecular context</span>
              <h1>Binding in context.</h1>
            </div>
            <div className="tabs">
              <button
                aria-pressed={state.view.mode === "overlay"}
                onClick={() =>
                  edit({ ...state, view: { ...state.view, mode: "overlay" } })
                }
              >
                Overlay
              </button>
              <button
                aria-pressed={state.view.mode === "split"}
                onClick={() =>
                  edit({ ...state, view: { ...state.view, mode: "split" } })
                }
              >
                Split
              </button>
            </div>
          </div>
          <section
            className="molecular-stage"
            aria-label="Linked molecular workspace"
          >
            <div className="scene-topline">
              <span>
                <i className="structure-dot orange" />{" "}
                {structures.find((s) => s.id === comparison.leftId)?.pdbId}{" "}
                <i className="structure-dot cyan" />{" "}
                {structures.find((s) => s.id === comparison.rightId)?.pdbId}
              </span>
              <span>Experimental · Cα aligned</span>
            </div>
            <div className={`viewport-grid ${state.view.mode}`}>
              {state.view.mode === "overlay" ? (
                <MolstarViewer
                  investigationId={saved.id}
                  key="overlay"
                  structures={structures}
                  frameStructure={manifest.structures.find(
                    (s) => s.id === comparison.leftId,
                  )!}
                  comparison={comparison}
                  positions={state.selectedPositions}
                  camera={state.view.camera}
                  onCamera={setCamera}
                  onPosition={choosePosition}
                  focus={focus}
                  reset={reset}
                />
              ) : (
                structures.map((s) => (
                  <div className="split-scene" key={s.id}>
                    <span className="split-label">
                      {s.pdbId} · chain {s.chainId}
                    </span>
                    <MolstarViewer
                  investigationId={saved.id}
                      structures={[s]}
                      frameStructure={manifest.structures.find(
                        (s) => s.id === comparison.leftId,
                      )!}
                      comparison={comparison}
                      positions={state.selectedPositions}
                      camera={state.view.camera}
                      onCamera={setCamera}
                      onPosition={choosePosition}
                      focus={focus}
                      reset={reset}
                    />
                  </div>
                ))
              )}
            </div>
            <div className="scene-bottomline">
              <span>Drag to rotate · wheel to zoom · click to select</span>
              <div>
                <button
                  disabled={!state.selectedPositions.length}
                  onClick={() => setFocus((v) => v + 1)}
                >
                  Focus selection
                </button>
                <button
                  onClick={() => {
                    edit({ ...state, view: { ...state.view, camera: null } });
                    setReset((v) => v + 1);
                  }}
                >
                  Reset camera
                </button>
              </div>
            </div>
          </section>
          <section className="sequence-section" aria-label="Reference sequence">
            <div className="sequence-heading">
              <span className="mono">
                P01116-2 · 1–{manifest.reference.sequence.length}
              </span>
              <span>
                Reference numbering · stripes = absent from either structure
              </span>
              <button
                className="text-button"
                onClick={() =>
                  edit({
                    ...state,
                    selectedVariant: null,
                    selectedPositions: [],
                  })
                }
              >
                Clear
              </button>
            </div>
            <div className="sequence-track">
              {manifest.reference.sequence.split("").map((aa, i) => (
                <button
                  key={i}
                  className={`${state.selectedPositions.includes(i + 1) ? "selected " : ""}${structures.every((s) => s.coverage.includes(i + 1)) ? "" : "unresolved"}`}
                  title={`${aa}${i + 1} · ${structures.map((s) => `${s.pdbId}: ${s.coverage.includes(i + 1) ? "resolved" : "unresolved"}`).join("; ")}`}
                  aria-label={`Reference residue ${aa}${i + 1}`}
                  aria-pressed={state.selectedPositions.includes(i + 1)}
                  onClick={(e) => {
                    if (e.shiftKey) {
                      const positions = state.selectedPositions.includes(i + 1)
                        ? state.selectedPositions.filter((p) => p !== i + 1)
                        : [...state.selectedPositions, i + 1].sort(
                            (a, b) => a - b,
                          );
                      edit({
                        ...state,
                        selectedVariant: null,
                        selectedPositions: positions,
                      });
                    } else choosePosition(i + 1);
                  }}
                >
                  <small>{(i + 1) % 10 === 0 || i === 0 ? i + 1 : " "}</small>
                  {aa}
                </button>
              ))}
            </div>
            <p className="caption">
              Shift-click to build a fit selection. Variant selection includes
              every substituted residue.
            </p>
          </section>
          <section className="fit-strip">
            <div>
              <strong>
                {comparison.rmsd.toFixed(3)} <small>Å RMSD</small>
              </strong>
              <span>
                {comparison.count} matched Cα atoms · {comparison.fitScope}
              </span>
            </div>
            <label>
              Fit scope
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="all">All shared residues</option>
                <option value="core">Outside switches · 30–38 / 60–76</option>
                <option value="selected">Selected residues</option>
              </select>
            </label>
            <button disabled={busy} onClick={() => void run("comparison")}>
              Recalculate fit
            </button>
            <details>
              <summary>Scope & exclusions</summary>
              <p>
                {comparison.kind} · {comparison.algorithm}. Coverage{" "}
                {(comparison.coverage * 100).toFixed(1)}%.
              </p>
              {comparison.exclusions.map((s, i) => (
                <p key={i}>{s}</p>
              ))}
            </details>
          </section>
          {(job || jobNotice) && (
            <div className="job-status" role="status">
              <span>
                {job
                  ? `${job.type} · ${job.status} · input revision ${job.inputRevision}`
                  : ""}{" "}
                {jobNotice}
              </span>
              {job && ["queued", "running"].includes(job.status) ? (
                <button
                  onClick={() =>
                    void request<ClientJob>(`/api/jobs/${job.id}`, {
                      method: "DELETE",
                    })
                      .then(setJob)
                      .catch((e) => setJobNotice(explain(e)))
                  }
                >
                  Cancel
                </button>
              ) : (
                <button
                  disabled={working}
                  onClick={() => void run(job?.type || "comparison")}
                >
                  Run again
                </button>
              )}
            </div>
          )}
          <Evidence
            observations={data.observations}
            comparison={comparison}
            selectedVariant={state.selectedVariant}
            positions={state.selectedPositions}
            onVariant={chooseVariant}
            onPosition={choosePosition}
          />
        </section>
        <aside className="inspector">
          <div className="inspector-heading">
            <span className="eyebrow">03 / Interpretation</span>
            <h2>
              {state.selectedVariant ||
                (state.selectedPositions.length
                  ? `Residue ${state.selectedPositions.join(", ")}`
                  : "Select evidence")}
            </h2>
          </div>
          <div className="tabs inspector-tabs">
            {[
              ["evidence", "Evidence"],
              ["findings", "Findings"],
              ["panel", "Panel"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={inspector === id}
                onClick={() => setInspector(id)}
              >
                {label}
              </button>
            ))}
          </div>
          {inspector === "evidence" && (
            <>
              <section className="inspector-section">
                <span className="eyebrow">
                  Measured / yeast selection assays
                </span>
                <div className="measure">
                  <span>Abundance</span>
                  <strong>{selected?.abundance?.toFixed(3) ?? "—"}</strong>
                </div>
                <div className="measure">
                  <span>DARPin K55 binding</span>
                  <strong>{selected?.binding?.toFixed(3) ?? "—"}</strong>
                </div>
                <p className="caption">
                  Unitless fitness scores.{" "}
                  {selected
                    ? "A dash means this variant was not measured in that assay."
                    : "Choose a variant to inspect its measured outcomes."}
                </p>
                {manifest.assays.map((a) => (
                  <details key={a.id}>
                    <summary>{a.name}</summary>
                    <p>{a.description}</p>
                    <p>
                      {a.direction} · {a.units}
                    </p>
                    <a href={a.sourceUrl} target="_blank" rel="noreferrer">
                      Assay source ↗
                    </a>
                  </details>
                ))}
              </section>
              <section className="inspector-section">
                <span className="eyebrow">Prior / {baseline.name}</span>
                <div className="measure">
                  <span>Substitution score</span>
                  <strong>{prior?.score ?? "—"}</strong>
                </div>
                <p className="caption">
                  Substitution compatibility, not a prediction of assay outcomes.
                </p>
                <details>
                  <summary>Method, limitations & source</summary>
                  <p>{baseline.description}</p>
                  <p>{baseline.limitations.join(" ")}</p>
                  <a href={baseline.sourceUrl} target="_blank" rel="noreferrer">
                    Baseline source ↗
                  </a>
                </details>
                <button disabled={busy} onClick={() => void run("baseline")}>
                  Calculate selected / panel priors
                </button>
              </section>
              <section className="inspector-section">
                <span className="eyebrow">Coverage & uncertainty</span>
                <p>
                  Experimental X-ray structures: pLDDT and PAE are not
                  available.
                </p>
                {state.selectedPositions.length ? (
                  state.selectedPositions.map((p) => (
                    <p className="caption" key={p}>
                      Residue {p}:{" "}
                      {structures
                        .map(
                          (s) =>
                            `${s.pdbId} ${s.coverage.includes(p) ? "resolved" : "unresolved"}`,
                        )
                        .join(" · ")}
                      {comparison.displacements.find((d) => d.position === p)
                        ? ` · Δ ${comparison.displacements.find((d) => d.position === p)!.distance.toFixed(3)} Å`
                        : ""}
                    </p>
                  ))
                ) : (
                  <p className="caption">
                    Select sequence residues to inspect mapped coverage and
                    displacement.
                  </p>
                )}
              </section>
              <section className="inspector-section">
                <button
                  className="primary"
                  onClick={() => setInspector("findings")}
                >
                  Record a finding
                </button>
                <button
                  onClick={() => {
                    if (state.selectedVariant)
                      setVariantInput(state.selectedVariant);
                    setInspector("panel");
                  }}
                >
                  Add to experimental panel
                </button>
              </section>
            </>
          )}
          {inspector === "findings" && (
            <section className="inspector-section">
              <p className="caption">
                Researcher-authored reasoning. Current positions and variant are
                attached when you add a finding.
              </p>
              {state.findings.map((f, index) => (
                <div className="finding" key={f.id}>
                  <label>
                    Finding title
                    <input
                      value={f.title}
                      maxLength={160}
                      onChange={(e) =>
                        edit({
                          ...state,
                          findings: state.findings.map((v, i) =>
                            i === index ? { ...v, title: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Kind
                    <select
                      value={f.kind}
                      onChange={(e) =>
                        edit({
                          ...state,
                          findings: state.findings.map((v, i) =>
                            i === index
                              ? { ...v, kind: e.target.value as typeof f.kind }
                              : v,
                          ),
                        })
                      }
                    >
                      <option value="hypothesis">Hypothesis</option>
                      <option value="observation">Observation</option>
                    </select>
                  </label>
                  <label>
                    Claim
                    <textarea
                      value={f.claim}
                      maxLength={6000}
                      onChange={(e) =>
                        edit({
                          ...state,
                          findings: state.findings.map((v, i) =>
                            i === index ? { ...v, claim: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  </label>
                  <label>
                    Contradictory evidence
                    <textarea
                      maxLength={6000}
                      value={f.contradictoryEvidence}
                      onChange={(e) =>
                        edit({
                          ...state,
                          findings: state.findings.map((v, i) =>
                            i === index
                              ? { ...v, contradictoryEvidence: e.target.value }
                              : v,
                          ),
                        })
                      }
                    />
                  </label>
                  <p className="caption">
                    Attached: {f.evidenceVariants.join(", ") || "No variant"} ·
                    residues {f.positions.join(", ") || "none"}
                  </p>
                  <button
                    onClick={() =>
                      edit({
                        ...state,
                        findings: state.findings.filter((v) => v.id !== f.id),
                      })
                    }
                  >
                    Delete finding
                  </button>
                </div>
              ))}
              <h3>New finding</h3>
              <label>
                Title
                <input
                  value={findingTitle}
                  maxLength={160}
                  onChange={(e) => setFindingTitle(e.target.value)}
                />
              </label>
              <label>
                Kind
                <select
                  value={findingKind}
                  onChange={(e) =>
                    setFindingKind(e.target.value as typeof findingKind)
                  }
                >
                  <option value="hypothesis">Hypothesis</option>
                  <option value="observation">Observation</option>
                </select>
              </label>
              <label>
                Claim
                <textarea
                  placeholder="What does the evidence suggest?"
                  value={findingClaim}
                  maxLength={6000}
                  onChange={(e) => setFindingClaim(e.target.value)}
                />
              </label>
              <label>
                Contradictory evidence
                <textarea
                  maxLength={6000}
                  placeholder="What would weaken this explanation?"
                  value={findingContradiction}
                  onChange={(e) => setFindingContradiction(e.target.value)}
                />
              </label>
              <button
                className="primary"
                disabled={
                  !findingTitle.trim() ||
                  !findingClaim.trim() ||
                  state.findings.length >= 100
                }
                onClick={addFinding}
              >
                Add finding with selection
              </button>
            </section>
          )}
          {inspector === "panel" && (
            <section className="inspector-section">
              <p className="caption">
                Build discriminating experiments with explicit controls,
                expected observations, and repeats.
              </p>
              <label>
                Variant
                <input
                  className="mono"
                  value={variantInput}
                  onChange={(e) => setVariantInput(e.target.value)}
                  placeholder="G12D or WT"
                />
              </label>
              <label>
                Role
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as typeof role)}
                >
                  <option value="candidate">Candidate</option>
                  <option value="positive-control">Positive control</option>
                  <option value="negative-control">Negative control</option>
                </select>
              </label>
              <button className="primary" onClick={addToPanel}>
                Add variant
              </button>
              <button onClick={() => chooseVariant(variantInput)}>
                Inspect variant
              </button>
              {state.panel.map((row, index) => (
                <div className="panel-row" key={row.variant}>
                  <div className="row-between">
                    <button
                      className="text-button mono"
                      onClick={() => chooseVariant(row.variant)}
                    >
                      {row.variant}
                    </button>
                    <button
                      className="small-button"
                      aria-label={`Remove ${row.variant}`}
                      onClick={() =>
                        edit({
                          ...state,
                          panel: state.panel.filter((_, i) => i !== index),
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                  <label>
                    Role
                    <select
                      value={row.role}
                      onChange={(e) =>
                        panelEdit(index, {
                          role: e.target.value as typeof row.role,
                        })
                      }
                    >
                      <option value="candidate">Candidate</option>
                      <option value="positive-control">Positive control</option>
                      <option value="negative-control">Negative control</option>
                    </select>
                  </label>
                  <label>
                    Rationale
                    <textarea
                      value={row.rationale}
                      maxLength={2000}
                      onChange={(e) =>
                        panelEdit(index, { rationale: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Expected observation
                    <textarea
                      value={row.expectedObservation}
                      maxLength={2000}
                      onChange={(e) =>
                        panelEdit(index, {
                          expectedObservation: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Replicates
                    <input
                      type="number"
                      min={1}
                      max={96}
                      value={row.replicates}
                      onChange={(e) =>
                        panelEdit(index, { replicates: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
      <footer className="instrument-footer">
        <span>KRAS / curated investigation case</span>
        <span>
          {data.observations.length.toLocaleString()} observations ·{" "}
          {manifest.reference.sequence.length} reference residues
        </span>
        <span>Local research workspace</span>
      </footer>
      {brief && (
        <div className="brief-backdrop">
          <section
            ref={briefRef}
            className="brief-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="brief-title"
          >
            <div className="row-between">
              <span className="eyebrow" id="brief-title">
                Investigation brief · draft preview
              </span>
              <button autoFocus onClick={() => setBrief(false)}>
                Close
              </button>
            </div>
            <pre>{briefText(state)}</pre>
            <div className="brief-actions">
              <button
                className="primary"
                onClick={() => void exportSaved("json")}
              >
                Export reproducibility JSON
              </button>
              <button onClick={() => void exportSaved("md")}>
                Export Markdown brief
              </button>
              <button onClick={() => void exportSaved("csv")}>
                Export panel CSV
              </button>
              <button onClick={() => void exportSaved("mvsx")}>
                3D scene (.mvsx)
              </button>
            </div>
            <p className="caption">
              Exports save first and include the persisted revision. Failed
              saves keep your draft here.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
