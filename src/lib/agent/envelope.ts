import { NextResponse } from "next/server";

import { config } from "@/lib/config";

/**
 * The agent API's envelope. Every `/api/v1` response — success or failure — is
 * one of these two shapes, with `api` carrying the contract version so a client
 * can refuse a server it does not understand instead of guessing.
 */
export const API_VERSION = 1;

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "PROVIDER_UNREACHABLE"
  | "PROVIDER_AUTH_REQUIRED"
  | "AGENT_API_DISABLED"
  | "INTERNAL";

const ERROR_STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  PROVIDER_UNREACHABLE: 502,
  PROVIDER_AUTH_REQUIRED: 409,
  AGENT_API_DISABLED: 404,
  INTERNAL: 500,
};

export function apiOk<T>(data: T, startedAt: number) {
  return NextResponse.json({
    ok: true,
    api: API_VERSION,
    data,
    meta: { version: config.app.version, durationMs: Math.max(0, Date.now() - startedAt) },
  });
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  options: { hint?: string; status?: number } = {}
) {
  const status = options.status ?? ERROR_STATUS[code];
  const body: Record<string, unknown> = {
    ok: false,
    api: API_VERSION,
    error: {
      code,
      message,
      ...(options.hint ? { hint: options.hint } : {}),
    },
  };

  // A caller that holds no token should learn how to get one without reading the docs.
  if (code === "UNAUTHORIZED") {
    return NextResponse.json(body, {
      status,
      headers: { "WWW-Authenticate": 'Bearer realm="messer-swipe"' },
    });
  }

  return NextResponse.json(body, { status });
}
