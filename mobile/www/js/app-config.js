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
import { isUsableConfig, parseConfigInput } from "./config-parse.js";

const STORAGE_KEY = "madrasaFestFirebaseConfig";

// The active fest within an institution's project. Each institution has
// its own project, so a single fest id per project is all that's needed;
// a multi-fest deployment would swap this for a fest picker.
export const FEST_ID = "current";

function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const isUsable = isUsableConfig;

// Re-exported so views keep importing everything config-related from here.
export { parseConfigInput };

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

export function saveFirebaseConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearFirebaseConfig() {
  localStorage.removeItem(STORAGE_KEY);
}
