import test from "node:test";
import assert from "node:assert/strict";
import { Camera } from "molstar/lib/commonjs/mol-canvas3d/camera";
import { validateState } from "../src/lib/investigation/schema";
import { fixtureManifest, fixtureState } from "./fixtures";

test("camera imports accept real snapshots and reject malformed or degenerate geometry", () => {
  const valid = new Camera().getSnapshot();
  const parse = (camera: unknown) =>
    validateState(
      { ...fixtureState, view: { ...fixtureState.view, camera } },
      fixtureManifest,
    );
  assert.deepEqual(parse(valid).view.camera, valid);
  for (const camera of [
    { position: true, target: false, up: "invalid", mode: "invalid" },
    { ...valid, position: [1, 2] },
    { ...valid, position: [NaN, 2, 3] },
    { ...valid, up: [0, 0, 0] },
    { ...valid, position: valid.target },
    { ...valid, fov: 0 },
    { ...valid, radius: -1 },
    { ...valid, mode: "invalid" },
    { ...valid, unknown: true },
  ])
    assert.throws(() => parse(camera));
});
