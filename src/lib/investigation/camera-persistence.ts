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
