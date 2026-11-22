import assert from "node:assert/strict";
import test from "node:test";

import { passwordFormHidden } from "./login-mode";
import { ProviderType } from "./providers/types";

/**
 * #31: `HIDE_PASSWORD_LOGIN` is a request, not an order — it is only obeyed when Quick Connect
 * gives people another way in.
 */

test("the flag hides the form on a provider that offers Quick Connect", () => {
  assert.equal(
    passwordFormHidden({ hidePasswordLogin: true, hasQuickConnect: true, provider: ProviderType.JELLYFIN }),
    true,
  );
});

test("without the flag the form stays, Quick Connect or not", () => {
  assert.equal(
    passwordFormHidden({ hidePasswordLogin: false, hasQuickConnect: true, provider: ProviderType.JELLYFIN }),
    false,
  );
});

test("a provider with no Quick Connect keeps the form — otherwise the screen has no way in", () => {
  assert.equal(
    passwordFormHidden({ hidePasswordLogin: true, hasQuickConnect: false, provider: ProviderType.EMBY }),
    false,
  );
  assert.equal(
    passwordFormHidden({ hidePasswordLogin: true, hasQuickConnect: false, provider: ProviderType.TMDB }),
    false,
  );
});

test("Plex keeps the form: its login view drives a plex.tv PIN, not a Quick Connect button", () => {
  assert.equal(
    passwordFormHidden({ hidePasswordLogin: true, hasQuickConnect: true, provider: ProviderType.PLEX }),
    false,
  );
});

test("an unknown provider is treated as having no alternate way in", () => {
  assert.equal(
    passwordFormHidden({ hidePasswordLogin: true, hasQuickConnect: false, provider: "something-else" }),
    false,
  );
});
