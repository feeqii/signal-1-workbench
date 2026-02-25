const memoryCache = new Map<string, { expiry: number; value: unknown }>();

const REDIS_URL = process.env.REDIS_REST_URL;
const REDIS_TOKEN = process.env.REDIS_REST_TOKEN;

async function redisGet(key: string): Promise<string | null> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    return null;
  }

  const response = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { result?: string | null };
  return payload.result ?? null;
}

async function redisSet(key: string, value: string, ttlSec: number): Promise<void> {
  if (!REDIS_URL || !REDIS_TOKEN) {
    return;
  }

  await fetch(`${REDIS_URL}/setex/${encodeURIComponent(key)}/${ttlSec}/${encodeURIComponent(value)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`
    }
  });
}

export async function withCache<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const inMemory = memoryCache.get(key);
  if (inMemory && inMemory.expiry > now) {
    return inMemory.value as T;
  }

  const redisValue = await redisGet(key);
  if (redisValue) {
    const parsed = JSON.parse(redisValue) as T;
    memoryCache.set(key, { expiry: now + ttlSec * 1000, value: parsed });
    return parsed;
  }

  const fresh = await loader();
  memoryCache.set(key, { expiry: now + ttlSec * 1000, value: fresh });
  void redisSet(key, JSON.stringify(fresh), ttlSec);
  return fresh;
}
