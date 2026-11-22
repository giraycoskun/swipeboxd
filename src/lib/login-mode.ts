import { ProviderType } from "./providers/types";

/**
 * Should the username/password form be hidden?
 *
 * `HIDE_PASSWORD_LOGIN` exists for installs where everyone arrives through SSO (Jellyfin's
 * SSO plugin behind Authelia, typically) and the password form is only clutter — or worse, a
 * second door nobody keeps locked (#31).
 *
 * The flag is a *request*, not an order: hiding the form is only safe when the login view has
 * another way in. Quick Connect is that way in, and it is a Jellyfin capability — so on Plex
 * (whose button is its own PIN flow), on Emby, and on TMDB (no auth at all) the flag is
 * ignored rather than obeyed. Obeying it there would leave a login screen with no control on
 * it, which is a lockout, not a setting.
 */
export interface PasswordFormVisibility {
  /** `HIDE_PASSWORD_LOGIN` from the environment. */
  hidePasswordLogin: boolean;
  /** The provider's own capability — not the instance's configuration. */
  hasQuickConnect: boolean;
  provider: ProviderType | string;
}

export function passwordFormHidden({
  hidePasswordLogin,
  hasQuickConnect,
  provider,
}: PasswordFormVisibility): boolean {
  if (!hidePasswordLogin) return false;
  if (!hasQuickConnect) return false;
  // Plex declares Quick Connect but the login view drives plex.tv's PIN instead; there is no
  // Quick Connect button to fall back on until that changes.
  if (provider === ProviderType.PLEX) return false;
  return true;
}
