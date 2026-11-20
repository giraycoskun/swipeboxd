#!/usr/bin/env node
/**
 * Sensors: the facts, without an opinion.
 *
 *   node scripts/sensors.mjs                 # JSON to stdout
 *   node scripts/sensors.mjs --out s.json    # JSON to a file
 *   node scripts/sensors.mjs --fail-on-critical   # exit 1 when the project is unwell
 *
 * No model is involved, so this runs anywhere `gh` is authenticated: a nightly
 * GitHub Action (which emails on a red run) and the maintainer's own machine.
 * Each sensor fails independently — a missing `gh`, an offline provider or a
 * registry hiccup yields `{ ok: false, error }` for that sensor only.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const REPO = process.env.GITHUB_REPOSITORY || "jakobbjelver/messer-swipe";
const DAY = 86_400_000;

const argv = process.argv.slice(2);
const outPath = valueOf("--out");
const failOnCritical = argv.includes("--fail-on-critical");

function valueOf(flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : null;
}

function run(command, args, { cwd } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

function gh(args) {
  const result = run("gh", args);
  if (result.status !== 0) throw new Error(result.stderr.trim() || `gh ${args[0]} failed`);
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}

function sensor(name, fn) {
  try {
    return [name, { ok: true, ...fn() }];
  } catch (error) {
    return [name, { ok: false, error: error instanceof Error ? error.message : String(error) }];
  }
}

function ci() {
  const runs = gh(["run", "list", "--repo", REPO, "--limit", "40", "--json", "databaseId,name,headBranch,status,conclusion,createdAt,url"]);
  const byBranch = {};
  for (const run of runs) if (!byBranch[run.headBranch]) byBranch[run.headBranch] = run;

  const failing = runs.filter(
    (run) => run.conclusion === "failure" && Date.now() - Date.parse(run.createdAt) < 7 * DAY
  );

  return {
    byBranch,
    failingLast7Days: failing.map(({ name, headBranch, createdAt, url }) => ({ name, headBranch, createdAt, url })),
  };
}

function pullRequests() {
  const prs = gh(["pr", "list", "--repo", REPO, "--state", "open", "--json", "number,title,isDraft,createdAt,updatedAt"]);
  return {
    open: prs.length,
    drafts: prs.filter((pr) => pr.isDraft).length,
    oldest: prs.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0] ?? null,
  };
}

function inbox() {
  const issues = gh(["issue", "list", "--repo", REPO, "--state", "open", "--limit", "100", "--json", "number,title,labels,createdAt,updatedAt,comments"]);
  const unlabelled = issues.filter((issue) => issue.labels.length === 0);
  const idle = issues.filter((issue) => Date.now() - Date.parse(issue.updatedAt) > 30 * DAY);
  return {
    open: issues.length,
    unlabelled: unlabelled.length,
    idleOver30Days: idle.length,
    oldest: issues.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))[0]?.createdAt ?? null,
  };
}

function dependencies() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const ignored = [];
  try {
    const dependabot = readFileSync(".github/dependabot.yml", "utf8");
    const block = dependabot.split(/^\s*ignore:\s*$/m)[1] ?? "";
    for (const line of block.split(/^\s*-\s+/m).slice(1)) {
      const match = line.match(/^["']?([^"'\s]+)["']?/);
      if (match) ignored.push(match[1]);
    }
  } catch {
    // A missing dependabot config is not a sensor failure, just no exclusions.
  }

  const outdated = run("npm", ["outdated", "--json", "--long"]);
  let outdatedJson = {};
  if (outdated.stdout.trim()) {
    try {
      outdatedJson = JSON.parse(outdated.stdout);
    } catch {
      outdatedJson = {};
    }
  }

  const majors = Object.entries(outdatedJson)
    .filter(([, info]) => String(info.current ?? "0").split(".")[0] !== String(info.latest ?? "0").split(".")[0])
    .map(([name, info]) => ({ name, current: info.current, latest: info.latest, ignored: ignored.includes(name) }));

  const audit = run("npm", ["audit", "--json", "--omit=dev"]);
  let auditJson = {};
  try {
    auditJson = JSON.parse(audit.stdout);
  } catch {
    auditJson = {};
  }
  const advisories = auditJson?.metadata?.vulnerabilities ?? null;

  return {
    enginesNode: pkg.engines?.node ?? null,
    ignoredByDependabot: ignored,
    majors,
    advisories,
  };
}

function release() {
  const latest = gh(["release", "view", "--repo", REPO, "--json", "tagName,publishedAt"]);
  const compare = gh(["api", `repos/${REPO}/compare/master...develop`]);
  return {
    latestTag: latest.tagName,
    publishedAt: latest.publishedAt,
    unreleasedCommitsOnDevelop: compare.ahead_by,
  };
}

async function deployment() {
  const url = process.env.MESSER_SWIPE_URL;
  if (!url) return { configured: false };

  const started = Date.now();
  const response = await fetch(`${url.replace(/\/$/, "")}/readyz`, {
    signal: AbortSignal.timeout(5000),
  }).catch((error) => ({ ok: false, status: 0, statusText: String(error) }));

  return {
    configured: true,
    ready: response.status === 200,
    status: response.status,
    durationMs: Date.now() - started,
  };
}

const results = Object.fromEntries([
  sensor("ci", ci),
  sensor("pullRequests", pullRequests),
  sensor("inbox", inbox),
  sensor("dependencies", dependencies),
  sensor("release", release),
  sensor("deployment", () => ({})),
]);

// The deployment sensor is async and needs its own await; do it outside the sync batch.
results.deployment = { ok: true, ...(await deployment().catch((error) => ({ ok: false, error: String(error) }))) };

const critical = [];
if (results.ci.ok) {
  for (const branch of ["develop", "master"]) {
    const run = results.ci.byBranch?.[branch];
    if (run && run.conclusion === "failure") critical.push(`CI is red on ${branch} (${run.url})`);
  }
}
if (results.deployment.ok && results.deployment.configured && !results.deployment.ready) {
  critical.push(`deployment is not ready (HTTP ${results.deployment.status})`);
}

const signals = {
  generatedAt: new Date().toISOString(),
  repo: REPO,
  critical,
  sensors: results,
};

const text = `${JSON.stringify(signals, null, 2)}\n`;
if (outPath) {
  mkdirSync(dirname(resolve(outPath)), { recursive: true });
  writeFileSync(resolve(outPath), text);
  process.stdout.write(`signals → ${resolve(outPath)} (${critical.length} critical)\n`);
} else {
  process.stdout.write(text);
}

if (failOnCritical && critical.length > 0) {
  for (const line of critical) process.stderr.write(`critical: ${line}\n`);
  process.exit(1);
}
