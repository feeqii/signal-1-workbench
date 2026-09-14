import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { acquireDatabaseLock } from "./database-lock";
import { resolve } from "node:path";
import type { InvestigationState, SavedInvestigation } from "./schema";
import { canonicalJson, sha256 } from "./hash";

export class StoreError extends Error {
  name = "Signal1StoreError";
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export type JobRequest = {
  investigationId: string;
  inputRevision: number;
  type: "comparison" | "baseline";
  input: Record<string, unknown>;
  inputHashes: string[];
};
export type Job = JobRequest & {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  attempts: number;
  leaseToken: string | null;
  leaseUntil: number | null;
  result: unknown;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};
type JobRow = {
  id: string;
  request: JobRequest;
  status: Job["status"];
  attempts: number;
  lease_token: string | null;
  lease_until: number | null;
  result: unknown;
  error: string | null;
  created_at: string;
  updated_at: string;
};
const asJob = (row: JobRow): Job => ({
  ...row.request,
  id: row.id,
  status: row.status,
  attempts: row.attempts,
  leaseToken: row.lease_token,
  leaseUntil: row.lease_until,
  result: row.result,
  error: row.error,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function createStore(path: string) {
  const release =
    path === "memory://" ? async () => {} : await acquireDatabaseLock(path);
  const db = new PGlite(path === "memory://" ? path : resolve(path, "pg"));
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS investigations (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, state JSONB NOT NULL);
      CREATE TABLE IF NOT EXISTS revisions (investigation_id TEXT REFERENCES investigations(id), revision INTEGER NOT NULL, state JSONB NOT NULL, content_hash TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(investigation_id,revision));
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, input_key TEXT UNIQUE NOT NULL, request JSONB NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, lease_token TEXT, lease_until DOUBLE PRECISION, result JSONB, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS jobs_pending ON jobs(status,lease_until);
    `);
  } catch (error) {
    await db.close();
    await release();
    throw error;
  }
  const columns =
    'id, revision, created_at AS "createdAt", updated_at AS "updatedAt", state';
  return {
    async close() {
      await db.close();
      await release();
    },
    async restore(
      original: InvestigationState,
      jobs: Pick<
        Job,
        "id" | "type" | "input" | "inputHashes" | "inputRevision" | "result"
      >[],
    ): Promise<SavedInvestigation> {
      const id = randomUUID(),
        at = new Date().toISOString(),
        state = structuredClone(original);
      const identifiers = new Map(jobs.map((job) => [job.id, randomUUID()]));
      state.comparisonJobId = state.comparisonJobId
        ? (identifiers.get(state.comparisonJobId) ?? null)
        : null;
      state.baselineJobId = state.baselineJobId
        ? (identifiers.get(state.baselineJobId) ?? null)
        : null;
      await db.transaction(async (tx) => {
        await tx.query("INSERT INTO investigations VALUES ($1,1,$2,$2,$3)", [
          id,
          at,
          JSON.stringify(state),
        ]);
        await tx.query("INSERT INTO revisions VALUES ($1,1,$2,$3,$4)", [
          id,
          JSON.stringify(state),
          sha256(canonicalJson(state)),
          at,
        ]);
        for (const job of jobs) {
          const request: JobRequest = {
            investigationId: id,
            inputRevision: 1,
            type: job.type,
            input: job.input,
            inputHashes: job.inputHashes,
          };
          await tx.query(
            "INSERT INTO jobs(id,input_key,request,status,result,created_at,updated_at) VALUES ($1,$2,$3,'completed',$4,$5,$5)",
            [
              identifiers.get(job.id),
              sha256(canonicalJson(request)),
              JSON.stringify(request),
              JSON.stringify(job.result),
              at,
            ],
          );
        }
      });
      return { id, revision: 1, createdAt: at, updatedAt: at, state };
    },
    async create(state: InvestigationState): Promise<SavedInvestigation> {
      const id = randomUUID(),
        at = new Date().toISOString();
      await db.transaction(async (tx) => {
        await tx.query("INSERT INTO investigations VALUES ($1,1,$2,$2,$3)", [
          id,
          at,
          JSON.stringify(state),
        ]);
        await tx.query("INSERT INTO revisions VALUES ($1,1,$2,$3,$4)", [
          id,
          JSON.stringify(state),
          sha256(canonicalJson(state)),
          at,
        ]);
      });
      return { id, revision: 1, createdAt: at, updatedAt: at, state };
    },
    async get(id: string): Promise<SavedInvestigation> {
      const result = await db.query<SavedInvestigation>(
        `SELECT ${columns} FROM investigations WHERE id=$1`,
        [id],
      );
      if (!result.rows[0])
        throw new StoreError("Investigation not found.", 404);
      return result.rows[0];
    },
    async list(): Promise<SavedInvestigation[]> {
      return (
        await db.query<SavedInvestigation>(
          `SELECT ${columns} FROM investigations ORDER BY updated_at DESC LIMIT 100`,
        )
      ).rows;
    },
    async save(
      id: string,
      expectedRevision: number,
      state: InvestigationState,
    ): Promise<SavedInvestigation> {
      return db.transaction(async (tx) => {
        const at = new Date().toISOString();
        const result = await tx.query<SavedInvestigation>(
          `UPDATE investigations SET revision=revision+1,state=$3,updated_at=$4 WHERE id=$1 AND revision=$2 RETURNING ${columns}`,
          [id, expectedRevision, JSON.stringify(state), at],
        );
        if (!result.rows[0])
          throw new StoreError(
            "This investigation changed in another view. Reload the saved revision before applying your edits.",
            409,
          );
        const saved = result.rows[0];
        await tx.query("INSERT INTO revisions VALUES ($1,$2,$3,$4,$5)", [
          id,
          saved.revision,
          JSON.stringify(state),
          sha256(canonicalJson(state)),
          at,
        ]);
        return saved;
      });
    },
    async revisions(id: string) {
      return (
        await db.query<{
          revision: number;
          state: InvestigationState;
          content_hash: string;
        }>(
          "SELECT revision,state,content_hash FROM revisions WHERE investigation_id=$1 ORDER BY revision",
          [id],
        )
      ).rows;
    },
    async enqueue(request: JobRequest): Promise<Job> {
      return db.transaction(async (tx) => {
        const owner = (
          await tx.query<{ revision: number }>(
            "SELECT revision FROM investigations WHERE id=$1",
            [request.investigationId],
          )
        ).rows[0];
        if (!owner) throw new StoreError("Investigation not found.", 404);
        if (owner.revision !== request.inputRevision)
          throw new StoreError(
            "Save the current investigation before requesting a calculation.",
            409,
          );
        const key = sha256(canonicalJson(request)),
          at = new Date().toISOString();
        await tx.query(
          `INSERT INTO jobs(id,input_key,request,status,created_at,updated_at) VALUES ($1,$2,$3,'queued',$4,$4) ON CONFLICT(input_key) DO UPDATE SET status=CASE WHEN jobs.status IN ('cancelled','failed') THEN 'queued' ELSE jobs.status END, attempts=CASE WHEN jobs.status IN ('cancelled','failed') THEN 0 ELSE jobs.attempts END, error=CASE WHEN jobs.status IN ('cancelled','failed') THEN NULL ELSE jobs.error END`,
          [randomUUID(), key, JSON.stringify(request), at],
        );
        return asJob(
          (
            await tx.query<JobRow>("SELECT * FROM jobs WHERE input_key=$1", [
              key,
            ])
          ).rows[0],
        );
      });
    },
    async getJob(id: string): Promise<Job> {
      const row = (
        await db.query<JobRow>("SELECT * FROM jobs WHERE id=$1", [id])
      ).rows[0];
      if (!row) throw new StoreError("Calculation not found.", 404);
      return asJob(row);
    },
    async claim(now = Date.now(), leaseMs = 60_000): Promise<Job | null> {
      return db.transaction(async (tx) => {
        await tx.query(
          "UPDATE jobs SET status='failed',error='Worker stopped repeatedly. Retry the calculation.',lease_token=NULL,lease_until=NULL WHERE status='running' AND lease_until<$1 AND attempts>=3",
          [now],
        );
        const row = (
          await tx.query<JobRow>(
            "SELECT * FROM jobs WHERE attempts<3 AND (status='queued' OR (status='running' AND lease_until<$1)) ORDER BY created_at LIMIT 1",
            [now],
          )
        ).rows[0];
        if (!row) return null;
        const token = randomUUID(),
          at = new Date().toISOString();
        return asJob(
          (
            await tx.query<JobRow>(
              "UPDATE jobs SET status='running',attempts=attempts+1,lease_token=$2,lease_until=$3,updated_at=$4 WHERE id=$1 RETURNING *",
              [row.id, token, now + leaseMs, at],
            )
          ).rows[0],
        );
      });
    },
    async heartbeat(id: string, token: string) {
      await db.query(
        "UPDATE jobs SET lease_until=$3 WHERE id=$1 AND lease_token=$2 AND status='running'",
        [id, token, Date.now() + 60_000],
      );
    },
    async finish(id: string, token: string, result: unknown): Promise<boolean> {
      const update = await db.query(
        "UPDATE jobs SET status='completed',result=$3,error=NULL,lease_token=NULL,lease_until=NULL,updated_at=$4 WHERE id=$1 AND lease_token=$2 AND status='running' RETURNING id",
        [id, token, JSON.stringify(result), new Date().toISOString()],
      );
      return update.rows.length === 1;
    },
    async fail(id: string, token: string, message: string) {
      await db.query(
        "UPDATE jobs SET status=CASE WHEN attempts<3 THEN 'queued' ELSE 'failed' END,error=$3,lease_token=NULL,lease_until=NULL,updated_at=$4 WHERE id=$1 AND lease_token=$2 AND status='running'",
        [id, token, message.slice(0, 2000), new Date().toISOString()],
      );
    },
    async cancel(id: string): Promise<Job> {
      await db.query(
        "UPDATE jobs SET status='cancelled',lease_token=NULL,lease_until=NULL,updated_at=$2 WHERE id=$1 AND status IN ('queued','running')",
        [id, new Date().toISOString()],
      );
      const row = (
        await db.query<JobRow>("SELECT * FROM jobs WHERE id=$1", [id])
      ).rows[0];
      if (!row) throw new StoreError("Calculation not found.", 404);
      return asJob(row);
    },
  };
}
export type InvestigationStore = Awaited<ReturnType<typeof createStore>>;
const runtime = globalThis as typeof globalThis & {
  signalInvestigationStore?: Promise<InvestigationStore>;
};
export function getStore() {
  runtime.signalInvestigationStore ??= createStore(
    process.env.SIGNAL1_DATA_DIR || resolve(process.cwd(), ".signal1/data"),
  ).catch((error) => {
    runtime.signalInvestigationStore = undefined;
    throw error;
  });
  return runtime.signalInvestigationStore;
}
