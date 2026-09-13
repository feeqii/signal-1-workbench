import type { InvestigationState } from "./schema";
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
