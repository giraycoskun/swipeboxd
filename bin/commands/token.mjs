import { CliError, apiGet, apiRequest } from "../lib/http.mjs";

const SCOPES = ["read", "write", "admin"];

/**
 * Tokens are the one piece of the agent surface an operator sets up by hand, and
 * this is where they do it: a shell inside the container. There is no browser
 * counterpart, so the plaintext of a new token exists in exactly one response.
 */
export const token = {
  summary: "Agent tokens: list, create, revoke (needs an admin token)",
  async run(ctx, rest, flags) {
    const [action, target] = rest;

    if (!action || action === "list") return apiGet(ctx, "/tokens");

    if (action === "create") {
      if (!target) {
        throw new CliError("USAGE", "token create needs a name", "messer-swipe token create laptop --scope read");
      }
      const scope = typeof flags.scope === "string" ? flags.scope : "read";
      if (!SCOPES.includes(scope)) {
        throw new CliError("USAGE", `scope must be one of ${SCOPES.join(", ")}`, "the default is read");
      }
      return apiRequest(ctx, "POST", "/tokens", { name: target, scope });
    }

    if (action === "revoke") {
      if (!target) {
        throw new CliError("USAGE", "token revoke needs an id or prefix", "messer-swipe token list");
      }
      return apiRequest(ctx, "DELETE", `/tokens/${encodeURIComponent(target)}`);
    }

    throw new CliError("USAGE", `Unknown token action "${action}"`, "list, create, revoke");
  },
  human(body) {
    const d = body.data;

    if (Array.isArray(d.tokens)) {
      if (d.tokens.length === 0) return "no agent tokens";
      return d.tokens
        .map((t) => {
          const state = t.revokedAt
            ? "revoked"
            : t.lastUsedAt
              ? `used ${String(t.lastUsedAt).slice(0, 10)}`
              : "never used";
          const name = t.isLocal ? (t.name === "local" ? "local" : `local · ${t.name}`) : t.name;
          return `${t.prefix}  ${String(t.scope).padEnd(5)}  ${name}  ${state}`;
        })
        .join("\n");
    }

    if (d.token) {
      return [
        `created "${d.record.name}" (${d.record.scope}) — shown once:`,
        `  ${d.token}`,
        "Pass it as MESSER_SWIPE_TOKEN or --token. Never paste it into an issue.",
      ].join("\n");
    }

    return `revoked ${d.prefix}${d.alreadyRevoked ? " (already revoked)" : ""}`;
  },
};
