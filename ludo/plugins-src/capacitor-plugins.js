// The one place this app needs a bundler: Capacitor's native plugin
// packages are npm/ESM-only, so their `import ... from '@capacitor/core'`
// can't be resolved by a plain <script type="module"> the way the rest of
// this app's JS is loaded. Compiled by `npm run build:plugins` (esbuild)
// into www/js/vendor/capacitor-plugins.js and loaded by a plain <script>
// tag before app.js runs.
//
// Only @capacitor/app is needed here — it is what routes Android's back
// button and back gesture through JS, so "back" during a game leaves the
// room instead of closing the app.
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

window.CapPlugins = { Capacitor, App };
