// Bakes a Firebase project into the build, so a distributed APK or a
// deployed web build connects on first launch with no setup screen.
//
// Reads FIREBASE_CONFIG (JSON, or the console's JS snippet) and optional
// TURN_URLS / TURN_USERNAME / TURN_CREDENTIAL from the environment, and
// overwrites ludo/www/js/build-config.js. Exits non-zero on anything
// malformed, so a bad paste fails the build instead of producing a build
// that quietly falls back to the setup screen.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// The same parser the in-app setup screen uses, so whatever can be pasted
// into the app also works as the CI variable — including the console's
// `const firebaseConfig = { apiKey: ... }` snippet with unquoted keys,
// which strict JSON.parse rejects.
import { parseConfigInput } from "../www/js/config-parse.js";

const raw = process.env.FIREBASE_CONFIG || "";

let config;
try {
  config = parseConfigInput(raw);
} catch (err) {
  console.error(`FIREBASE_CONFIG could not be read: ${err.message}`);
  console.error("Accepted: the config object, or the whole snippet from the Firebase console.");
  process.exit(1);
}

// Optional: ship a voice relay with the build, so players don't each have
// to paste one into Settings. See ludo/www/js/ice.js for why it matters.
const turnUrls = (process.env.TURN_URLS || "").trim();
if (turnUrls) {
  config.turn = {
    urls: turnUrls,
    username: (process.env.TURN_USERNAME || "").trim(),
    credential: (process.env.TURN_CREDENTIAL || "").trim(),
  };
}

const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "www", "js", "build-config.js");
writeFileSync(
  outPath,
  `// GENERATED at build time by scripts/write-build-config.mjs — do not edit.
export const BUILD_CONFIG = ${JSON.stringify(config, null, 2)};
`,
);

console.log(
  `Baked in project ${config.projectId}${turnUrls ? ` with a TURN relay at ${turnUrls}` : " with no TURN relay"}`,
);
