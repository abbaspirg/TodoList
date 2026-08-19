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

const REQUIRED_KEYS = ["apiKey", "authDomain", "projectId", "appId"];

const raw = process.env.FIREBASE_CONFIG || "";
const institutionName = (process.env.INSTITUTION_NAME || "").trim();

let config;
try {
  config = JSON.parse(raw);
} catch (err) {
  console.error("FIREBASE_CONFIG is not valid JSON.");
  console.error("Paste the config as JSON, e.g. {\"apiKey\":\"...\",\"projectId\":\"...\"}");
  console.error(String(err.message));
  process.exit(1);
}

const missing = REQUIRED_KEYS.filter((k) => typeof config?.[k] !== "string" || config[k].trim() === "");
if (missing.length > 0) {
  console.error(`FIREBASE_CONFIG is missing required key(s): ${missing.join(", ")}`);
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
