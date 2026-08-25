// Where this app's Firebase project comes from, resolved at startup:
//
//   1. Baked-in build config — js/build-config.js, written by CI.
//   2. Saved runtime config — pasted into the setup screen once on this
//      device.
//
// A Firebase *web* config is not a secret: it ships in the source of every
// Firebase web app, and security comes from firestore.rules and Auth, not
// from hiding these values. That is what makes pasting it or baking it into
// a public build safe.
import { BUILD_CONFIG } from "./build-config.js";
import { isUsableConfig, parseConfigInput } from "./config-parse.js";

const STORAGE_KEY = "ludoFirebaseConfig";

export { parseConfigInput };

function readSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getFirebaseConfig() {
  if (isUsableConfig(BUILD_CONFIG)) return BUILD_CONFIG;
  const saved = readSaved();
  return isUsableConfig(saved) ? saved : null;
}

export function isBakedIn() {
  return isUsableConfig(BUILD_CONFIG);
}

export function saveFirebaseConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearFirebaseConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

/** A TURN relay baked in at build time, so a distributed build can carry one
 * without every player pasting it. See js/ice.js for why a relay matters. */
export function getBuiltInTurn() {
  const turn = BUILD_CONFIG?.turn;
  return turn && turn.urls ? turn : null;
}
