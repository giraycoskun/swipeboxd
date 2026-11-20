import { sqliteTable, text, integer, uniqueIndex, index, blob } from "drizzle-orm/sqlite-core";
import { sql, type InferSelectModel, type InferInsertModel } from "drizzle-orm";

export const sessions = sqliteTable("Session", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  hostUserId: text("hostUserId").notNull(),
  hostAccessToken: text("hostAccessToken"),
  hostDeviceId: text("hostDeviceId"),
  provider: text("provider"),
  providerConfig: text("providerConfig"),
  filters: text("filters"),
  settings: text("settings"),
  randomSeed: text("randomSeed"),
  createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return [
    uniqueIndex("Session_code_key").on(table.code),
  ];
});

export type Session = InferSelectModel<typeof sessions>;
export type NewSession = InferInsertModel<typeof sessions>;

export const likes = sqliteTable("Like", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: text("externalId").notNull(),
  externalUserId: text("externalUserId").notNull(),
  // Content kind of the liked item. Pre-2.0 rows are movies, hence the default.
  kind: text("kind").notNull().default("movie"),
  isMatch: integer("isMatch", { mode: "boolean" }).notNull().default(false),
  sessionCode: text("sessionCode").references(() => sessions.code, { onDelete: "cascade" }),
  createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return [
    uniqueIndex("Like_session_key").on(table.externalId, table.externalUserId, table.sessionCode, table.kind).where(sql`sessionCode IS NOT NULL`),
    uniqueIndex("Like_solo_key").on(table.externalId, table.externalUserId, table.kind).where(sql`sessionCode IS NULL`),
    index("Like_externalUserId_createdAt_idx").on(table.externalUserId, table.createdAt),
    index("Like_sessionCode_externalUserId_idx").on(table.sessionCode, table.externalUserId),
    index("Like_sessionCode_externalId_idx").on(table.sessionCode, table.externalId),
  ];
});

export type Like = InferSelectModel<typeof likes>;
export type NewLike = InferInsertModel<typeof likes>;

export const hiddens = sqliteTable("Hidden", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  externalId: text("externalId").notNull(),
  externalUserId: text("externalUserId").notNull(),
  // Content kind of the hidden item. Pre-2.0 rows are movies.
  kind: text("kind").notNull().default("movie"),
  sessionCode: text("sessionCode").references(() => sessions.code, { onDelete: "cascade" }),
}, (table) => {
  return [
    uniqueIndex("Hidden_session_key").on(table.externalId, table.externalUserId, table.sessionCode, table.kind).where(sql`sessionCode IS NOT NULL`),
    uniqueIndex("Hidden_solo_key").on(table.externalId, table.externalUserId, table.kind).where(sql`sessionCode IS NULL`),
    index("Hidden_sessionCode_externalUserId_idx").on(table.sessionCode, table.externalUserId),
    index("Hidden_externalUserId_sessionCode_idx").on(table.externalUserId, table.sessionCode),
  ];
});

export type Hidden = InferSelectModel<typeof hiddens>;
export type NewHidden = InferInsertModel<typeof hiddens>;

export const sessionMembers = sqliteTable("SessionMember", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionCode: text("sessionCode").references(() => sessions.code, { onDelete: "cascade" }),
  externalUserId: text("externalUserId").notNull(),
  externalUserName: text("externalUserName").notNull(),
  settings: text("settings"),
  joinedAt: text("joinedAt").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return [
    uniqueIndex("SessionMember_sessionCode_externalUserId_key").on(table.sessionCode, table.externalUserId),
    index("SessionMember_sessionCode_idx").on(table.sessionCode),
  ];
});

export type SessionMember = InferSelectModel<typeof sessionMembers>;
export type NewSessionMember = InferInsertModel<typeof sessionMembers>;

export const config = sqliteTable("Config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type Config = InferSelectModel<typeof config>;
export type NewConfig = InferInsertModel<typeof config>;

export const userProfiles = sqliteTable("UserProfile", {
  userId: text("userId").primaryKey(),
  image: blob("image", { mode: "buffer" }),
  contentType: text("contentType"),
  updatedAt: text("updatedAt").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export type UserProfile = InferSelectModel<typeof userProfiles>;
export type NewUserProfile = InferInsertModel<typeof userProfiles>;

export const sessionEvents = sqliteTable("SessionEvent", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionCode: text("sessionCode").notNull(),
  type: text("type").notNull(),
  payload: text("payload").notNull(),
  createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return [
    index("SessionEvent_sessionCode_idx").on(table.sessionCode),
    index("SessionEvent_id_sessionCode_idx").on(table.id, table.sessionCode),
  ];
});

export type SessionEvent = InferSelectModel<typeof sessionEvents>;
export type NewSessionEvent = InferInsertModel<typeof sessionEvents>;

/**
 * Agent tokens: the credential an outside agent (a CLI, a script, Hermes) uses
 * instead of a browser cookie. The plaintext is shown once at creation; only the
 * sha256 of the secret is stored, plus an 8-character prefix used for lookup.
 *
 * `credential` is the encrypted member identity the token acts as — the same
 * trust the schema already places in `Session.hostAccessToken` for guest lending.
 * `isLocal` marks the token the container mints for `docker exec`; it is the only
 * one that may be bound to a session without a human copying it.
 */
export const agentTokens = sqliteTable("AgentToken", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  hash: text("hash").notNull(),
  userId: text("userId").notNull(),
  userName: text("userName").notNull(),
  provider: text("provider").notNull(),
  scope: text("scope").notNull().default("read"),
  credential: text("credential"),
  isLocal: integer("isLocal", { mode: "boolean" }).notNull().default(false),
  createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  lastUsedAt: text("lastUsedAt"),
  revokedAt: text("revokedAt"),
}, (table) => {
  return [
    uniqueIndex("AgentToken_prefix_key").on(table.prefix),
    index("AgentToken_userId_idx").on(table.userId),
  ];
});

export type AgentToken = InferSelectModel<typeof agentTokens>;
export type NewAgentToken = InferInsertModel<typeof agentTokens>;

/** One row per write an agent performed. Reads only bump `lastUsedAt`. */
export const agentAudit = sqliteTable("AgentAudit", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tokenId: text("tokenId").notNull(),
  action: text("action").notNull(),
  ok: integer("ok", { mode: "boolean" }).notNull(),
  errorCode: text("errorCode"),
  durationMs: integer("durationMs").notNull().default(0),
  createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
  return [
    index("AgentAudit_tokenId_createdAt_idx").on(table.tokenId, table.createdAt),
  ];
});

export type AgentAudit = InferSelectModel<typeof agentAudit>;
export type NewAgentAudit = InferInsertModel<typeof agentAudit>;
