// The app owns the embedded database; this helper asks its local queue to drain.
const endpoint = process.env.SIGNAL1_URL || "http://127.0.0.1:3000";
const url = new URL(endpoint);
if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
  throw new Error("SIGNAL1_URL must address the local app.");
fetch(new URL("/api/jobs", url))
  .then(async (response) => {
    if (!response.ok) throw new Error(await response.text());
    process.stdout.write("Pending calculations processed.\n");
  })
  .catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
