import { readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

/**
 * Dev-only identity registry for one-tap impersonation.
 *
 * The registry is a 600 JSON array outside every repository. It is the same
 * file the Portal's dropdown reads (through `optionsFile`), which whitelists
 * value/label/info/badge — the `credentials` block never leaves this module.
 */

export interface IdentityCredentials {
  /** Dotenv-style file holding the values, e.g. ~/Server/etc/secrets/jellyfin.env */
  envFile?: string;
  /** Key in that file for the username (absent = the identity's label) */
  user?: string;
  /** Key in that file for the password / token */
  password?: string;
}

export interface Identity {
  value: string;
  label?: string;
  provider: string;
  providerUrl?: string;
  publicUrl?: string;
  container?: string;
  credentials?: IdentityCredentials;
}

/** The route only exists when the launcher set the flag, and never in prod. */
export function impersonationEnabled(env: Record<string, string | undefined>): boolean {
  return env.DEV_IMPERSONATE === "1" && env.NODE_ENV !== "production";
}

export function expandHome(filePath: string): string {
  if (filePath === "~") return homedir();
  if (filePath.startsWith("~/")) return path.join(homedir(), filePath.slice(2));
  return filePath;
}

function isIdentity(value: unknown): value is Identity {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.value === "string" && entry.value.length > 0;
}

export function loadIdentities(filePath: string): Identity[] {
  const absolute = expandHome(filePath || "");
  if (!absolute || !path.isAbsolute(absolute) || absolute.includes("..")) {
    throw new Error("identity registry path must be absolute and free of '..'");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absolute, "utf8"));
  } catch (error) {
    throw new Error(
      `cannot read identity registry ${absolute}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`identity registry must be a JSON array: ${absolute}`);
  }
  return parsed.filter(isIdentity);
}

export function pickIdentity(identities: Identity[], value: string): Identity | null {
  return identities.find((identity) => identity.value === value) ?? null;
}

/** Parses `KEY=VALUE` lines without sourcing or executing anything. */
export function parseEnvFile(text: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) vars[key] = value;
  }
  return vars;
}

/**
 * Resolves the credentials for one identity. A file that is group/other
 * readable is refused — these hold a real account password or server token.
 */
export function resolveCredentials(identity: Identity): {
  username: string;
  password: string;
} {
  const credentials = identity.credentials;
  const fallbackUser = identity.label ?? identity.value;
  if (!credentials) {
    return { username: fallbackUser, password: "" };
  }

  if (!credentials.envFile) {
    throw new Error(`identity ${identity.value} has credentials but no envFile`);
  }
  const file = expandHome(credentials.envFile);
  if (!path.isAbsolute(file) || file.includes("..")) {
    throw new Error(`credential file must be absolute: ${credentials.envFile}`);
  }

  let stats;
  try {
    stats = statSync(file);
  } catch {
    throw new Error(`credential file is missing: ${file}`);
  }
  if ((stats.mode & 0o077) !== 0) {
    throw new Error(`credential file must be mode 600 (group/other can read it): ${file}`);
  }

  const vars = parseEnvFile(readFileSync(file, "utf8"));
  const password = credentials.password ? vars[credentials.password] ?? "" : "";
  const username = credentials.user ? vars[credentials.user] ?? "" : fallbackUser;

  if (credentials.password && !password) {
    throw new Error(`${credentials.password} is empty or missing in ${file}`);
  }
  return { username, password };
}
