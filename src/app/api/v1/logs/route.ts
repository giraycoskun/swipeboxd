import { agentRoute } from "@/lib/agent/route";
import { recentLogs, type LogLevel } from "@/lib/logger";

const LEVELS = new Set<LogLevel>(["debug", "info", "warn", "error"]);

/** The tail of the process buffer — counts and messages, credentials already scrubbed. */
export const GET = agentRoute("read", "logs", async (_ctx, request) => {
  const params = new URL(request.url).searchParams;
  const levelParam = params.get("level");
  const level = levelParam && LEVELS.has(levelParam as LogLevel) ? (levelParam as LogLevel) : undefined;
  const sinceMinutes = Math.min(Math.max(Number(params.get("since") ?? 60) || 60, 1), 24 * 60);

  return {
    sinceMinutes,
    level: level ?? "all",
    entries: recentLogs({ limit: Number(params.get("limit") ?? 50), level, sinceMs: sinceMinutes * 60_000 }),
  };
});
