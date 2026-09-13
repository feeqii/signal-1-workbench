import { z } from "zod";
import { StoreError } from "./store";

export function guardLocal(request: Request) {
  const host = request.headers.get("host") || new URL(request.url).host;
  let parsed: URL;
  try {
    parsed = new URL(`http://${host}`);
  } catch {
    throw new StoreError("Invalid local host.", 403);
  }
  if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname))
    throw new StoreError("This application only accepts local requests.", 403);
  const origin = request.headers.get("origin");
  if (origin && origin !== `http://${host}` && origin !== `https://${host}`)
    throw new StoreError("Cross-origin requests are not allowed.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new StoreError("Cross-site requests are not allowed.", 403);
}
export async function readJson(
  request: Request,
  maxBytes = 1_000_000,
): Promise<unknown> {
  guardLocal(request);
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new StoreError("Send JSON content.", 415);
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes)
    throw new StoreError("This file is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new StoreError("A JSON body is required.", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > maxBytes) {
        await reader.cancel();
        throw new StoreError("This file is too large.", 413);
      }
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new StoreError("The JSON file could not be read.", 400);
    throw error;
  }
}
export function apiError(error: unknown): Response {
  if (error instanceof z.ZodError)
    return Response.json(
      {
        error: error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  // Next bundles routes independently, while the database survives on globalThis.
  // A stable error tag preserves status when its constructor came from another route.
  if (
    error instanceof Error &&
    error.name === "Signal1StoreError" &&
    "status" in error &&
    typeof error.status === "number" &&
    [400, 403, 404, 409, 413, 415].includes(error.status)
  )
    return Response.json({ error: error.message }, { status: error.status });
  return Response.json(
    { error: error instanceof Error ? error.message : "The operation failed." },
    { status: 400 },
  );
}
export const uuid = z.string().uuid();
