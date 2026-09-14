import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, open, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { pythonExecutable } from "../src/lib/investigation/python";
import { tmpdir } from "node:os";
import { join } from "node:path";
const modulePath = "../src/lib/investigation/database-lock";
test("kernel lock admits one concurrent owner and leaves its inode reusable after release", async () => {
  const api = await import(modulePath).catch(() => ({}));
  assert.equal(
    typeof api.acquireDatabaseLock,
    "function",
    "Kernel database ownership must exist",
  );
  const path = await mkdtemp(join(tmpdir(), "signal-kernel-lock-"));
  try {
    const attempts = await Promise.allSettled([
      api.acquireDatabaseLock(path),
      api.acquireDatabaseLock(path),
    ]);
    const owners = attempts.filter(
      (r): r is PromiseFulfilledResult<() => Promise<void>> =>
        r.status === "fulfilled",
    );
    assert.equal(owners.length, 1);
    assert.equal(attempts.filter((r) => r.status === "rejected").length, 1);
    const before = await stat(join(path, "owner.lock"));
    await owners[0].value();
    const next = await api.acquireDatabaseLock(path);
    assert.equal((await stat(join(path, "owner.lock"))).ino, before.ino);
    await next();
  } finally {
    await rm(path, { recursive: true, force: true });
  }
});

test("ownership survives the short-lived lock helper and ends when the parent descriptor closes", async () => {
  const { acquireDatabaseLock } = await import(modulePath);
  const path = await mkdtemp(join(tmpdir(), "signal-inherited-lock-"));
  const handle = await open(join(path, "owner.lock"), "a+");
  try {
    const helper = spawn(pythonExecutable(), ["scripts/database-lock.py"], {
      stdio: ["ignore", "pipe", "pipe", handle.fd],
    });
    let output = "";
    helper.stdout!.on("data", (chunk) => {
      output += chunk.toString();
    });
    const [code] = await once(helper, "close");
    assert.equal(
      code,
      0,
      "the helper must exit after locking the inherited descriptor",
    );
    assert.equal(output.trim(), "locked");
    await assert.rejects(acquireDatabaseLock(path), /already open/);
    await handle.close();
    const release = await acquireDatabaseLock(path);
    await release();
  } finally {
    await handle.close();
    await rm(path, { recursive: true, force: true });
  }
});
