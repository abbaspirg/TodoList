// The one place this app needs a bundler: Capacitor's native plugin
// packages (@capacitor/share, @capacitor/filesystem) are npm/ESM-only —
// their `import ... from '@capacitor/core'` can't be resolved by a plain
// <script type="module"> the way the rest of this app's JS is loaded. This
// file is compiled by `npm run build:plugins` (esbuild, see package.json)
// into www/js/vendor/capacitor-plugins.js, a self-contained IIFE loaded via
// a plain <script> tag in index.html before app.js runs.
//
// Bundling @capacitor/core here is safe and is the standard pattern: its
// registerPlugin() reads and extends the *existing* window.Capacitor object
// (set by Capacitor's native bridge injection before any page script runs)
// rather than replacing it, so plugin calls still route through the real
// native bridge on Android. On a plain web/browser (no native bridge
// injected), Capacitor.isNativePlatform() correctly reports false — see
// js/views/poster.js, which only calls these when it's true.
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";

window.CapPlugins = { Capacitor, Share, Filesystem, Directory };
