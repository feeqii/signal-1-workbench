import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Camera } from 'molstar/lib/mol-canvas3d/camera';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { Viewport } from 'molstar/lib/mol-canvas3d/camera/util';
import * as persistence from '../src/lib/investigation/camera-persistence';

test('camera persistence waits for final rendered movement and includes explicit focus', (t) => {
  assert.equal(typeof persistence.observeSettledCamera, 'function');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const camera = new Camera(undefined, Viewport.create(0, 0, 640, 480));
  camera.update();
  const saved: Camera.Snapshot[] = [];
  const cleanup = persistence.observeSettledCamera(camera, value => saved.push(value), 250);
  Vec3.set(camera.position, 0, 0, 80);
  camera.update();
  t.mock.timers.tick(200);
  Vec3.set(camera.position, 20, 0, 60);
  camera.update();
  t.mock.timers.tick(200);
  assert.equal(saved.length, 0);
  t.mock.timers.tick(50);
  assert.equal(saved.length, 1);
  assert.deepEqual([...saved[0].position], [20, 0, 60]);
  camera.setState(camera.getFocus(Vec3.create(5, 8, 2), 10), 0);
  camera.update();
  t.mock.timers.tick(250);
  assert.equal(saved.length, 2);
  assert.deepEqual([...saved[1].target], [5, 8, 2]);
  cleanup();
});

test('camera observer disposal cancels pending saves and unsubscribes from rendered changes', (t) => {
  assert.equal(typeof persistence.observeSettledCamera, 'function');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const camera = new Camera(undefined, Viewport.create(0, 0, 640, 480));
  camera.update();
  const saved: Camera.Snapshot[] = [];
  const cleanup = persistence.observeSettledCamera(camera, value => saved.push(value), 250);
  camera.setState({ position: Vec3.create(3, 4, 100) }, 0);
  camera.update();
  cleanup();
  t.mock.timers.tick(500);
  camera.setState({ position: Vec3.create(3, 4, 50) }, 0);
  camera.update();
  t.mock.timers.tick(500);
  assert.equal(saved.length, 0);
});

test('opening an investigation without a camera resets to the canonical frame', () => {
  assert.equal(typeof persistence.applyInvestigationCamera, 'function');
  const camera = new Camera(undefined, Viewport.create(0, 0, 640, 480));
  camera.setState({ radius: 20 }, 0);
  const canonical = camera.getSnapshot();
  camera.setState({ position: Vec3.create(3, 4, 100), target: Vec3.create(5, 6, 7) }, 0);
  persistence.applyInvestigationCamera(camera, null, canonical);
  assert.deepEqual(camera.getSnapshot(), canonical);
  const savedCamera = { ...canonical, position: Vec3.create(20, 30, 50) };
  persistence.applyInvestigationCamera(camera, savedCamera, canonical);
  assert.deepEqual(camera.getSnapshot(), savedCamera);
});
