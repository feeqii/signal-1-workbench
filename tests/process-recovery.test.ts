import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SavedInvestigation } from "../src/lib/investigation/schema";
import type { Job } from "../src/lib/investigation/store";

function owner(path: string, mode: string) {
  return spawn(
    process.execPath,
    ["--import", "tsx", "tests/support/store-owner.ts", path, mode],
    { stdio: ["ignore", "ignore", "pipe", "ipc"] },
  );
}
function result(
  child: ChildProcess,
): Promise<{ saved: SavedInvestigation; job: Job; revisionCount: number }> {
  return new Promise((resolve, reject) => {
    let errors = "";
    child.stderr!.on("data", (chunk) => {
      errors += chunk.toString();
    });
    child.once("message", (message) => resolve(message as never));
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) reject(new Error(errors || `Owner exited ${code}`));
    });
  });
}
test(
  "a fresh process recovers committed research and an abandoned job after its owner is killed",
  { timeout: 20000 },
  async () => {
    const path = await mkdtemp(join(tmpdir(), "signal-crash-recovery-"));
    const first = owner(path, "create");
    let second: ChildProcess | undefined;
    try {
      const before = await result(first);
      const exited = once(first, "exit");
      first.kill("SIGKILL");
      await exited;
      second = owner(path, "recover");
      const finished = once(second, "exit");
      const after = await result(second);
      assert.deepEqual(after.saved, before.saved);
      assert.equal(after.saved.revision, 2);
      assert.equal(after.revisionCount, 2);
      assert.equal(after.job.id, before.job.id);
      assert.equal(after.job.attempts, 2);
      assert.notEqual(after.job.leaseToken, before.job.leaseToken);
      assert.equal((await finished)[0], 0);
    } finally {
      first.kill("SIGKILL");
      second?.kill("SIGKILL");
      await rm(path, { recursive: true, force: true });
    }
  },
);
