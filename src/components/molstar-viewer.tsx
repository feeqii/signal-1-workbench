"use client";
import { useEffect, useRef, useState } from "react";
import {
  resetFramedCamera,
  applyInvestigationCamera,
  observeSettledCamera,
} from "@/lib/investigation/camera-persistence";
import { PluginContext } from "molstar/lib/mol-plugin/context";
import { PluginBehaviors } from "molstar/lib/mol-plugin/behavior";
import { DefaultPluginSpec } from "molstar/lib/mol-plugin/spec";
import { Color } from "molstar/lib/mol-util/color";
import { Asset } from "molstar/lib/mol-util/assets";
import {
  StructureElement,
  StructureProperties,
  type Structure,
} from "molstar/lib/mol-model/structure";
import { OrderedSet } from "molstar/lib/mol-data/int";
import { MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import { Mat4, Vec3 } from "molstar/lib/mol-math/linear-algebra";
import type { Camera } from "molstar/lib/mol-canvas3d/camera";
import type {
  CaseManifest,
  Comparison,
  InvestigationState,
  ResidueMapping,
} from "@/lib/investigation/schema";
import {
  mappedResidues,
  referenceForLabel,
  transformMatrix,
} from "@/lib/investigation/view-state";

type Props = {
  investigationId: string;
  structures: CaseManifest["structures"];
  frameStructure: CaseManifest["structures"][number];
  comparison: Comparison;
  positions: number[];
  camera: InvestigationState["view"]["camera"];
  onCamera: (camera: NonNullable<InvestigationState["view"]["camera"]>) => void;
  onPosition: (position: number) => void;
  focus: number;
  reset: number;
};
type Loaded = { structure: Structure; mapping: ResidueMapping[] };

function cameraSnapshot(
  saved: InvestigationState["view"]["camera"],
): Partial<Camera.Snapshot> | null {
  return saved
    ? {
        ...saved,
        position: Vec3.create(...saved.position),
        target: Vec3.create(...saved.target),
        up: Vec3.create(...saved.up),
      }
    : null;
}
export function MolstarViewer(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    canvasMount = useRef<HTMLDivElement>(null),
    plugin = useRef<PluginContext | null>(null),
    loaded = useRef<Loaded[]>([]),
    latest = useRef(props),
    queue = useRef<Promise<void>>(Promise.resolve());
  const lastFocus = useRef(props.focus);
  const frameCamera = useRef<Partial<Camera.Snapshot> | null>(null);
  const [message, setMessage] = useState("Loading experimental coordinates…");
  useEffect(() => {
    latest.current = props;
  });
  const sceneKey =
    props.structures.map((s) => s.id).join("|") +
    JSON.stringify([props.comparison.rotation, props.comparison.translation]);
  useEffect(() => {
    let disposed = false;
    let local: PluginContext | undefined;
    let localCanvas: HTMLCanvasElement | undefined;
    const subscriptions: { unsubscribe: () => void }[] = [];
    const setup = async () => {
      if (disposed || !host.current || !canvasMount.current) return;
      setMessage("Loading experimental coordinates…");
      const spec = DefaultPluginSpec();
      spec.behaviors = spec.behaviors.filter(
        (b) => b.transformer !== PluginBehaviors.Camera.FocusLoci,
      );
      local = new PluginContext(spec);
      await local.init();
      if (disposed) {
        local.dispose();
        return;
      }
      // Each plugin owns a fresh canvas, including Strict Mode and hot-reload restarts.
      // Disposing Mol* deliberately loses its WebGL context, which cannot be reused.
      localCanvas = document.createElement('canvas');
      localCanvas.setAttribute('aria-label', 'Interactive experimental KRAS structure. Drag to rotate; click a residue to select it.');
      localCanvas.tabIndex = 0;
      canvasMount.current!.replaceChildren(localCanvas);
      if (!(await local.initViewerAsync(localCanvas, host.current!)))
        throw new Error(
          "WebGL is unavailable. Sequence and assay selection remain usable.",
        );
      plugin.current = local;
      local.canvas3d?.setProps({
        renderer: { backgroundColor: Color(0x141e22) },
      });
      const observer = new ResizeObserver(() => { if (!disposed) local?.handleResize(); });
      observer.observe(host.current!);
      subscriptions.push({ unsubscribe: () => observer.disconnect() });
      loaded.current = [];
      for (const item of latest.current.structures) {
        if (disposed) return;
        const response = await fetch(item.mappingUrl);
        if (!response.ok)
          throw new Error("Residue mapping could not be loaded.");
        const mapping: ResidueMapping[] = await response.json();
        const data = await local.builders.data.download(
          { url: Asset.Url(item.url), isBinary: false },
          { state: { isGhost: true } },
        );
        const trajectory = await local.builders.structure.parseTrajectory(
          data,
          "mmcif",
        );
        const model = await local.builders.structure.createModel(trajectory);
        let structure = await local.builders.structure.createStructure(model, {
          name: "model",
          params: {},
        });
        if (item.id === latest.current.comparison.rightId) {
          structure = await local
            .build()
            .to(structure)
            .apply(StateTransforms.Model.TransformStructureConformation, {
              transform: {
                name: "matrix",
                params: {
                  data: transformMatrix(latest.current.comparison) as Mat4,
                  transpose: false,
                },
              },
            })
            .commit();
        }
        const component =
          await local.builders.structure.tryCreateComponentFromExpression(
            structure,
            MS.struct.generator.atomGroups({
              "chain-test": MS.core.rel.eq([
                MS.struct.atomProperty.macromolecular.label_asym_id(),
                item.chainId,
              ]),
            }),
            `chain-${item.id}`,
          );
        if (!component?.obj)
          throw new Error(
            `Chain ${item.chainId} was not found in ${item.pdbId}.`,
          );
        await local.builders.structure.representation.addRepresentation(
          component,
          {
            type: "cartoon",
            color: "uniform",
            colorParams: {
              value: Color(
                item.id === latest.current.comparison.leftId
                  ? 0xe5a35e
                  : 0x67cbd6,
              ),
            },
          },
        );
        loaded.current.push({ structure: component.obj.data, mapping });
      }
      if (disposed) return;
      subscriptions.push(
        local.behaviors.interaction.click.subscribe((event) => {
          const loci = event.current.loci;
          if (!StructureElement.Loci.is(loci) || !loci.elements.length) return;
          const element = loci.elements[0],
            index = OrderedSet.getAt(element.indices, 0),
            location = StructureElement.Location.create(
              loci.structure,
              element.unit,
              element.unit.elements[index],
            );
          const seq = StructureProperties.residue.label_seq_id(location),
            chain = StructureProperties.chain.label_asym_id(location);
          const source = loaded.current.find((entry) =>
            entry.structure.models.includes(element.unit.model),
          );
          const position = referenceForLabel(source?.mapping ?? [], chain, seq);
          if (position !== null) latest.current.onPosition(position);
        }),
      );
      const frameResponse = await fetch(
        latest.current.frameStructure.mappingUrl,
      );
      if (!frameResponse.ok)
        throw new Error("Shared camera frame could not be loaded.");
      const frameMapping: ResidueMapping[] = await frameResponse.json();
      if (disposed) return;
      const coords = frameMapping.flatMap((row) => (row.ca ? [row.ca] : []));
      const center = Vec3.create(
        ...([0, 1, 2].map(
          (axis) =>
            coords.reduce((sum, point) => sum + point[axis], 0) / coords.length,
        ) as [number, number, number]),
      );
      const radius = Math.max(
        ...coords.map((point) => Vec3.distance(center, Vec3.create(...point))),
      );
      frameCamera.current =
        local.canvas3d?.camera.getFocus(center, radius) ?? null;
      if (latest.current.camera)
        local.canvas3d?.camera.setState(
          cameraSnapshot(latest.current.camera)!,
          0,
        );
      else if (frameCamera.current)
        local.canvas3d?.camera.setState(frameCamera.current, 0);
      const renderedCamera = local.canvas3d?.camera;
      if (renderedCamera) {
        const stopObserving = observeSettledCamera(
          renderedCamera,
          (snapshot) => {
            if (!disposed)
              latest.current.onCamera(JSON.parse(JSON.stringify(snapshot)));
          },
        );
        subscriptions.push({ unsubscribe: stopObserving });
      }
      markSelection();
      setMessage("");
    };
    queue.current = queue.current
      .catch(() => {})
      .then(setup)
      .catch((error) => {
        if (!disposed)
          setMessage(
            error instanceof Error ? error.message : "Molecular viewer failed.",
          );
      });
    return () => {
      disposed = true;
      subscriptions.forEach((s) => s.unsubscribe());
      queue.current = queue.current
        .catch(() => {})
        .then(() => {
          local?.dispose();
          localCanvas?.remove();
          if (plugin.current === local) {
            plugin.current = null;
            loaded.current = [];
          }
        });
    };
    // A scene is rebuilt only when its structure identities or fitted transform change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);
  function lociFor(entry: Loaded) {
    const selected = mappedResidues(entry.mapping, latest.current.positions);
    return StructureElement.Loci.fromExpression(
      entry.structure,
      MS.struct.generator.atomGroups({
        "chain-test": MS.core.rel.eq([
          MS.struct.atomProperty.macromolecular.label_asym_id(),
          selected[0]?.labelChain || "A",
        ]),
        "residue-test": MS.core.set.has([
          MS.set(...selected.map((row) => row.labelSeq!)),
          MS.struct.atomProperty.macromolecular.label_seq_id(),
        ]),
      }),
    );
  }
  function markSelection() {
    const current = plugin.current;
    if (!current) return;
    current.managers.interactivity.lociSelects.deselectAll();
    for (const entry of loaded.current)
      current.managers.interactivity.lociSelects.select({
        loci: lociFor(entry),
      });
  }
  useEffect(() => {
    markSelection();
  });
  useEffect(() => {
    const camera = plugin.current?.canvas3d?.camera;
    if (camera)
      applyInvestigationCamera(
        camera,
        cameraSnapshot(props.camera),
        frameCamera.current,
      );
  }, [props.camera, props.investigationId]);
  useEffect(() => {
    if (props.focus === lastFocus.current) return;
    lastFocus.current = props.focus;
    const loci = loaded.current.map(lociFor).filter((l) => l.elements.length);
    if (loci.length)
      plugin.current?.managers.camera.focusLoci(loci, { durationMs: 0 });
  }, [props.focus]);
  useEffect(() => {
    const camera = plugin.current?.canvas3d?.camera;
    if (props.reset && frameCamera.current && camera)
      resetFramedCamera(camera, frameCamera.current);
  }, [props.reset]);
  return (
    <div className="molecular-viewport" ref={host}>
      <div className="viewer-canvas" ref={canvasMount} />
      {message && (
        <div className="viewer-message" role="status">
          {message}
        </div>
      )}
    </div>
  );
}
