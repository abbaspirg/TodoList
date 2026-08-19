// Per-institution build configuration.
//
// Empty in the generic build: the app then falls back to an admin pasting
// their Firebase config into the setup screen, or to Local Test Mode. See
// js/app-config.js for the full resolution order.
//
// For a per-institution build, CI overwrites this file with that
// institution's Firebase web config plus their name — so their staff and
// students install the app and it works immediately, with no setup step
// at all. See .github/workflows/android-build.yml (customer_config input)
// and README "Multi-institution setup".
//
// These values are not secrets: a Firebase web config ships in the source
// of every Firebase web app, and access is controlled by firestore.rules
// and Firebase Auth, not by keeping them hidden.
export const BUILD_CONFIG = {
  // institutionName: "Al Noor Islamic Academy",
  // apiKey: "...",
  // authDomain: "....firebaseapp.com",
  // projectId: "...",
  // storageBucket: "....appspot.com",
  // messagingSenderId: "...",
  // appId: "...",
};
