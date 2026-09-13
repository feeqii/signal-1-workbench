import { existsSync } from "node:fs";
import { resolve } from "node:path";
export function pythonExecutable(): string {
  const local = resolve(process.cwd(), ".venv/bin/python");
  return process.env.SIGNAL1_PYTHON || (existsSync(local) ? local : "python3");
}
