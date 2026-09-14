import type { CaseManifest, InvestigationState } from "./schema";
import { canonicalJson } from "./hash";
import type { InvestigationStore } from "./store";
import { StoreError } from "./store";

export async function reconcileJobLinks(
  input: InvestigationState,
  investigationId: string,
  store: InvestigationStore,
): Promise<InvestigationState> {
  const state = structuredClone(input);
  for (const [jobId, type] of [
    [state.comparisonJobId, "comparison"],
    [state.baselineJobId, "baseline"],
  ]) {
    if (!jobId) continue;
    const job = await store.getJob(jobId);
    if (job.investigationId !== investigationId || job.type !== type)
      throw new StoreError(
        "This calculation belongs to another investigation.",
        400,
      );
    if (
      type === "comparison" &&
      (job.input.leftId !== state.view.leftId ||
        job.input.rightId !== state.view.rightId)
    )
      state.comparisonJobId = null;
  }
  return state;
}

/** A copied research record owns independent calculation identities. */
export async function createWithLocalResults(
  state: InvestigationState,
  manifest: CaseManifest,
  store: InvestigationStore,
) {
  const references = [
    [state.comparisonJobId, "comparison"],
    [state.baselineJobId, "baseline"],
  ] as const;
  const jobs = [];
  let owner: string | undefined;
  const expectedHashes = canonicalJson(
    manifest.assets.map((asset) => asset.sha256).sort(),
  );
  for (const [id, type] of references) {
    if (!id) continue;
    const job = await store.getJob(id);
    if (job.type !== type)
      throw new StoreError("The copied calculation has the wrong type.", 400);
    if (job.status !== "completed")
      throw new StoreError("Only completed calculations can be copied.", 409);
    if (owner && owner !== job.investigationId)
      throw new StoreError(
        "Copied calculations must belong to the same investigation.",
        400,
      );
    owner = job.investigationId;
    if (
      type === "comparison" &&
      (job.input.leftId !== state.view.leftId ||
        job.input.rightId !== state.view.rightId)
    )
      throw new StoreError(
        "The copied comparison does not match this structure pair.",
        400,
      );
    if (canonicalJson([...job.inputHashes].sort()) !== expectedHashes)
      throw new StoreError(
        "The copied calculation belongs to a different case version.",
        409,
      );
    jobs.push(job);
  }
  return jobs.length ? store.restore(state, jobs) : store.create(state);
}
