import assert from "node:assert/strict";
import test from "node:test";
import { guestLoginSchema, loginSchema, profileAvatarSchema } from "./validations";

test("the profile route accepts only catalog ids", () => {
  for (const avatarId of ["moonwalker", "kaiju", "projectionist"]) {
    assert.equal(profileAvatarSchema.safeParse({ avatarId }).success, true);
  }
  for (const avatarId of ["not-one", "", 7, undefined]) {
    assert.equal(profileAvatarSchema.safeParse({ avatarId }).success, false);
  }
});

test("sign-in payloads carry an optional avatar and lose the old base64 field", () => {
  const ok = loginSchema.safeParse({ username: "kim", avatarId: "kaiju" });
  assert.equal(ok.success, true);
  assert.equal(ok.success && ok.data.avatarId, "kaiju");

  // a stale client still posting a data URL must not reach the DB: the key is
  // stripped, never persisted, and the request itself still validates
  const legacy = loginSchema.safeParse({ username: "kim", profilePicture: "data:image/png;base64,AAAA" });
  assert.equal(legacy.success, true);
  assert.ok(legacy.success && !("profilePicture" in legacy.data) && !("avatarId" in legacy.data));

  const junk = loginSchema.safeParse({ username: "kim", avatarId: "data:image/png;base64,AAAA" });
  assert.equal(junk.success, false);
});

test("guest join carries the same optional avatar rule", () => {
  const ok = guestLoginSchema.safeParse({ username: "Reviewer", sessionCode: "", avatarId: "driver" });
  assert.equal(ok.success, true);
  assert.equal(ok.success && ok.data.avatarId, "driver");
  assert.equal(guestLoginSchema.safeParse({ username: "Reviewer", avatarId: "kaiju-kid" }).success, false);
});
