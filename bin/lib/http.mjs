/**
 * One request, one envelope, one error type.
 *
 * The server's contract is `/api/v1`: `{ok, api, data, meta}` or
 * `{ok, api, error:{code, message, hint}}`. The CLI never inspects English — it
 * branches on `code`, and the exit status is derived from it.
 */

export class CliError extends Error {
  constructor(code, message, hint = null) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.hint = hint;
  }
}

export function apiUrl(ctx, path) {
  return `${ctx.baseUrl}${ctx.basePath}/api/v1${path}`;
}

export function apiGet(ctx, path) {
  return apiRequest(ctx, "GET", path);
}

export async function apiRequest(ctx, method, path, payload = null) {
  if (!ctx.token) {
    throw new CliError(
      "UNAUTHORIZED",
      "No agent token found.",
      "Create one inside the container with `messer-swipe token create <name>`, pass --token, or log in once so /app/data/.agent-token exists."
    );
  }

  const url = apiUrl(ctx, path);
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${ctx.token}`,
        accept: "application/json",
        ...(payload ? { "content-type": "application/json" } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
  } catch (error) {
    throw new CliError(
      "NETWORK",
      `Cannot reach ${url}: ${error.message}`,
      "Is the container running? A slept (Sablier) container has to be woken by loading the page first."
    );
  }

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new CliError(
      "BAD_RESPONSE",
      `${url} answered HTTP ${response.status} with something that is not JSON.`,
      "The URL may point at a proxy or a base path that is not a Messer Swipe instance."
    );
  }

  if (!body || body.ok !== true) {
    const error = body?.error ?? {};
    throw new CliError(
      error.code ?? `HTTP_${response.status}`,
      error.message ?? `HTTP ${response.status}`,
      error.hint ?? null
    );
  }

  if (body.api !== ctx.apiVersion) {
    throw new CliError(
      "API_VERSION",
      `The server speaks api ${body.api}; this CLI speaks api ${ctx.apiVersion}.`,
      "CLI and app were built from different versions — upgrade the image."
    );
  }

  return body;
}
