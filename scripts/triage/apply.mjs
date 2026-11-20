#!/usr/bin/env node
/**
 * The only thing that writes.
 *
 *   node scripts/triage/apply.mjs --brief brief.json D1 D3 [--dry-run]
 *
 * It takes a brief produced by the reasoning stage and the ids a human approved,
 * and performs exactly those actions. It never reads an issue body — only the
 * state and timestamp — so a report crafted to look like an instruction cannot
 * reach a write. Every refusal below is deliberate; do not soften one to make a
 * run go through.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const REPO = process.env.GITHUB_REPOSITORY || "jakobbjelver/messer-swipe";
const MAX_COMMENT_LINES = 12;
const MAX_COMMENT_CHARS = 2000;
const MAX_BRIEF_AGE_MS = 7 * 86_400_000;

const LABELS = new Set([
  "bug", "enhancement", "question", "duplicate", "documentation", "released",
  "needs-info", "confirmed", "fixed-in-dev", "area/provider", "area/ui", "area/deploy",
]);

const ACTION_TYPES = new Set(["label", "comment", "close", "reopen"]);

const argv = process.argv.slice(2);
const briefIndex = argv.indexOf("--brief");
const dryRun = argv.includes("--dry-run");
const ids = argv.filter((arg, index) => !arg.startsWith("--") && argv[index - 1] !== "--brief");

if (briefIndex < 0 || ids.length === 0) {
  process.stderr.write("usage: apply.mjs --brief <brief.json> <id...> [--dry-run]\n");
  process.exit(2);
}

const brief = JSON.parse(readFileSync(argv[briefIndex + 1], "utf8"));
const refusals = [];
const planned = [];

function refuse(subject, reason) {
  refusals.push({ subject, reason });
}

function gh(args, input) {
  const result = spawnSync("gh", args, { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `gh ${args.slice(0, 3).join(" ")} failed`);
  return result.stdout;
}

// ---- the brief itself -------------------------------------------------------

const generatedAt = Date.parse(brief.generatedAt ?? "");
if (!Number.isFinite(generatedAt)) refuse("brief", "no valid generatedAt");
else if (Date.now() - generatedAt > MAX_BRIEF_AGE_MS) refuse("brief", "older than 7 days — re-run the triage");

const items = Array.isArray(brief.items) ? brief.items : [];
const byId = new Map();
for (const item of items) {
  if (!item?.id) { refuse("brief", "an item has no id"); continue; }
  if (byId.has(item.id)) refuse(item.id, "duplicate id in the brief");
  byId.set(item.id, item);
}

// ---- the requested ids ------------------------------------------------------

for (const id of ids) {
  const item = byId.get(id);
  if (!item) { refuse(id, "not in the brief"); continue; }
  if (!Number.isInteger(item.issue) || item.issue <= 0) { refuse(id, "no issue number"); continue; }
  if (!Array.isArray(item.actions) || item.actions.length === 0) { refuse(id, "no actions"); continue; }

  for (const action of item.actions) {
    if (!ACTION_TYPES.has(action?.type)) { refuse(id, `unknown action "${action?.type}"`); continue; }

    if (action.type === "label" && !LABELS.has(action.name)) {
      refuse(id, `label "${action.name}" is not in the taxonomy`);
    }

    if (action.type === "comment") {
      const body = String(action.body ?? "");
      if (body.trim().length === 0) refuse(id, "empty comment");
      if (body.split("\n").length > MAX_COMMENT_LINES) {
        refuse(id, `comment is ${body.split("\n").length} lines (max ${MAX_COMMENT_LINES}) — a long reply is a sign the agent is improvising`);
      }
      if (body.length > MAX_COMMENT_CHARS) refuse(id, `comment is ${body.length} chars (max ${MAX_COMMENT_CHARS})`);
    }

    if (action.type === "close" && !["completed", "not planned"].includes(action.reason ?? "completed")) {
      refuse(id, `close reason "${action.reason}" is not "completed" or "not planned"`);
    }
  }

  if (!refusals.some((entry) => entry.subject === id)) planned.push(item);
}

if (refusals.length > 0) {
  process.stdout.write(`${JSON.stringify({ applied: [], refused: refusals, dryRun }, null, 2)}\n`);
  process.exit(1);
}

// ---- freshness: the state of each issue, read before anything is written -----

const fresh = new Map();
for (const item of planned) {
  const view = JSON.parse(gh(["issue", "view", String(item.issue), "--repo", REPO, "--json", "number,state,updatedAt"]));
  fresh.set(item.issue, view);

  if (item.actions.some((action) => action.type === "close") && Date.parse(view.updatedAt) > generatedAt) {
    refuse(item.id, `issue #${item.issue} changed after the brief — re-read it before closing`);
  }
  if (item.actions.some((action) => action.type === "close") && view.state !== "OPEN") {
    refuse(item.id, `issue #${item.issue} is already ${view.state.toLowerCase()}`);
  }
}

if (refusals.length > 0) {
  process.stdout.write(`${JSON.stringify({ applied: [], refused: refusals, dryRun }, null, 2)}\n`);
  process.exit(1);
}

// ---- act --------------------------------------------------------------------

const applied = [];
for (const item of planned) {
  const performed = [];

  for (const action of item.actions) {
    const target = String(item.issue);

    if (dryRun) {
      performed.push({ ...action, simulated: true });
      continue;
    }

    if (action.type === "label") {
      gh(["issue", "edit", target, "--repo", REPO, "--add-label", action.name]);
    } else if (action.type === "comment") {
      gh(["issue", "comment", target, "--repo", REPO, "--body-file", "-"], String(action.body));
    } else if (action.type === "close") {
      gh(["issue", "close", target, "--repo", REPO, "--reason", action.reason ?? "completed"]);
    } else if (action.type === "reopen") {
      gh(["issue", "reopen", target, "--repo", REPO]);
    }

    performed.push(action);
  }

  applied.push({ id: item.id, issue: item.issue, actions: performed });
}

process.stdout.write(`${JSON.stringify({ applied, refused: [], dryRun }, null, 2)}\n`);
