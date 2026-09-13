import type {
  CaseManifest,
  Observation,
  Comparison,
  PriorBaseline,
  InvestigationState,
  SavedInvestigation,
} from "./schema";
export type CaseData = {
  manifest: CaseManifest;
  observations: Observation[];
  comparison: Comparison;
  baseline: PriorBaseline;
};
export type ClientJob = {
  id: string;
  investigationId: string;
  inputRevision: number;
  type: "comparison" | "baseline";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  input: Record<string, unknown>;
  result: Comparison | PriorBaseline | null;
  error: string | null;
};
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await response.json();
  if (!response.ok)
    throw new ApiError(
      body.error || `Request failed (${response.status}).`,
      response.status,
    );
  return body as T;
}
export class DraftSession {
  locked = false;
  state: InvestigationState;
  private version = 0;
  private savedVersion = 0;
  private pending: Promise<SavedInvestigation> | null = null;
  constructor(
    public saved: SavedInvestigation,
    private writer = (
      id: string,
      body: { expectedRevision: number; state: InvestigationState },
    ) =>
      request<SavedInvestigation>(`/api/investigations/${id}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
  ) {
    this.state = saved.state;
  }
  get dirty() {
    return this.version !== this.savedVersion;
  }
  edit(state: InvestigationState) {
    if (this.locked) return false;
    this.state = state;
    this.version++;
    return true;
  }
  flush(): Promise<SavedInvestigation> {
    if (this.pending) return this.pending;
    this.pending = (async () => {
      while (this.dirty) {
        const version = this.version;
        this.saved = await this.writer(this.saved.id, {
          expectedRevision: this.saved.revision,
          state: this.state,
        });
        this.savedVersion = version;
        if (this.version === version) this.state = this.saved.state;
      }
      return this.saved;
    })().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
}

/** Keep the source draft immutable until a switch has either installed its destination or failed. */
export async function withDraftTransition<T>(
  session: DraftSession,
  load: () => Promise<T>,
  install: (value: T) => void | Promise<void>,
  save: () => Promise<unknown> = () => session.flush(),
): Promise<void> {
  if (session.locked) throw new Error('An investigation switch is already in progress.');
  session.locked = true;
  try {
    await save();
    const value = await load();
    await install(value);
  } finally {
    session.locked = false;
  }
}
