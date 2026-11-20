import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  expandHome,
  impersonationEnabled,
  loadIdentities,
  parseEnvFile,
  pickIdentity,
  resolveCredentials,
} from "./identities";

function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), "swipe-identities-"));
}

test("impersonation is off unless the launcher set the flag", () => {
  assert.equal(impersonationEnabled({}), false);
  assert.equal(impersonationEnabled({ DEV_IMPERSONATE: "1" }), true);
  assert.equal(
    impersonationEnabled({ DEV_IMPERSONATE: "1", NODE_ENV: "production" }),
    false
  );
});

test("expandHome only touches a leading ~", () => {
  assert.equal(expandHome("~/x/y"), path.join(process.env.HOME ?? "", "x/y"));
  assert.equal(expandHome("/abs/path"), "/abs/path");
  assert.equal(expandHome("relative"), "relative");
});

test("parseEnvFile reads KEY=VALUE and strips one layer of quotes", () => {
  const vars = parseEnvFile(
    ['# comment', 'A=one', 'B="two words"', "C='three'", "D=a=b"].join("\n")
  );
  assert.deepEqual(vars, { A: "one", B: "two words", C: "three", D: "a=b" });
});

test("loadIdentities rejects a non-array and reads a valid registry", () => {
  const dir = tempDir();
  const bad = path.join(dir, "bad.json");
  writeFileSync(bad, JSON.stringify({ identities: [] }));
  assert.throws(() => loadIdentities(bad), /JSON array/);

  const good = path.join(dir, "good.json");
  writeFileSync(
    good,
    JSON.stringify([
      { value: "a", provider: "jellyfin", credentials: { password: "NOPE" } },
      { value: "b", provider: "plex" },
      { nope: true },
    ])
  );
  const identities = loadIdentities(good);
  assert.deepEqual(identities.map((i) => i.value), ["a", "b"]);
});

test("loadIdentities refuses a relative or traversing path", () => {
  assert.throws(() => loadIdentities("relative.json"), /absolute/);
  assert.throws(() => loadIdentities("/tmp/../etc/passwd"), /absolute/);
});

test("pickIdentity returns null for an unknown value", () => {
  const identities = loadIdentities(
    (() => {
      const file = path.join(tempDir(), "ids.json");
      writeFileSync(file, JSON.stringify([{ value: "a", provider: "tmdb" }]));
      return file;
    })()
  );
  assert.equal(pickIdentity(identities, "a")?.provider, "tmdb");
  assert.equal(pickIdentity(identities, "zzz"), null);
});

test("resolveCredentials reads a 600 env file", () => {
  const dir = tempDir();
  const envFile = path.join(dir, "creds.env");
  writeFileSync(envFile, "JELLYFIN_USER=agent\nJELLYFIN_PASSWORD=hunter2\n", { mode: 0o600 });
  chmodSync(envFile, 0o600);

  const resolved = resolveCredentials({
    value: "jellyfin-agent",
    provider: "jellyfin",
    credentials: {
      envFile,
      user: "JELLYFIN_USER",
      password: "JELLYFIN_PASSWORD",
    },
  });
  assert.deepEqual(resolved, { username: "agent", password: "hunter2" });
});

test("resolveCredentials refuses a group/other-readable file", () => {
  const dir = tempDir();
  const envFile = path.join(dir, "loose.env");
  writeFileSync(envFile, "PLEX_TOKEN=x\n", { mode: 0o644 });
  chmodSync(envFile, 0o644);

  assert.throws(
    () =>
      resolveCredentials({
        value: "plex",
        provider: "plex",
        credentials: { envFile, password: "PLEX_TOKEN" },
      }),
    /mode 600/
  );
});

test("resolveCredentials reports a missing key, never an empty token", () => {
  const dir = tempDir();
  const envFile = path.join(dir, "empty.env");
  writeFileSync(envFile, "SOMETHING=else\n", { mode: 0o600 });
  chmodSync(envFile, 0o600);

  assert.throws(
    () =>
      resolveCredentials({
        value: "plex",
        provider: "plex",
        credentials: { envFile, password: "PLEX_TOKEN" },
      }),
    /PLEX_TOKEN is empty or missing/
  );
});

test("an identity without credentials falls back to its label and no password", () => {
  assert.deepEqual(
    resolveCredentials({ value: "tmdb", label: "TMDB · no library", provider: "tmdb" }),
    { username: "TMDB · no library", password: "" }
  );
});
