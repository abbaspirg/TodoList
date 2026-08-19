// Where the app's Firebase project comes from.
//
// The app is sold to multiple institutions, each with their OWN Firebase
// project (see README "Multi-institution setup") — so the project can't be
// a constant compiled into the source. It's resolved at startup, in this
// order:
//
//   1. Baked-in build config — js/build-config.js, written by CI for a
//      per-institution build. Nobody sets anything up: install and run.
//   2. Saved runtime config — an admin pasted their project's config into
//      the setup screen once on this device (views/setup.js). Used by the
//      generic build.
//   3. Neither — Local Test Mode: everything runs against localStorage, no
//      project needed. This is also what the demo/testing flow uses.
//
// A Firebase *web* config is not a secret — it ships in the source of every
// Firebase web app, and security comes from Firestore rules and Auth, not
// from hiding these values. That's what makes pasting/QR/baking it in safe.
import { BUILD_CONFIG } from "./build-config.js";

const STORAGE_KEY = "madrasaFestFirebaseConfig";

// The active fest within an institution's project. Each institution has
// its own project, so a single fest id per project is all that's needed;
// a multi-fest deployment would swap this for a fest picker.
export const FEST_ID = "current";

const REQUIRED_KEYS = ["apiKey", "authDomain", "projectId", "appId"];

function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isUsable(config) {
  return Boolean(config) && REQUIRED_KEYS.every((k) => typeof config[k] === "string" && config[k].trim() !== "");
}

/** The institution's Firebase config, or null to run in Local Test Mode. */
export function getFirebaseConfig() {
  if (isUsable(BUILD_CONFIG)) return BUILD_CONFIG;
  const saved = readSaved();
  return isUsable(saved) ? saved : null;
}

/** True when this build has a project baked in — the setup screen is then
 * neither shown nor escapable, since the institution's project is fixed. */
export function isBakedIn() {
  return isUsable(BUILD_CONFIG);
}

/** Institution name for a per-institution build, shown in the app header.
 * Falls back to the generic product name. */
export function getInstitutionName() {
  return BUILD_CONFIG?.institutionName || null;
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

  if (!isUsable(candidate)) {
    const missing = REQUIRED_KEYS.filter((k) => !candidate?.[k]);
    throw new Error(`Config is missing: ${missing.join(", ")}.`);
  }
  return candidate;
}

/** Turns the Firebase console's JS snippet into JSON by quoting bare keys
 * and normalising quotes/trailing commas — no code execution. Only the
 * flat string-valued object Firebase emits is supported, which is all a
 * config ever is. */
function parseObjectLiteral(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("That doesn't look like a Firebase config.");

  const json = text
    .slice(start, end + 1)
    .replace(/\/\/[^\n]*/g, "") // line comments
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

export function saveFirebaseConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearFirebaseConfig() {
  localStorage.removeItem(STORAGE_KEY);
}
