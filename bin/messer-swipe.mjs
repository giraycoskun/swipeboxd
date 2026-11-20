#!/usr/bin/env node
/**
 * `messer-swipe` — the agent surface for a Messer Swipe instance.
 *
 * JSON on stdout by default, because the caller is usually an agent; `--human`
 * is for the person at the keyboard. Exit codes are part of the contract:
 *   0 ok · 1 failure · 2 usage · 3 auth · 4 not found · 5 provider/network
 */
import { parseArgv, resolveContext } from "./lib/local.mjs";
import { CliError } from "./lib/http.mjs";
import { commands } from "./commands/index.mjs";

// The image sets APP_VERSION, so the CLI reports the build it shipped with — not a
// constant that drifts from the server it talks to.
const CLI_VERSION = process.env.MESSER_SWIPE_CLI_VERSION || process.env.APP_VERSION || "dev";

const EXIT_BY_CODE = {
  UNAUTHORIZED: 3,
  FORBIDDEN: 3,
  PROVIDER_AUTH_REQUIRED: 3,
  NOT_FOUND: 4,
  PROVIDER_UNREACHABLE: 5,
  NETWORK: 5,
  BAD_REQUEST: 2,
  USAGE: 2,
  INTERNAL: 1,
  BAD_RESPONSE: 1,
  API_VERSION: 1,
};

function printHelp() {
  const names = Object.keys(commands).sort();
  const width = Math.max(...names.map((name) => name.length));
  const lines = [
    "messer-swipe — talk to a Messer Swipe instance",
    "",
    "Usage: messer-swipe <command> [options]",
    "",
    "Commands:",
    ...names.map((name) => `  ${name.padEnd(width)}  ${commands[name].summary}`),
    "",
    "Options:",
    "  --url <url>        Instance URL (default $MESSER_SWIPE_URL, else http://127.0.0.1:$PORT)",
    "  --token <token>    Agent token (default $MESSER_SWIPE_TOKEN, else the local token file)",
    "  --base-path <p>    Reverse-proxy prefix, when URL_BASE_PATH is set",
    "  --human            Tables instead of JSON",
    "  --help, --version",
    "",
    "Inside the container no options are needed:",
    "  docker exec <container> messer-swipe status",
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
}

function reportError(error, json) {
  const code = error instanceof CliError ? error.code : "INTERNAL";
  const message = error instanceof Error ? error.message : String(error);
  const hint = error instanceof CliError ? error.hint : null;

  if (json) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: { code, message, ...(hint ? { hint } : {}) } }, null, 2)}\n`);
  } else {
    process.stderr.write(`error: ${message}${hint ? `\n  ${hint}` : ""}\n`);
  }
}

function exitFor(error) {
  const code = error instanceof CliError ? error.code : "INTERNAL";
  return EXIT_BY_CODE[code] ?? 1;
}

async function main() {
  const { flags, positionals } = parseArgv(process.argv.slice(2));

  if (flags.version) {
    process.stdout.write(`messer-swipe ${CLI_VERSION} (api 1)\n`);
    return 0;
  }

  if (flags.help || positionals.length === 0) {
    printHelp();
    return flags.help ? 0 : 2;
  }

  const [name, ...rest] = positionals;
  const command = commands[name];
  if (!command) {
    reportError(new CliError("USAGE", `Unknown command "${name}".`, "Run `messer-swipe --help` for the list."), !flags.human);
    return 2;
  }

  const ctx = resolveContext(flags);

  try {
    const body = await command.run(ctx, rest, flags);
    process.stdout.write(flags.human ? `${command.human(body)}\n` : `${JSON.stringify(body, null, 2)}\n`);
    return 0;
  } catch (error) {
    reportError(error, !flags.human);
    return exitFor(error);
  }
}

// A closed pipe (`| head`) is not an error worth a stack trace.
process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") process.exit(0);
  throw error;
});

main().then((code) => process.exit(code));
