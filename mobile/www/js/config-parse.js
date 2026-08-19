// Parsing a Firebase web config out of whatever an admin pasted.
//
// Its own module because two very different callers need identical
// behaviour: the in-app setup screen (js/app-config.js) and the CI build
// step that bakes a config into a per-institution build
// (mobile/scripts/write-build-config.mjs, which runs under Node). Keeping
// one implementation means a format that works in the app also works in
// CI — they diverged once, and the CI side rejected the exact snippet the
// app accepted.
//
// Pure: no DOM, no localStorage, so Node can import it directly.

export const REQUIRED_KEYS = ["apiKey", "authDomain", "projectId", "appId"];

export function isUsableConfig(config) {
  return Boolean(config) && REQUIRED_KEYS.every((k) => typeof config[k] === "string" && config[k].trim() !== "");
}

/** Accepts either the config object or the whole `firebaseConfig = {...}`
 * snippet Firebase's console shows, so an admin can paste either. Throws a
 * message meant to be shown to that admin. */
export function parseConfigInput(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) throw new Error("Paste your Firebase config first.");

  let candidate = null;
  try {
    candidate = JSON.parse(trimmed);
  } catch {
    // Not strict JSON — most likely the console's JS snippet, which has
    // unquoted keys, single quotes, and `const firebaseConfig = ...;`
    // wrapped around it. Normalised into JSON below rather than eval'd:
    // running pasted text as code would hand anyone who can talk an admin
    // into pasting something arbitrary code inside the app.
    candidate = parseObjectLiteral(trimmed);
  }

  if (!isUsableConfig(candidate)) {
    const missing = REQUIRED_KEYS.filter((k) => !candidate?.[k]);
    throw new Error(`Config is missing: ${missing.join(", ")}.`);
  }
  return candidate;
}

/** Locates the config object within a pasted snippet.
 *
 * Naively taking the first `{` to the last `}` is wrong for the snippet the
 * Firebase console actually shows, which opens with
 * `import { initializeApp } from "firebase/app"` — the first brace belongs
 * to the import. So: anchor on `firebaseConfig = {` when it's present, then
 * walk forward counting depth (ignoring braces inside strings) to find that
 * object's own closing brace. */
function findConfigObject(text) {
  const anchor = text.match(/firebaseConfig\s*=\s*\{/);
  const start = anchor ? anchor.index + anchor[0].length - 1 : text.indexOf("{");
  if (start === -1) return { start: -1, end: -1 };

  let depth = 0;
  let quote = null;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") i++; // skip the escaped character
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return { start, end: i };
  }
  return { start: -1, end: -1 }; // unbalanced
}

/** Turns the Firebase console's JS snippet into JSON by quoting bare keys
 * and normalising quotes/trailing commas — no code execution. Only the
 * flat string-valued object Firebase emits is supported, which is all a
 * config ever is. */
function parseObjectLiteral(text) {
  const { start, end } = findConfigObject(text);
  if (start === -1) throw new Error("That doesn't look like a Firebase config.");

  const json = text
    .slice(start, end + 1)
    // Line comments — the `[^:]` guard keeps this from eating the rest of
    // a line at the `//` of a URL value, which a config carrying
    // databaseURL: "https://..." definitely has.
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1")
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":') // bare keys -> quoted
    .replace(/'([^'\\]*)'/g, '"$1"') // single-quoted strings -> double
    .replace(/,(\s*})/g, "$1"); // trailing commas

  try {
    return JSON.parse(json);
  } catch {
    throw new Error("Couldn't read that config — paste the whole { ... } block from the Firebase console.");
  }
}
