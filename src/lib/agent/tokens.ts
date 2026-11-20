import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { agentTokens, agentAudit } from "@/db/schema";
import { encryptValue, decryptValue, getGuestLendingSecret } from "@/lib/security/crypto";
import { logger } from "@/lib/logger";
import {
  type AgentCredential,
  type AgentScope,
  type AgentTokenRecord,
  type AgentTokenRow,
} from "@/types/agent";
import type { UserSession } from "@/types/auth";

/**
 * Agent tokens.
 *
 * `msw_<prefix8>_<43 base64url>` — the prefix makes lookup a single indexed read
 * without storing anything reversible, and the secret is compared in constant
 * time so a near-miss cannot be learned from timing. A token is *narrower* than
 * the session it was minted from: it can never do more than its scope allows.
 */

const TOKEN_PREFIX = "msw";
const PREFIX_BYTES = 6; // → 8 base64url characters
const SECRET_BYTES = 32; // → 43 base64url characters
const TOUCH_INTERVAL_MS = 60_000;

export const AGENT_TOKEN_PATTERN = /^msw_([A-Za-z0-9_-]{8})_([A-Za-z0-9_-]{43})$/;

export function hashAgentSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function parseAgentToken(token: string): { prefix: string; secret: string } | null {
  const match = AGENT_TOKEN_PATTERN.exec(token.trim());
  if (!match) return null;
  return { prefix: match[1], secret: match[2] };
}

export function mintAgentToken(): { token: string; prefix: string; hash: string } {
  const prefix = randomBytes(PREFIX_BYTES).toString("base64url");
  const secret = randomBytes(SECRET_BYTES).toString("base64url");
  const token = `${TOKEN_PREFIX}_${prefix}_${secret}`;
  return { token, prefix, hash: hashAgentSecret(secret) };
}

function toRecord(row: AgentTokenRow): AgentTokenRecord {
  const { hash: _hash, credential: _credential, ...record } = row;
  return { ...record, scope: record.scope as AgentScope, isLocal: Boolean(record.isLocal) };
}

function credentialFor(user: UserSession): string | null {
  const credential: AgentCredential = {
    Id: user.Id,
    Name: user.Name,
    provider: user.provider,
    ...(user.AccessToken ? { AccessToken: user.AccessToken } : {}),
    ...(user.DeviceId ? { DeviceId: user.DeviceId } : {}),
    ...(user.providerConfig ? { providerConfig: user.providerConfig } : {}),
  };
  if (!credential.AccessToken && !credential.providerConfig) return null;
  return JSON.stringify(credential);
}

export async function createAgentToken(input: {
  name: string;
  scope: AgentScope;
  user: UserSession;
  isLocal?: boolean;
}): Promise<{ token: string; record: AgentTokenRecord }> {
  const minted = mintAgentToken();
  const secret = await getGuestLendingSecret();
  const raw = credentialFor(input.user);

  const row: AgentTokenRow = {
    id: crypto.randomUUID(),
    name: input.name.slice(0, 60),
    prefix: minted.prefix,
    hash: minted.hash,
    userId: input.user.Id,
    userName: input.user.Name,
    provider: String(input.user.provider ?? ""),
    scope: input.scope,
    credential: raw ? encryptValue(raw, secret) : null,
    isLocal: Boolean(input.isLocal),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null,
  };

  await db.insert(agentTokens).values(row);
  logger.info(`[agent] token "${row.name}" created (${row.scope}, user ${row.userName})`);
  return { token: minted.token, record: toRecord(row) };
}

async function touch(row: AgentTokenRow): Promise<void> {
  const last = row.lastUsedAt ? Date.parse(row.lastUsedAt) : 0;
  if (Date.now() - last < TOUCH_INTERVAL_MS) return;
  try {
    await db
      .update(agentTokens)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(agentTokens.id, row.id));
  } catch (error) {
    // A failed bookkeeping write must never fail the request it was decorating.
    logger.warn("[agent] could not record lastUsedAt", error);
  }
}

export async function verifyAgentToken(token: string): Promise<AgentTokenRow | null> {
  const parsed = parseAgentToken(token);
  if (!parsed) return null;

  const row = (await db
    .select()
    .from(agentTokens)
    .where(eq(agentTokens.prefix, parsed.prefix))
    .limit(1)
    .then((rows: AgentTokenRow[]) => rows[0])) as AgentTokenRow | undefined;

  if (!row || row.revokedAt) return null;

  const expected = Buffer.from(row.hash, "hex");
  const actual = Buffer.from(hashAgentSecret(parsed.secret), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  void touch(row);
  return row;
}

export async function listAgentTokens(): Promise<AgentTokenRecord[]> {
  const rows = (await db.select().from(agentTokens)) as AgentTokenRow[];
  return rows
    .map(toRecord)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function revokeAgentToken(id: string): Promise<boolean> {
  const rows = (await db
    .update(agentTokens)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(agentTokens.id, id))
    .returning()) as AgentTokenRow[];
  return rows.length > 0;
}

export async function readAgentCredential(row: AgentTokenRow): Promise<AgentCredential | null> {
  if (!row.credential) return null;
  try {
    const secret = await getGuestLendingSecret();
    return JSON.parse(decryptValue(row.credential, secret)) as AgentCredential;
  } catch (error) {
    logger.warn(`[agent] credential for token ${row.prefix} could not be decrypted`, error);
    return null;
  }
}

export async function recordAgentAudit(input: {
  tokenId: string;
  action: string;
  ok: boolean;
  errorCode?: string | null;
  durationMs: number;
}): Promise<void> {
  try {
    await db.insert(agentAudit).values({
      tokenId: input.tokenId,
      action: input.action,
      ok: input.ok,
      errorCode: input.errorCode ?? null,
      durationMs: Math.round(input.durationMs),
    });
  } catch (error) {
    logger.warn("[agent] audit write failed", error);
  }
}
