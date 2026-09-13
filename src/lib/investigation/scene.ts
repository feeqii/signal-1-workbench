import { MVSData } from "molstar/lib/commonjs/extensions/mvs/mvs-data";
import type {
  CaseManifest,
  Comparison,
  InvestigationState,
  ResidueMapping,
} from "./schema";
import { readCaseAsset } from "./case";

export function makeScene(
  state: InvestigationState,
  manifest: CaseManifest,
  comparison: Comparison,
  mappings: Record<string, ResidueMapping[]>,
) {
  if (
    comparison.leftId !== state.view.leftId ||
    comparison.rightId !== state.view.rightId
  )
    throw new Error(
      "The scene requires a comparison for the saved structure pair.",
    );
  const builder = MVSData.createBuilder();
  const sources = manifest.structures
    .map((structure) => {
      const asset = manifest.assets.find(
        (item) => item.path === structure.url.replace("/case/kras/", ""),
      );
      return `${structure.id}: ${asset?.sourceUrl}; ${asset?.license}; SHA-256 ${structure.sha256}`;
    })
    .join("\n");
  builder.canvas({ background_color: "#101915" });
  for (const id of [state.view.leftId, state.view.rightId]) {
    const item = manifest.structures.find((s) => s.id === id);
    if (!item || !mappings[id])
      throw new Error("The scene is missing a structure or residue map.");
    const structure = builder
      .download({ url: item.url.replace("/case/kras/", "") })
      .parse({ format: "mmcif" })
      .modelStructure({ model_index: 0 });
    if (id === comparison.rightId)
      structure.transform({
        rotation: [0, 1, 2].flatMap((column) =>
          [0, 1, 2].map((row) => comparison.rotation[row][column]),
        ),
        translation: comparison.translation as [number, number, number],
      });
    const representation = structure
      .component({ selector: { label_asym_id: item.chainId } })
      .representation({ type: "cartoon" })
      .color({ color: id === comparison.leftId ? "#e5a35e" : "#67cbd6" });
    const selector = mappings[id]
      .filter(
        (row) =>
          state.selectedPositions.includes(row.referencePosition) &&
          row.ca &&
          row.labelSeq !== null,
      )
      .map((row) => ({
        label_asym_id: row.labelChain,
        label_seq_id: row.labelSeq!,
      }));
    if (selector.length) representation.color({ selector, color: "#e9f28c" });
  }
  const camera = state.view.camera;
  if (
    camera &&
    Array.isArray(camera.position) &&
    Array.isArray(camera.target) &&
    Array.isArray(camera.up)
  )
    builder.camera({
      position: camera.position as [number, number, number],
      target: camera.target as [number, number, number],
      up: camera.up as [number, number, number],
    });
  return builder.getState({
    title: state.title,
    description: `${state.question}\n\nDescriptive fitted overlay: ${comparison.count} Cα pairs; RMSD ${comparison.rmsd.toFixed(4)} Å. ${comparison.fitScope}.\n\n${manifest.structures.map((s) => s.context).join("\n\n")}\n\nSelected reference residues: ${state.selectedPositions.join(", ") || "none"}. The archive retains an overlay when the workspace is in split mode. Scientific evidence, findings and experiment panels are in the separate investigation JSON bundle.\n\nCoordinate sources:\n${sources}\nReference: UniProt ${manifest.reference.isoform}; CC BY 4.0; sequence SHA-256 ${manifest.reference.sequenceHash}.\n${manifest.provenance.map((source) => `${source.source}: ${source.url} (${source.license})`).join("\n")}`,
    description_format: "plaintext",
  });
}
export async function sceneArchive(
  state: InvestigationState,
  manifest: CaseManifest,
  comparison: Comparison,
): Promise<Uint8Array<ArrayBuffer>> {
  const mappings: Record<string, ResidueMapping[]> = {},
    assets: Record<string, Uint8Array<ArrayBuffer>> = {};
  for (const id of [state.view.leftId, state.view.rightId]) {
    const structure = manifest.structures.find((s) => s.id === id)!;
    const path = structure.url.replace("/case/kras/", ""),
      mapPath = structure.mappingUrl.replace("/case/kras/", "");
    assets[path] = new Uint8Array(await readCaseAsset(manifest, path));
    mappings[id] = JSON.parse(
      (await readCaseAsset(manifest, mapPath)).toString(),
    );
  }
  return MVSData.toMVSX(makeScene(state, manifest, comparison, mappings), {
    assets,
  });
}
