import { UserSession } from "./auth";

/**
 * What an agent token may do. Ordered: `admin` implies `write` implies `read`.
 *
 * A token is a member's identity, not a second permission system: the scope only
 * narrows what the token may reach, it never grants more than the member has.
 */
export type AgentScope = "read" | "write" | "admin";

export const SCOPE_RANK: Record<AgentScope, number> = { read: 1, write: 2, admin: 3 };

export function isAgentScope(value: unknown): value is AgentScope {
  return value === "read" || value === "write" || value === "admin";
}

export function scopeAllows(granted: AgentScope, required: AgentScope): boolean {
  return (SCOPE_RANK[granted] ?? 0) >= (SCOPE_RANK[required] ?? Number.POSITIVE_INFINITY);
}

/** A token as the API may show it — never the secret, never the credential. */
export interface AgentTokenRecord {
  id: string;
  name: string;
  prefix: string;
  userId: string;
  userName: string;
  provider: string;
  scope: AgentScope;
  isLocal: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/** The row as stored. `hash` and `credential` never leave the server. */
export interface AgentTokenRow extends AgentTokenRecord {
  hash: string;
  credential: string | null;
}

/**
 * The identity a token acts as, captured when the token is created. Stored
 * encrypted (AES-GCM, `src/lib/security/crypto.ts`) so that the provider
 * credential a deck preview needs survives without a browser cookie.
 */
export type AgentCredential = Pick<UserSession, "Id" | "Name" | "provider"> & {
  AccessToken?: string;
  DeviceId?: string;
  providerConfig?: UserSession["providerConfig"];
};
