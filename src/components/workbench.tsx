"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import { MolstarViewer } from "@/components/molstar-viewer";
import { TherapyGraph } from "@/components/therapy-graph";
import type {
  AnnotationItem,
  CompareMode,
  ResolvedTarget,
  StoryEvent,
  StructureCandidate
} from "@/lib/types";
import { formatTime, makeId } from "@/lib/utils";

type ConfidenceMetrics = {
  avgPlddt: number;
  highConfidenceResidues: number;
  lowConfidenceResidues: number;
  paeMean: number;
  paeMax: number;
  residueCount: number;
};

type RemoteCursor = {
  userId: string;
  x: number;
  y: number;
  color: string;
  updatedAt: number;
};

function scoreBand(score: number) {
  if (score >= 75) {
    return { label: "High Actionability", className: "tag good" };
  }

  if (score >= 45) {
    return { label: "Medium Actionability", className: "tag warn" };
  }

  return { label: "Exploratory", className: "tag risk" };
}

function getColorForUser(userId: string) {
  let hash = 0;
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash << 5) - hash + userId.charCodeAt(index);
    hash |= 0;
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 76%, 56%)`;
}

function normalizeMutationLabel(raw: string) {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9,]/g, "")
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

function encodeStory(events: StoryEvent[]) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(events))));
}

function decodeStory(encoded: string): StoryEvent[] {
  return JSON.parse(decodeURIComponent(escape(atob(encoded)))) as StoryEvent[];
}

function buildDefaultPair(
  target: ResolvedTarget,
  mode: CompareMode
): { left: StructureCandidate | null; right: StructureCandidate | null } {
  const canonical = target.compareCandidates.find((item) => item.id.startsWith("af:")) || null;
  const isoform = target.compareCandidates.find((item) => item.id.startsWith("iso:")) || null;
  const pdb = target.compareCandidates.find((item) => item.id.startsWith("pdb:")) || null;

  if (mode === "isoform-canonical") {
    return {
      left: canonical,
      right: isoform || pdb || canonical
    };
  }

  if (mode === "pdb-vs-alphafold") {
    return {
      left: pdb || canonical,
      right: canonical || pdb
    };
  }

  return {
    left: canonical || pdb,
    right: pdb || isoform || canonical
  };
}

export function Workbench() {
  const [gene, setGene] = useState("EGFR");
  const [mode, setMode] = useState<CompareMode>("pdb-vs-alphafold");
  const [mutationLabel, setMutationLabel] = useState("L858R");

  const [target, setTarget] = useState<ResolvedTarget | null>(null);
  const [status, setStatus] = useState("Ready.");
  const [loading, setLoading] = useState(false);

  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");
  const [sceneKey, setSceneKey] = useState<string>(makeId("scene"));

  const [confidence, setConfidence] = useState<ConfidenceMetrics | null>(null);
  const [confidenceLoading, setConfidenceLoading] = useState(false);

  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [annotationResidue, setAnnotationResidue] = useState("858");
  const [annotationLabel, setAnnotationLabel] = useState("Known activation hotspot");
  const [annotationColor, setAnnotationColor] = useState("#ffb400");

  const [storyEvents, setStoryEvents] = useState<StoryEvent[]>([]);
  const [playbackActive, setPlaybackActive] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState<number>(-1);

  const [graphFocusId, setGraphFocusId] = useState<string>("");
  const [shareUrl, setShareUrl] = useState<string>("");
  const [userId, setUserId] = useState("u_local");

  const [remoteCursors, setRemoteCursors] = useState<Record<string, RemoteCursor>>({});
  const [queryState, setQueryState] = useState<{
    room: string;
    storyId: string | null;
    storyData: string | null;
  }>({
    room: "default-room",
    storyId: null,
    storyData: null
  });

  const roomId = queryState.room;
  const userIdRef = useRef("u_local");
  const socketRef = useRef<Socket | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const cursorSentAtRef = useRef<number>(0);

  const compareCandidates = useMemo(() => target?.compareCandidates ?? [], [target]);

  const selectedStructures = useMemo(() => {
    const left = compareCandidates.find((item) => item.id === leftId) || null;
    const right = compareCandidates.find((item) => item.id === rightId) || null;
    const deduped = [left, right].filter(Boolean) as StructureCandidate[];

    return deduped.filter(
      (value, index, array) => array.findIndex((item) => item.id === value.id) === index
    );
  }, [compareCandidates, leftId, rightId]);

  const score = useMemo(() => {
    if (!target) {
      return 0;
    }

    const disease = target.diseases[0]?.score || 0;
    const drug = target.drugs[0]?.phase || 0;
    const structure = selectedStructures.some((item) => item.source === "alphafold") ? 1 : 0.6;

    return Math.round(((disease * 0.45 + (drug / 4) * 0.35 + structure * 0.2) / 1) * 100);
  }, [selectedStructures, target]);

  const scoreMeta = scoreBand(score);

  const pushStory = useCallback((event: Omit<StoryEvent, "id" | "at">) => {
    setStoryEvents((previous) => [
      ...previous,
      {
        id: makeId("evt"),
        at: new Date().toISOString(),
        ...event
      }
    ]);
  }, []);

  const applyModeDefaults = useCallback(
    (resolved: ResolvedTarget, chosenMode: CompareMode) => {
      const pair = buildDefaultPair(resolved, chosenMode);
      setLeftId(pair.left?.id || "");
      setRightId(pair.right?.id || "");
      setSceneKey(makeId("scene"));

      pushStory({
        type: "compare-updated",
        payload: {
          mode: chosenMode,
          left: pair.left?.label || null,
          right: pair.right?.label || null
        }
      });
    },
    [pushStory]
  );

  const resolveGene = useCallback(async () => {
    const normalized = gene.trim().toUpperCase();
    if (!normalized) {
      setStatus("Enter a gene symbol.");
      return;
    }

    try {
      setLoading(true);
      setStatus(`Resolving ${normalized} with the API adapter layer...`);

      const response = await fetch(`/api/resolve?gene=${encodeURIComponent(normalized)}`);
      if (!response.ok) {
        throw new Error(`Resolve failed (${response.status})`);
      }

      const payload = (await response.json()) as ResolvedTarget;
      setTarget(payload);
      setAnnotations([]);
      setGraphFocusId("");
      applyModeDefaults(payload, mode);
      setStatus(`Loaded ${payload.canonicalGene}. Mol* scene updating...`);

      pushStory({
        type: "target-loaded",
        payload: {
          gene: payload.canonicalGene,
          accession: payload.accession,
          candidates: payload.compareCandidates.map((item) => item.label)
        }
      });
    } catch (caught) {
      setStatus((caught as Error).message || "Failed to resolve target.");
    } finally {
      setLoading(false);
    }
  }, [applyModeDefaults, gene, mode, pushStory]);

  useEffect(() => {
    const generated = `u_${Math.random().toString(36).slice(2, 8)}`;
    userIdRef.current = generated;
    setUserId(generated);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    setQueryState({
      room: params.get("room") || "default-room",
      storyId: params.get("story"),
      storyData: params.get("storyData")
    });
  }, []);

  useEffect(() => {
    const storyId = queryState.storyId;
    const encoded = queryState.storyData;

    async function loadStory() {
      if (storyId) {
        const response = await fetch(`/api/story?id=${encodeURIComponent(storyId)}`);
        if (response.ok) {
          const payload = (await response.json()) as { events: StoryEvent[] };
          setStoryEvents(payload.events || []);
          setStatus(`Loaded shared story ${storyId}.`);
        }
        return;
      }

      if (encoded) {
        try {
          setStoryEvents(decodeStory(encoded));
          setStatus("Loaded shared story payload from URL.");
        } catch {
          setStatus("Could not decode story payload from URL.");
        }
      }
    }

    void loadStory();
  }, [queryState.storyData, queryState.storyId]);

  useEffect(() => {
    workerRef.current = new Worker("/workers/confidence.worker.js");
    workerRef.current.onmessage = (event: MessageEvent<ConfidenceMetrics>) => {
      setConfidence(event.data);
      setConfidenceLoading(false);
    };

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  useEffect(() => {
    async function analyzeConfidence() {
      if (!target?.confidence.hasAlphaFold || !target.confidence.paeUrl || !target.confidence.plddtUrl) {
        setConfidence(null);
        return;
      }

      try {
        setConfidenceLoading(true);
        const [plddtPayload, paePayload] = await Promise.all([
          fetch(target.confidence.plddtUrl).then((response) => response.json()),
          fetch(target.confidence.paeUrl).then((response) => response.json())
        ]);

        workerRef.current?.postMessage({ plddtPayload, paePayload });
      } catch {
        setConfidenceLoading(false);
        setConfidence(null);
      }
    }

    void analyzeConfidence();
  }, [target]);

  useEffect(() => {
    let active = true;

    async function connectSocket() {
      await fetch("/api/socket");
      const { io } = await import("socket.io-client");
      if (!active) {
        return;
      }

      const socket = io({
        path: "/api/socket/io",
        transports: ["websocket", "polling"]
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("join-room", roomId, userIdRef.current);
      });

      socket.on("cursor", (payload: { userId: string; x: number; y: number }) => {
        if (payload.userId === userIdRef.current) {
          return;
        }

        setRemoteCursors((previous) => ({
          ...previous,
          [payload.userId]: {
            ...payload,
            color: getColorForUser(payload.userId),
            updatedAt: Date.now()
          }
        }));
      });

      socket.on("annotation", (payload: { userId: string; annotation: AnnotationItem }) => {
        if (payload.userId === userIdRef.current) {
          return;
        }

        setAnnotations((previous) => {
          if (previous.some((item) => item.id === payload.annotation.id)) {
            return previous;
          }

          return [...previous, payload.annotation];
        });
      });
    }

    void connectSocket();

    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemoteCursors((previous) => {
        const now = Date.now();
        const next: Record<string, RemoteCursor> = {};

        for (const [key, cursor] of Object.entries(previous)) {
          if (now - cursor.updatedAt < 3000) {
            next[key] = cursor;
          }
        }

        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!playbackActive || storyEvents.length === 0) {
      return;
    }

    const timer = setInterval(() => {
      setPlaybackIndex((current) => {
        const next = current + 1;
        if (next >= storyEvents.length) {
          setPlaybackActive(false);
          return current;
        }

        return next;
      });
    }, 1200);

    return () => clearInterval(timer);
  }, [playbackActive, storyEvents.length]);

  const onViewerMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    if (now - cursorSentAtRef.current < 50) {
      return;
    }

    cursorSentAtRef.current = now;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    socketRef.current?.emit("cursor", {
      roomId,
      userId: userIdRef.current,
      x,
      y
    });
  };

  const addAnnotation = () => {
    const residue = Number(annotationResidue);
    if (!Number.isFinite(residue) || residue <= 0) {
      return;
    }

    const annotation: AnnotationItem = {
      id: makeId("ann"),
      residue,
      label: annotationLabel || `Residue ${residue}`,
      color: annotationColor,
      createdAt: new Date().toISOString(),
      author: userIdRef.current
    };

    setAnnotations((previous) => [...previous, annotation]);
    socketRef.current?.emit("annotation", {
      roomId,
      userId: userIdRef.current,
      annotation
    });

    pushStory({
      type: "annotation-added",
      payload: {
        residue,
        label: annotation.label,
        author: annotation.author
      }
    });
  };

  const saveStory = async () => {
    if (!storyEvents.length) {
      return;
    }

    try {
      const response = await fetch("/api/story", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ events: storyEvents })
      });

      if (!response.ok) {
        throw new Error("Story upload failed");
      }

      const payload = (await response.json()) as { id: string };
      const url = `${window.location.origin}?story=${payload.id}&room=${encodeURIComponent(roomId)}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setStatus("Story link copied to clipboard.");
    } catch {
      const fallback = `${window.location.origin}?storyData=${encodeURIComponent(encodeStory(storyEvents))}`;
      setShareUrl(fallback);
      await navigator.clipboard.writeText(fallback);
      setStatus("Fallback story payload copied to clipboard.");
    }
  };

  const applyCompareMode = (nextMode: CompareMode) => {
    setMode(nextMode);

    if (!target) {
      return;
    }

    applyModeDefaults(target, nextMode);

    pushStory({
      type: "mode-changed",
      payload: {
        mode: nextMode
      }
    });
  };

  const reloadScene = () => {
    setSceneKey(makeId("scene"));
    pushStory({
      type: "structures-loaded",
      payload: {
        left: leftId,
        right: rightId
      }
    });
  };

  const mutationDiff = useMemo(() => {
    const mutations = normalizeMutationLabel(mutationLabel);
    if (!mutations.length) {
      return [];
    }

    return mutations.map((mutation) => {
      const match = mutation.match(/^([A-Z])(\d+)([A-Z])$/);
      if (!match) {
        return `${mutation}: format should look like L858R`;
      }

      return `Residue ${match[2]} changes ${match[1]} -> ${match[3]}`;
    });
  }, [mutationLabel]);

  const selectedGraphNode = useMemo(
    () => target?.graph.nodes.find((node) => node.id === graphFocusId) || null,
    [graphFocusId, target]
  );

  return (
    <main className="mx-auto w-[min(1400px,calc(100vw-2rem))] py-6 lg:py-8">
      <header className="mb-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-2)]">
          Frontier Biology Interface
        </p>
        <h1 className="font-[Fraunces] text-4xl leading-tight lg:text-5xl">
          Signal-1: 3D-First Target Workbench
        </h1>
        <p className="max-w-4xl text-sm text-[var(--muted)] lg:text-base">
          Mol* is the center. Every analysis step is tracked as a shareable story with live collaboration,
          confidence analytics, and target-to-therapy graph context.
        </p>
      </header>

      <section className="panel mb-4 grid gap-3 p-4 lg:grid-cols-[1fr_220px_220px_150px]">
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Gene</span>
          <input
            className="input"
            value={gene}
            onChange={(event) => setGene(event.target.value)}
            placeholder="EGFR"
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Compare mode</span>
          <select
            className="select"
            value={mode}
            onChange={(event) => applyCompareMode(event.target.value as CompareMode)}
          >
            <option value="wt-mutant">WT vs mutant</option>
            <option value="isoform-canonical">Isoform vs canonical</option>
            <option value="pdb-vs-alphafold">Experimental PDB vs AlphaFold</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Mutation diff</span>
          <input
            className="input"
            value={mutationLabel}
            onChange={(event) => setMutationLabel(event.target.value)}
            placeholder="L858R"
          />
        </label>

        <div className="flex items-end">
          <button className="btn-primary w-full" onClick={() => void resolveGene()} disabled={loading}>
            {loading ? "Loading..." : "Resolve Target"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <article className="panel p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">3D Workspace</p>
              <p className="text-sm text-[var(--muted)]">
                Room: <strong>{roomId}</strong> | user: <strong>{userId}</strong>
              </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={reloadScene} disabled={!selectedStructures.length}>
                  Reload Scene
                </button>
              </div>
            </div>

            <div className="mb-3 grid gap-2 lg:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Left structure</span>
                <select
                  className="select"
                  value={leftId}
                  onChange={(event) => {
                    setLeftId(event.target.value);
                    setSceneKey(makeId("scene"));
                  }}
                >
                  <option value="">Select structure</option>
                  {compareCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Right structure
                </span>
                <select
                  className="select"
                  value={rightId}
                  onChange={(event) => {
                    setRightId(event.target.value);
                    setSceneKey(makeId("scene"));
                  }}
                >
                  <option value="">Select structure</option>
                  {compareCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="relative" onMouseMove={onViewerMouseMove}>
              <MolstarViewer
                sceneKey={sceneKey}
                structures={selectedStructures}
                onLog={(line) => setStatus(line)}
              />

              {Object.values(remoteCursors).map((cursor) => (
                <div
                  key={cursor.userId}
                  className="viewer-cursor"
                  style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%`, background: cursor.color }}
                >
                  <span className="viewer-cursor-label">{cursor.userId}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="panel p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Target-to-therapy graph
              </p>
              {target ? <span className="text-sm font-semibold">{target.canonicalGene}</span> : null}
            </div>
            {target ? (
              <>
                <TherapyGraph
                  graph={target.graph}
                  onSelectNode={(nodeId) => {
                    setGraphFocusId(nodeId);
                    pushStory({
                      type: "graph-focus",
                      payload: { nodeId }
                    });
                  }}
                />
                {selectedGraphNode ? (
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Focus node: <strong>{selectedGraphNode.label}</strong>
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-[var(--muted)]">Resolve a target to render the graph.</p>
            )}
          </article>
        </div>

        <aside className="space-y-4">
          <article className="panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Triage score</p>
              <span className={scoreMeta.className}>{scoreMeta.label}</span>
            </div>
            <h2 className="font-[Fraunces] text-4xl">{score}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{status}</p>
            {target?.warnings.length ? (
              <ul className="mt-2 list-disc pl-4 text-xs text-[var(--risk)]">
                {target.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </article>

          <article className="panel p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Confidence storytelling
            </p>
            {confidenceLoading ? <p className="text-sm text-[var(--muted)]">Analyzing pLDDT and PAE...</p> : null}
            {!confidenceLoading && confidence ? (
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span>Average pLDDT</span>
                  <strong>{confidence.avgPlddt.toFixed(1)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>High-confidence residues</span>
                  <strong>{confidence.highConfidenceResidues}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Low-confidence residues</span>
                  <strong>{confidence.lowConfidenceResidues}</strong>
                </div>
                <div className="flex justify-between">
                  <span>PAE mean / max</span>
                  <strong>
                    {confidence.paeMean.toFixed(2)} / {confidence.paeMax.toFixed(2)}
                  </strong>
                </div>
                <div className="h-2 overflow-hidden rounded bg-black/10">
                  <div
                    className="h-full bg-[var(--accent)]"
                    style={{ width: `${Math.min(100, confidence.avgPlddt)}%` }}
                  />
                </div>
              </div>
            ) : null}
            {!confidenceLoading && !confidence ? (
              <p className="text-sm text-[var(--muted)]">No confidence payload available for current selection.</p>
            ) : null}
          </article>

          <article className="panel p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Residue annotations
            </p>

            <div className="grid gap-2">
              <input
                className="input"
                value={annotationResidue}
                onChange={(event) => setAnnotationResidue(event.target.value)}
                placeholder="Residue index"
              />
              <input
                className="input"
                value={annotationLabel}
                onChange={(event) => setAnnotationLabel(event.target.value)}
                placeholder="Annotation text"
              />
              <input
                className="input"
                type="color"
                value={annotationColor}
                onChange={(event) => setAnnotationColor(event.target.value)}
              />
              <button className="btn-primary" onClick={addAnnotation}>
                Add annotation
              </button>
            </div>

            <ul className="mt-3 max-h-48 space-y-2 overflow-auto text-sm">
              {annotations.map((annotation) => (
                <li key={annotation.id} className="rounded border border-[var(--line)] bg-white/60 p-2">
                  <div className="flex items-center justify-between">
                    <strong>Residue {annotation.residue}</strong>
                    <span style={{ color: annotation.color }}>{annotation.author}</span>
                  </div>
                  <p>{annotation.label}</p>
                </li>
              ))}
              {!annotations.length ? <li className="text-[var(--muted)]">No annotations yet.</li> : null}
            </ul>
          </article>

          <article className="panel p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              What changed diff
            </p>
            <ul className="list-disc space-y-1 pl-4 text-sm text-[var(--muted)]">
              <li>
                Mode: <strong>{mode}</strong>
              </li>
              <li>
                Left: <strong>{compareCandidates.find((item) => item.id === leftId)?.label || "n/a"}</strong>
              </li>
              <li>
                Right: <strong>{compareCandidates.find((item) => item.id === rightId)?.label || "n/a"}</strong>
              </li>
              {mutationDiff.map((diff) => (
                <li key={diff}>{diff}</li>
              ))}
            </ul>
          </article>

          <article className="panel p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Collab playback story
              </p>
              <div className="flex gap-1">
                <button className="btn-secondary" onClick={() => setPlaybackActive((state) => !state)}>
                  {playbackActive ? "Pause" : "Play"}
                </button>
                <button className="btn-secondary" onClick={() => void saveStory()}>
                  Share
                </button>
              </div>
            </div>

            <div className="max-h-56 space-y-2 overflow-auto">
              {storyEvents.map((event, index) => (
                <div key={event.id} className={`story-item text-sm ${playbackIndex === index ? "active" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <strong>{event.type}</strong>
                    <span className="text-xs text-[var(--muted)]">{formatTime(event.at)}</span>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{JSON.stringify(event.payload)}</p>
                </div>
              ))}
              {!storyEvents.length ? <p className="text-sm text-[var(--muted)]">No story events yet.</p> : null}
            </div>

            {shareUrl ? (
              <div className="mt-2 rounded border border-[var(--line)] bg-white/60 p-2 text-xs">{shareUrl}</div>
            ) : null}
          </article>

          <article className="panel p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Source trace</p>
            <ul className="source-list space-y-2 text-sm">
              {(target?.sourceTrace || []).map((line, index) => (
                <li key={`${line.source}-${index}`} className="flex items-center justify-between gap-2">
                  <strong>{line.source}</strong>
                  <span className="text-[var(--muted)]">{line.detail}</span>
                </li>
              ))}
            </ul>
          </article>
        </aside>
      </section>
    </main>
  );
}
