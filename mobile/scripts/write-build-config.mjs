// Bakes one institution's Firebase project into the build, producing a
// per-institution APK that connects on first launch with no setup step for
// anyone — see README "Multi-institution setup" and the workflow_dispatch
// inputs in .github/workflows/android-build.yml.
//
// Reads FIREBASE_CONFIG (JSON) and INSTITUTION_NAME from the environment
// and overwrites mobile/www/js/build-config.js. Exits non-zero on anything
// malformed, so a bad paste fails the build instead of producing an APK
// that quietly falls back to the setup screen.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
// The very same parser the in-app setup screen uses, so whatever an admin
// can paste into the app also works as the FIREBASE_CONFIG variable —
// including the console's `const firebaseConfig = { apiKey: ... }` snippet
// with unquoted keys, which strict JSON.parse rejects.
import { parseConfigInput } from "../www/js/config-parse.js";

const raw = process.env.FIREBASE_CONFIG || "";
const institutionName = (process.env.INSTITUTION_NAME || "").trim();

let config;
try {
  config = parseConfigInput(raw);
} catch (err) {
  console.error(`FIREBASE_CONFIG could not be read: ${err.message}`);
  console.error("Accepted: the config object, or the whole snippet from the Firebase console.");
  process.exit(1);
}

if (institutionName) config.institutionName = institutionName;

const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "www", "js", "build-config.js");
writeFileSync(
  outPath,
  `// GENERATED at build time by scripts/write-build-config.mjs — do not edit.
// Per-institution build; see README "Multi-institution setup".
export const BUILD_CONFIG = ${JSON.stringify(config, null, 2)};
`,
);

console.log(`Baked in config for ${institutionName || config.projectId} (project: ${config.projectId})`);
