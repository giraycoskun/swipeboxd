import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_PORT = "4321";
const API_VERSION = 1;

/**
 * Where the CLI points, and with which token.
 *
 * Order matters: an explicit flag beats the environment, and the environment
 * beats the token the container minted for itself. Inside the image nothing is
 * configured at all — `http://127.0.0.1:$PORT` and `/app/data/.agent-token` are
 * exactly right, so `docker exec <container> messer-swipe status` needs no flags.
 */
export function resolveContext(flags) {
  const baseUrl = stripSlash(
    flags.url || process.env.MESSER_SWIPE_URL || `http://127.0.0.1:${process.env.PORT || DEFAULT_PORT}`
  );
  const basePath = normalizeBase(flags["base-path"] ?? process.env.URL_BASE_PATH ?? "");

  let token = null;
  let tokenSource = null;

  if (typeof flags.token === "string") {
    token = flags.token;
    tokenSource = "--token";
  } else if (process.env.MESSER_SWIPE_TOKEN) {
    token = process.env.MESSER_SWIPE_TOKEN;
    tokenSource = "MESSER_SWIPE_TOKEN";
  } else {
    const found = readLocalToken(typeof flags["token-file"] === "string" ? flags["token-file"] : null);
    if (found) {
      token = found.token;
      tokenSource = found.path;
    }
  }

  return { baseUrl, basePath, token, tokenSource, apiVersion: API_VERSION, json: !flags.human };
}

function readLocalToken(explicit) {
  const candidates = [];
  if (explicit) candidates.push(explicit);
  if (process.env.MESSER_SWIPE_TOKEN_FILE) candidates.push(process.env.MESSER_SWIPE_TOKEN_FILE);
  if (process.env.DATA_DIR) candidates.push(join(process.env.DATA_DIR, ".agent-token"));
  candidates.push("/app/data/.agent-token", join(process.cwd(), ".agent-token"));

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const token = readFileSync(path, "utf8").trim();
    if (token) return { token, path };
  }
  return null;
}

function stripSlash(value) {
  return String(value).replace(/\/+$/, "");
}

function normalizeBase(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "/") return "";
  return `/${raw.replace(/^\/+|\/+$/g, "")}`;
}

export function parseArgv(argv) {
  const flags = {};
  const positionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg === "-h") { flags.help = true; continue; }
    if (arg === "-v") { flags.version = true; continue; }
    if (!arg.startsWith("--")) { positionals.push(arg); continue; }

    const body = arg.slice(2);
    const eq = body.indexOf("=");
    if (eq >= 0) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
      continue;
    }
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--") && !next.startsWith("-") ) {
      flags[body] = next;
      i += 1;
    } else {
      flags[body] = true;
    }
  }

  return { flags, positionals };
}
