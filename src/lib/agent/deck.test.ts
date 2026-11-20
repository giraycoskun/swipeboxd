import assert from "node:assert/strict";
import test from "node:test";

import { diagnoseDeck } from "./deck";

const base = { libraryIds: ["a", "b"], includedLibraries: [] as string[], returned: 5, swiped: 0 };

test("a working deck says OK and names the count", () => {
  const [first] = diagnoseDeck(base);
  assert.equal(first.code, "OK");
  assert.equal(first.severity, "ok");
});

test("an empty inclusion list means everything, not nothing", () => {
  const [first] = diagnoseDeck({ ...base, includedLibraries: [], returned: 0, swiped: 0 });
  assert.equal(first.code, "NO_CANDIDATES", "[] must not be read as 'every library excluded'");
});

test("every library excluded is its own diagnosis, not 'no candidates'", () => {
  const [first] = diagnoseDeck({ ...base, includedLibraries: ["c"], returned: 0 });
  assert.equal(first.code, "ALL_LIBRARIES_EXCLUDED");
  assert.match(String(first.fix), /Settings/);
});

test("a partially included set is noted but not a failure", () => {
  const [first] = diagnoseDeck({ ...base, includedLibraries: ["a"], returned: 3 });
  assert.equal(first.code, "OK");
  assert.match(String(first.fix), /1 of 2/);
});

test("an exhausted deck is distinguished from a filter that matches nothing", () => {
  assert.equal(diagnoseDeck({ ...base, returned: 0, swiped: 12 })[0].code, "DECK_EXHAUSTED");
  assert.equal(diagnoseDeck({ ...base, returned: 0, swiped: 0 })[0].code, "NO_CANDIDATES");
});

test("a provider error outranks every count-based guess", () => {
  const [first] = diagnoseDeck({ ...base, returned: 0, providerError: "connect ECONNREFUSED" });
  assert.equal(first.code, "PROVIDER_UNREACHABLE");
  assert.match(first.message, /ECONNREFUSED/);
});
