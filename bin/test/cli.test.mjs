import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import { once } from "node:events";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = path.join(ROOT, "bin/messer-swipe.mjs");
// The CLI falls back to ./.agent-token, so a test that runs in the repo would pick
// up the developer's own local token. Run every case from an empty directory.
const SANDBOX = mkdtempSync(path.join(os.tmpdir(), "messer-swipe-cli-"));
const TOKEN = `msw_AbCd1234_${"x".repeat(43)}`;

function run(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd: SANDBOX,
      env: { PATH: process.env.PATH, MESSER_SWIPE_TOKEN: "", ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function withServer(handler, fn) {
  const server = http.createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

const statusBody = {
  ok: true,
  api: 1,
  data: {
    version: "2.1.0",
    apiVersion: 1,
    provider: "jellyfin",
    capabilities: {},
    basePath: "",
    uptimeSeconds: 3725,
    node: "v24.0.0",
    database: { kind: "sqlite", sizeBytes: 2048 },
    agent: { name: "local", scope: "admin", userName: "Jakob", local: true, hasProviderCredential: true },
    serverTime: "2026-11-20T00:00:00.000Z",
  },
  meta: { version: "2.1.0", durationMs: 3 },
};

test("status prints the envelope as JSON", async () => {
  await withServer(
    (req, res) => {
      assert.equal(req.url, "/api/v1/status");
      assert.equal(req.headers.authorization, `Bearer ${TOKEN}`);
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(statusBody));
    },
    async (url) => {
      const result = await run(["status", "--url", url, "--token", TOKEN]);
      assert.equal(result.code, 0, result.stderr);
      const body = JSON.parse(result.stdout);
      assert.equal(body.ok, true);
      assert.equal(body.api, 1);
      assert.equal(body.data.provider, "jellyfin");
      assert.equal(body.meta.version, "2.1.0");
    }
  );
});

test("status --human prints one line per fact", async () => {
  await withServer(
    (_req, res) => res.end(JSON.stringify(statusBody)),
    async (url) => {
      const result = await run(["status", "--url", url, "--token", TOKEN, "--human"]);
      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stdout, /Messer Swipe 2\.1\.0 · jellyfin · up 1h 2m/);
      assert.match(result.stdout, /db sqlite 2\.0 KB/);
    }
  );
});

test("no token exits 3 before touching the network", async () => {
  const result = await run(["status", "--url", "http://127.0.0.1:9", "--token-file", "/nonexistent"]);
  assert.equal(result.code, 3);
  assert.equal(JSON.parse(result.stderr).error.code, "UNAUTHORIZED");
});

test("a 401 envelope exits 3 and keeps the hint", async () => {
  await withServer(
    (_req, res) => {
      res.statusCode = 401;
      res.end(JSON.stringify({ ok: false, api: 1, error: { code: "UNAUTHORIZED", message: "revoked", hint: "create a new one" } }));
    },
    async (url) => {
      const result = await run(["status", "--url", url, "--token", TOKEN]);
      assert.equal(result.code, 3);
      assert.equal(JSON.parse(result.stderr).error.hint, "create a new one");
    }
  );
});

test("an unknown command exits 2", async () => {
  const result = await run(["nope"]);
  assert.equal(result.code, 2);
  assert.match(result.stderr, /Unknown command/);
});

test("a base path is prefixed onto the api path", async () => {
  await withServer(
    (req, res) => {
      assert.equal(req.url, "/swipe/api/v1/status");
      res.end(JSON.stringify(statusBody));
    },
    async (url) => {
      const result = await run(["status", "--url", url, "--token", TOKEN, "--base-path", "/swipe"]);
      assert.equal(result.code, 0, result.stderr);
    }
  );
});

test("deck passes --why and --limit through as query parameters", async () => {
  await withServer(
    (req, res) => {
      assert.equal(req.url, "/api/v1/deck?limit=5&why=1");
      res.end(JSON.stringify({ ok: true, api: 1, data: {
        deckMode: "mixed", kinds: ["movie", "series"], libraries: { total: 2, included: 0, includedIsEverything: true },
        counts: { returned: 0, swiped: 3, limit: 5 }, provider: { reachable: true, durationMs: 4 },
        items: [], diagnosis: [{ code: "DECK_EXHAUSTED", severity: "warning", message: "No candidates left; this member has already swiped 3 item(s)." }],
      }, meta: { version: "2.1.2", durationMs: 4 } }));
    },
    async (url) => {
      const result = await run(["deck", "--url", url, "--token", TOKEN, "--limit", "5", "--why"]);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).data.diagnosis[0].code, "DECK_EXHAUSTED");
    }
  );
});

test("a 409 provider-auth answer exits 3 with its hint", async () => {
  await withServer(
    (_req, res) => {
      res.statusCode = 409;
      res.end(JSON.stringify({ ok: false, api: 1, error: { code: "PROVIDER_AUTH_REQUIRED", message: "no credential", hint: "log in once in the browser" } }));
    },
    async (url) => {
      const result = await run(["deck", "--url", url, "--token", TOKEN]);
      assert.equal(result.code, 3);
      assert.equal(JSON.parse(result.stderr).error.code, "PROVIDER_AUTH_REQUIRED");
    }
  );
});

test("--version reports the build the image set, not a constant", async () => {
  const pinned = await run(["--version"], { APP_VERSION: "9.9.9" });
  assert.equal(pinned.code, 0);
  assert.equal(pinned.stdout.trim(), "messer-swipe 9.9.9 (api 1)");
});

test("media search encodes the query and prints one line per match", async () => {
  await withServer(
    (req, res) => {
      assert.equal(req.url, "/api/v1/media?query=the%20big%20lebowski");
      res.end(JSON.stringify({ ok: true, api: 1, data: { query: "the big lebowski", items: [
        { id: "550", name: "The Big Lebowski", year: 1998, kind: "movie", rating: 8.1 },
      ] }, meta: { version: "2.2.2", durationMs: 3 } }));
    },
    async (url) => {
      const result = await run(["media", "search", "the", "big", "lebowski", "--url", url, "--token", TOKEN, "--human"]);
      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stdout, /The Big Lebowski \(1998\)\s+movie\s+550/);
    }
  );
});

test("media get needs an id and exits 2 without calling the network", async () => {
  const result = await run(["media", "get"]);
  assert.equal(result.code, 2);
  assert.match(JSON.parse(result.stderr).error.message, /needs an id/);
});

test("a 404 answers exit 4", async () => {
  await withServer(
    (_req, res) => {
      res.statusCode = 404;
      res.end(JSON.stringify({ ok: false, api: 1, error: { code: "NOT_FOUND", message: "no item" } }));
    },
    async (url) => {
      const result = await run(["media", "get", "nope", "--url", url, "--token", TOKEN]);
      assert.equal(result.code, 4);
    }
  );
});

test("logs passes level/since/limit through", async () => {
  await withServer(
    (req, res) => {
      assert.equal(req.url, "/api/v1/logs?level=warn&since=30&limit=10");
      res.end(JSON.stringify({ ok: true, api: 1, data: { sinceMinutes: 30, level: "warn", entries: [
        { at: "2026-11-20T15:00:00.000Z", level: "warn", message: "image fetch timed out" },
      ] }, meta: { version: "2.2.2", durationMs: 1 } }));
    },
    async (url) => {
      const result = await run(["logs", "--level", "warn", "--since", "30", "--limit", "10", "--url", url, "--token", TOKEN, "--human"]);
      assert.equal(result.code, 0, result.stderr);
      assert.match(result.stdout, /WARN\s+image fetch timed out/);
    }
  );
});
