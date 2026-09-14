/** Revisit future leases and work left after a bounded drain without overlapping runs. */
export function createQueuePump(
  drain: () => Promise<void>,
  onError: (error: unknown) => void,
  intervalMs = 2000,
): () => void {
  let running = false,
    stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await drain();
    } catch (error) {
      onError(error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  timer.unref?.();
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
