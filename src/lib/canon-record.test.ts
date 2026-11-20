import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

/**
 * The adoption record is part of the app, not a comment about it: `MESSER.md` tells
 * the next session which canon generated `src/styles/messer/`. It drifted once
 * (record 2.4.0, generated files 2.5.0) because the only guard was a rule in a
 * skill nobody re-reads. This is the guard.
 *
 * Both sides are read from disk — the generated header is the truth, the record is
 * the claim.
 */
const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("MESSER.md records the canon version the generated files carry", () => {
  const installed = read("src/styles/messer/theme.css").match(/messer-ui canon ([\d.]+)/)?.[1];
  const recorded = read("MESSER.md").match(/Canon: \*\*messer-ui ([\d.]+)\*\*/)?.[1];

  assert.ok(installed, "theme.css has no 'messer-ui canon x.y.z' stamp");
  assert.ok(recorded, "MESSER.md has no 'Canon: **messer-ui x.y.z**' line");
  assert.equal(recorded, installed, `MESSER.md records ${recorded}, the generated files carry ${installed}`);
});
