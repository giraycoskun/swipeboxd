import { deck } from "./deck.mjs";
import { diag } from "./diag.mjs";
import { libraries } from "./libraries.mjs";
import { logs } from "./logs.mjs";
import { media } from "./media.mjs";
import { member } from "./member.mjs";
import { session, sessions } from "./sessions.mjs";
import { status } from "./status.mjs";
import { token } from "./token.mjs";

export const commands = { status, libraries, deck, media, sessions, session, member, logs, diag, token };
