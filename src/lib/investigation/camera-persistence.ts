/** Observe rendered camera changes, including direct control mutations and explicit focus. */
export function observeSettledCamera<T>(
  camera: {
    changed: { subscribe: (listener: () => void) => { unsubscribe: () => void } };
    getSnapshot: () => T;
  },
  save: (snapshot: T) => void,
  delayMs = 250,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const subscription = camera.changed.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      save(camera.getSnapshot());
    }, delayMs);
  });
  return () => {
    clearTimeout(timer);
    subscription.unsubscribe();
  };
}

export function applyInvestigationCamera<T>(
  camera: { setState: (snapshot: T, durationMs: number) => void; getSnapshot: () => T },
  saved: T | null,
  canonical: T | null,
): void {
  const next = saved ?? canonical;
  if (next && !cameraSnapshotsEqual(camera.getSnapshot(), next)) camera.setState(next, 0);
}


/** JSONB can reorder object fields; camera identity depends on values and vector order. */
export function cameraSnapshotsEqual(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object") return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((value, index) => cameraSnapshotsEqual(value, right[index]));
  }
  const leftObject = left as Record<string, unknown>;
  const rightObject = right as Record<string, unknown>;
  const keys = Object.keys(leftObject);
  return keys.length === Object.keys(rightObject).length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(rightObject, key) && cameraSnapshotsEqual(leftObject[key], rightObject[key]));
}
