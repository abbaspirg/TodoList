// Adds the permissions the voice chat needs to the Android manifest that
// `npx cap add android` generates.
//
// The Android project is not committed — it is generated in CI — so this
// runs after `cap add` on every build rather than being a one-off edit.
// Without RECORD_AUDIO the WebView's getUserMedia call is refused and
// "Join voice" fails on every device with no useful error.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const manifestPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "android",
  "app",
  "src",
  "main",
  "AndroidManifest.xml",
);

const PERMISSIONS = [
  "android.permission.RECORD_AUDIO",
  // Lets the app switch the audio route (earpiece vs speaker) and set the
  // communication audio mode, which is what makes echo cancellation work.
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.INTERNET",
  "android.permission.ACCESS_NETWORK_STATE",
];

let xml = readFileSync(manifestPath, "utf8");
const added = [];

for (const permission of PERMISSIONS) {
  if (xml.includes(permission)) continue;
  xml = xml.replace("</manifest>", `    <uses-permission android:name="${permission}" />\n</manifest>`);
  added.push(permission);
}

// A phone without a microphone should still be able to install and play —
// voice is optional, so the feature is declared not required.
if (!xml.includes("android.hardware.microphone")) {
  xml = xml.replace(
    "</manifest>",
    '    <uses-feature android:name="android.hardware.microphone" android:required="false" />\n</manifest>',
  );
  added.push("uses-feature microphone (optional)");
}

writeFileSync(manifestPath, xml);
console.log(added.length ? `Added to the manifest:\n  ${added.join("\n  ")}` : "Manifest already complete.");
