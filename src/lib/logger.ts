import { getRuntimeConfig } from "./runtime-config";

/**
 * Centralized logger for Messer Swipe.
 * Prefixes all logs with [Messer Swipe] and handles debug level based on configuration.
 *
 * A bounded ring buffer keeps the last 200 lines so an agent can ask what the
 * process just complained about (`swipe logs`, `GET /api/v1/logs`) without shell
 * access to the container. It never throws, never grows, and scrubs bearer tokens
 * and agent tokens before it remembers anything — a log line is not a place to
 * find a credential.
 */

const PREFIX = "[Messer Swipe]";
const RING_SIZE = 200;
const MAX_MESSAGE_CHARS = 600;

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  at: string;
  level: LogLevel;
  message: string;
}

const ring: LogEntry[] = [];

const isDebugEnabled = () => {
    try {
        const config = getRuntimeConfig();
        return config.enableDebug === true;
    } catch (e) {
        // Fallback for cases where config might not be available yet
        return process.env.ENABLE_DEBUG === 'true';
    }
}

function stringify(value: unknown): string {
    if (typeof value === "string") return value;
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

/** Blunt scrub: anything shaped like a bearer or an agent token becomes a placeholder. */
function scrub(text: string): string {
    return text
        .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer ***")
        .replace(/msw_[A-Za-z0-9_-]{8}_[A-Za-z0-9_-]{43}/g, "msw_***")
        .slice(0, MAX_MESSAGE_CHARS);
}

function record(level: LogLevel, args: unknown[]): void {
    try {
        const message = scrub(args.map(stringify).join(" "));
        ring.push({ at: new Date().toISOString(), level, message });
        if (ring.length > RING_SIZE) ring.shift();
    } catch {
        // The buffer must never be able to break a log call.
    }
}

/** Newest last, so a reader gets chronological order. */
export function recentLogs(options: { limit?: number; level?: LogLevel; sinceMs?: number } = {}): LogEntry[] {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), RING_SIZE);
    const floor = options.sinceMs ? Date.now() - options.sinceMs : 0;
    return ring
        .filter((entry) => (options.level ? entry.level === options.level : true))
        .filter((entry) => Date.parse(entry.at) >= floor)
        .slice(-limit);
}

export const logger = {
    debug: (...args: any[]) => {
        if (isDebugEnabled()) {
            record("debug", args);
            console.debug(PREFIX, ...args);
        }
    },
    info: (...args: any[]) => {
        record("info", args);
        console.info(PREFIX, ...args);
    },
    warn: (...args: any[]) => {
        record("warn", args);
        console.warn(PREFIX, ...args);
    },
    error: (...args: any[]) => {
        record("error", args);
        console.error(PREFIX, ...args);
    }
};
