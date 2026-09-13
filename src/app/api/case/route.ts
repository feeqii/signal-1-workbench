import {
  loadCase,
  readCaseAsset,
  comparisonSchema,
  baselineSchema,
} from "@/lib/investigation/case";
import { apiError, guardLocal } from "@/lib/investigation/api";
import { z } from "zod";
import { parseVariant } from "@/lib/investigation/schema";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    guardLocal(request);
    const manifest = await loadCase();
    const [observationsBytes, comparisonBytes, baselineBytes] =
      await Promise.all(
        ["observations.json", "comparison.json", "baseline.json"].map((path) =>
          readCaseAsset(manifest, path),
        ),
      );
    const observations = z
      .array(
        z.object({
          variant: z.string(),
          positions: z.array(z.number().int().min(1).max(188)),
          abundance: z.number().finite().nullable(),
          binding: z.number().finite().nullable(),
        }),
      )
      .parse(JSON.parse(observationsBytes.toString()));
    for (const row of observations) {
      const parsed = parseVariant(row.variant, manifest.reference.sequence);
      if (JSON.stringify(parsed.positions) !== JSON.stringify(row.positions))
        throw new Error("An observation has inconsistent residue positions.");
    }
    return Response.json(
      {
        manifest,
        observations,
        comparison: comparisonSchema.parse(
          JSON.parse(comparisonBytes.toString()),
        ),
        baseline: baselineSchema.parse(JSON.parse(baselineBytes.toString())),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
