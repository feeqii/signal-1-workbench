import { spawn } from "node:child_process";
import { mkdir, open } from "node:fs/promises";
import { resolve } from "node:path";
import { pythonExecutable } from "./python";

/** The parent retains the locked open-file description, even after the helper exits. */
export async function acquireDatabaseLock(
  directory: string,
): Promise<() => Promise<void>> {
  await mkdir(directory, { recursive: true });
  const handle = await open(resolve(directory, "owner.lock"), "a+");
  try {
    await new Promise<void>((resolveLock, reject) => {
      const child = spawn(
        pythonExecutable(),
        [resolve(process.cwd(), "scripts/database-lock.py")],
        {
          stdio: ["ignore", "pipe", "pipe", handle.fd],
        },
      );
      let stdout = "",
        stderr = "";
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("Timed out acquiring the local database lock."));
      }, 5000);
      child.stdout!.on("data", (chunk) => {
        stdout = (stdout + chunk.toString()).slice(-2000);
      });
      child.stderr!.on("data", (chunk) => {
        stderr = (stderr + chunk.toString()).slice(-2000);
      });
      child.once("error", () => {
        clearTimeout(timeout);
        reject(
          new Error(
            "Python could not start the local database lock. Complete the setup instructions first.",
          ),
        );
      });
      child.once("close", (code) => {
        clearTimeout(timeout);
        if (code === 0 && stdout.trim() === "locked") resolveLock();
        else
          reject(
            new Error(
              code === 2
                ? "This data directory is already open. Stop the other Signal-1 server first."
                : stderr.trim() || "The database lock process stopped.",
            ),
          );
      });
    });
    return () => handle.close();
  } catch (error) {
    await handle.close();
    throw error;
  }
}
