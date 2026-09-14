import {
  loadCase,
  readCaseAsset,
  comparisonSchema,
} from "@/lib/investigation/case";
import { apiError, guardLocal, uuid } from "@/lib/investigation/api";
import { getStore, StoreError } from "@/lib/investigation/store";
import {
  experimentBrief,
  panelCsv,
  portableJob,
  type InvestigationBundle,
} from "@/lib/investigation/export";
import { sceneArchive } from "@/lib/investigation/scene";
import { runScientificRequest } from "@/lib/investigation/jobs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    guardLocal(request);
    const id = uuid.parse((await context.params).id),
      store = await getStore(),
      saved = await store.get(id),
      manifest = await loadCase();
    const format = new URL(request.url).searchParams.get("format") || "json";
    if (format === "md" || format === "csv")
      return new Response(
        format === "md"
          ? experimentBrief(saved, manifest)
          : panelCsv(saved.state),
        {
          headers: {
            "Content-Type":
              format === "md"
                ? "text/markdown; charset=utf-8"
                : "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="signal1-${id}.${format}"`,
          },
        },
      );
    if (format === "mvsx") {
      const result = saved.state.comparisonJobId
        ? (await store.getJob(saved.state.comparisonJobId)).result
        : await runScientificRequest("comparison", {
            leftId: saved.state.view.leftId,
            rightId: saved.state.view.rightId,
            positions: [],
          });
      const archive = await sceneArchive(
        saved.state,
        manifest,
        comparisonSchema.parse(result),
      );
      return new Response(archive, {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="signal1-${id}.mvsx"`,
        },
      });
    }
    if (format !== "json")
      throw new StoreError(
        "Choose JSON, Markdown, CSV or a molecular scene export.",
        400,
      );
    const jobs = [];
    for (const jobId of [
      saved.state.comparisonJobId,
      saved.state.baselineJobId,
    ])
      if (jobId) {
        const job = await store.getJob(jobId);
        if (job.investigationId !== id || job.status !== "completed")
          throw new StoreError(
            "Wait for saved calculations to finish, or remove them before exporting.",
            409,
          );
        jobs.push(portableJob(job));
      }
    const assets = await Promise.all(
      manifest.assets.map(async (asset) => ({
        path: asset.path,
        sha256: asset.sha256,
        data: (await readCaseAsset(manifest, asset.path)).toString("base64"),
      })),
    );
    const bundle: InvestigationBundle = {
      format: "signal1-investigation",
      version: 1,
      exportedAt: new Date().toISOString(),
      manifest,
      investigation: saved,
      assets,
      jobs,
    };
    return Response.json(bundle, {
      headers: {
        "Content-Disposition": `attachment; filename="signal1-${id}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
