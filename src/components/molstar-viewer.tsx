"use client";

import { useEffect, useRef, useState } from "react";

import type { StructureCandidate } from "@/lib/types";

type MolstarViewerApi = {
  loadPdb: (id: string) => Promise<void>;
  loadAlphaFoldDb: (id: string) => Promise<void>;
  loadStructureFromUrl: (
    url: string,
    format?: string,
    isBinary?: boolean,
    options?: { label?: string }
  ) => Promise<void>;
  loadModelArchive: (id: string) => Promise<void>;
  dispose?: () => void;
};

declare global {
  interface Window {
    molstar?: {
      Viewer: {
        create: (target: HTMLElement, options?: Record<string, unknown>) => Promise<MolstarViewerApi>;
      };
    };
  }
}

let molstarScriptPromise: Promise<void> | null = null;

function ensureMolstarAssets(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (!document.getElementById("molstar-css")) {
    const link = document.createElement("link");
    link.id = "molstar-css";
    link.rel = "stylesheet";
    link.href = "https://cdn.jsdelivr.net/npm/molstar/build/viewer/molstar.css";
    document.head.append(link);
  }

  if (!molstarScriptPromise) {
    molstarScriptPromise = new Promise<void>((resolve, reject) => {
      if (window.molstar?.Viewer) {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/molstar/build/viewer/molstar.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Mol* script"));
      document.body.append(script);
    });
  }

  return molstarScriptPromise;
}

async function loadStructure(viewer: MolstarViewerApi, item: StructureCandidate) {
  if (item.source === "alphafold") {
    await viewer.loadAlphaFoldDb(item.loadId);
    return;
  }

  if (item.source === "pdb") {
    await viewer.loadPdb(item.loadId);
    return;
  }

  if (item.source === "modelarchive") {
    await viewer.loadModelArchive(item.loadId);
    return;
  }

  await viewer.loadStructureFromUrl(item.loadId, "pdb", false, { label: item.label });
}

export function MolstarViewer({
  structures,
  sceneKey,
  onLog
}: {
  structures: StructureCandidate[];
  sceneKey: string;
  onLog?: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onLogRef = useRef(onLog);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onLogRef.current = onLog;
  }, [onLog]);

  useEffect(() => {
    let cancelled = false;
    const sceneStructures = structures;

    async function boot() {
      try {
        setError(null);
        await ensureMolstarAssets();

        if (!containerRef.current || cancelled) {
          return;
        }

        containerRef.current.replaceChildren();

        const viewer = await window.molstar!.Viewer.create(containerRef.current, {
          layoutShowLeftPanel: true,
          layoutShowSequence: true,
          layoutShowLog: false,
          viewportShowExpand: false,
          viewportShowSettings: true,
          viewportShowAnimation: false,
          viewportShowSelectionMode: true,
          collapseRightPanel: true,
          collapseLeftPanel: false,
          illumination: true,
          viewportBackgroundColor: "#050a08"
        });

        if (cancelled) {
          return;
        }

        for (const structure of sceneStructures) {
          onLogRef.current?.(`Loading ${structure.label} in Mol*...`);
          await loadStructure(viewer, structure);
        }

        onLogRef.current?.("Mol* scene ready.");
      } catch (caught) {
        setError((caught as Error).message || "Failed to initialize Mol*");
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [sceneKey, structures]);

  return (
    <div className="viewer-shell">
      <div ref={containerRef} className="h-full w-full" />
      {error ? (
        <div className="absolute left-3 top-3 rounded-md bg-red-600/90 px-2 py-1 text-xs text-white">
          {error}
        </div>
      ) : null}
    </div>
  );
}
