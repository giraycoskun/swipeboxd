#!/usr/bin/env node
/**
 * The corpus a triage run reasons over — issues, comments, PRs, release state.
 *
 *   node scripts/triage/fetch.mjs --out ~/Artifacts/messer-swipe/corpus/2026-11-20
 *
 * Read-only by construction: every call is `gh api` with no method override, so
 * this script cannot comment, label, close or push. It is the only thing the
 * reasoning stage is allowed to run against GitHub, which is what makes an issue
 * body — attacker-controlled text — harmless: the process holding it has no way
 * to write.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = process.env.GITHUB_REPOSITORY || "jakobbjelver/messer-swipe";
const argv = process.argv.slice(2);
const outIndex = argv.indexOf("--out");
const outDir = resolve(outIndex >= 0 ? argv[outIndex + 1] : `corpus/${new Date().toISOString().slice(0, 10)}`);

function api(path, { paginate = true } = {}) {
  const args = ["api", path];
  if (paginate) args.push("--paginate", "--slurp");
  const result = spawnSync("gh", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `gh api ${path} failed`);
  return JSON.parse(result.stdout);
}

function shape(issue) {
  return {
    number: issue.number,
    title: issue.title,
    body: issue.body ?? "",
    author: issue.user?.login ?? "unknown",
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    labels: (issue.labels ?? []).map((label) => (typeof label === "string" ? label : label.name)),
    comments: issue.commentCount ?? undefined,
  };
}

mkdirSync(outDir, { recursive: true });

const raw = api(`repos/${REPO}/issues?state=open&per_page=100`).flat();
const issues = raw.filter((item) => !item.pull_request);
const pullRequests = raw.filter((item) => item.pull_request);

const corpus = [];
for (const issue of issues) {
  const comments = issue.comments > 0
    ? api(`repos/${REPO}/issues/${issue.number}/comments?per_page=100`).flat()
    : [];
  corpus.push({
    ...shape(issue),
    comments: comments.map((comment) => ({
      author: comment.user?.login ?? "unknown",
      createdAt: comment.created_at,
      body: comment.body ?? "",
    })),
  });
}

const meta = {
  repo: REPO,
  generatedAt: new Date().toISOString(),
  openIssues: issues.length,
  openPullRequests: pullRequests.length,
  latestRelease: safe(() => api(`repos/${REPO}/releases/latest`, { paginate: false })),
  compare: safe(() => api(`repos/${REPO}/compare/master...develop`, { paginate: false })),
};

function safe(fn) {
  try {
    return fn();
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

writeFileSync(`${outDir}/issues.json`, `${JSON.stringify(corpus, null, 2)}\n`);
writeFileSync(`${outDir}/pull-requests.json`, `${JSON.stringify(pullRequests.map(shape), null, 2)}\n`);
writeFileSync(`${outDir}/meta.json`, `${JSON.stringify(meta, null, 2)}\n`);

process.stdout.write(
  `${outDir}: ${corpus.length} issues, ${pullRequests.length} PRs, ${corpus.reduce((n, i) => n + i.comments.length, 0)} comments\n`
);
