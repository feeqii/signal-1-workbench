import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, cp, appendFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GET } from "../src/app/api/case/route";

test("initial case loading refuses a modified structure before the viewer can use it", async () => {
  const original = process.cwd();
  const temporary = await mkdtemp(join(tmpdir(), "signal-case-integrity-"));
  try {
    await cp(
      join(original, "public/case/kras"),
      join(temporary, "public/case/kras"),
      { recursive: true },
    );
    await appendFile(
      join(temporary, "public/case/kras/sources/5O2S.cif"),
      "\n# modified coordinate source\n",
    );
    process.chdir(temporary);
    const response = await GET(new Request("http://127.0.0.1/api/case"));
    assert.equal(response.status, 400);
    assert.match(
      (await response.json()).error,
      /integrity check: sources\/5O2S.cif/,
    );
  } finally {
    process.chdir(original);
    await rm(temporary, { recursive: true, force: true });
  }
});
