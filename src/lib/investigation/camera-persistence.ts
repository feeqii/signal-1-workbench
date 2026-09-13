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
  camera: { setState: (snapshot: T, durationMs: number) => void },
  saved: T | null,
  canonical: T | null,
): void {
  const next = saved ?? canonical;
  if (next) camera.setState(next, 0);
}
