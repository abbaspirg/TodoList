// Generates www/_harness.html from the real index.html, adding an import
// map that swaps js/firebase.js for test/fake-firebase.js.
//
// Generated rather than hand-written so the harness can never drift from
// the page it is meant to be testing: it IS index.html, with one module
// substituted.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const www = join(here, "..", "www");

const html = readFileSync(join(www, "index.html"), "utf8");

// Import maps key on the fully resolved URL, so the app's relative
// "./firebase.js" has to be listed as the absolute path it resolves to.
// The test server is rooted at ludo/, which is what makes both www/ and
// test/ reachable from one origin.
const importMap = `
<script type="importmap">
{ "imports": { "/www/js/firebase.js": "/test/fake-firebase.js" } }
</script>
`;

const out = html
  .replace("<title>Ludo Circle</title>", "<title>Ludo Circle — test harness</title>")
  .replace('<script type="module" src="js/app.js"></script>', `${importMap}\n  <script type="module" src="js/app.js"></script>`);

writeFileSync(join(www, "_harness.html"), out);
console.log("wrote www/_harness.html");
