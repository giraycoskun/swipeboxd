import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = path.join(ROOT, "bin/messer-swipe.mjs");
const TOKEN = `msw_AbCd1234_${"x".repeat(43)}`;

function run(args, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], {
      cwd: ROOT,
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
