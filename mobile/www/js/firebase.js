// Firebase JS SDK, loaded straight from the CDN as ES modules — no bundler,
// same "no build step" approach as the rest of this app. Works fine inside
// a Capacitor WebView as long as the device has internet access. Bump the
// version below to track newer Firebase releases if needed.
//
// The CDN imports are dynamic (not static `import ... from` statements) and
// wrapped in try/catch: a static import of a remote URL that fails to load
// would throw before this module's own code runs, breaking the whole app
// with a blank screen. Dynamic import lets us catch that.
//
// Only Auth and Firestore are loaded. Cloud Storage and Cloud Functions
// both require Firebase's paid Blaze plan, so this app deliberately uses
// neither: student photos are stored inline on their document (they're a
// few KB after js/util.js resizeImageFile), and result computation runs on
// the client via js/scoring.js. That keeps an institution's project
// entirely within the no-cost Spark plan — see README.
//
// Three distinct states are tracked separately:
//  - needsSetup(): no project configured and none baked into the build —
//    the app shows views/setup.js so an admin can paste one.
//  - isLocalMode(): running against localStorage instead of Firestore
//    (js/data-local.js / js/auth-local.js). Intentional, not an error.
//  - hasFirebaseError(): a real config was provided but initializing it
//    failed (bad project, offline, CDN blocked) — this *is* an error, shown
//    via views/not-configured.js rather than silently falling back to local
//    mode, so a real misconfiguration doesn't masquerade as "it's working."
import { getFirebaseConfig } from "./app-config.js";

const SDK_VERSION = "10.12.2";
const CDN = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

const LOCAL_MODE_KEY = "madrasaFestLocalMode";

export let auth = null;
export let db = null;
export let initError = null;

export let onAuthStateChanged;
export let signInWithEmailAndPassword;
export let signInAnonymously;
export let fbSignOut;
export let collection;
export let doc;
export let getDoc;
export let getDocs;
export let setDoc;
export let updateDoc;
export let deleteDoc;
export let onSnapshot;
export let query;
export let where;
export let orderBy;
export let serverTimestamp;
export let writeBatch;

/** Local Test Mode is an explicit choice (the setup screen's "Try it
 * without a project" button), not merely the absence of a config — so a
 * device that failed to receive its config doesn't silently start writing
 * to localStorage as if all were well. */
export function isLocalMode() {
  return localStorage.getItem(LOCAL_MODE_KEY) === "true";
}

export function enableLocalMode() {
  localStorage.setItem(LOCAL_MODE_KEY, "true");
}

export function disableLocalMode() {
  localStorage.removeItem(LOCAL_MODE_KEY);
}

export function needsSetup() {
  return !isLocalMode() && getFirebaseConfig() === null;
}

export function hasFirebaseError() {
  return !isLocalMode() && !needsSetup() && initError !== null;
}

export function isFirebaseReady() {
  return auth !== null;
}

async function init() {
  if (isLocalMode() || needsSetup()) return; // both intentional — see doc above
  try {
    const [{ initializeApp }, authMod, firestoreMod] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore.js`),
    ]);

    const app = initializeApp(getFirebaseConfig());
    auth = authMod.getAuth(app);
    db = firestoreMod.getFirestore(app);

    ({ onAuthStateChanged, signInWithEmailAndPassword, signInAnonymously, signOut: fbSignOut } = authMod);
    ({
      collection,
      doc,
      getDoc,
      getDocs,
      setDoc,
      updateDoc,
      deleteDoc,
      onSnapshot,
      query,
      where,
      orderBy,
      serverTimestamp,
      writeBatch,
    } = firestoreMod);
  } catch (err) {
    initError = err;
  }
}

const ready = init();

// Views/data.js await this before touching any Firestore call, so nothing
// races the async CDN load above.
export function whenFirebaseReady() {
  return ready;
}

export { CDN as FIREBASE_SDK_CDN };
