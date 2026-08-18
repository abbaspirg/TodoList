// Firebase JS SDK, loaded straight from the CDN as ES modules — no bundler,
// same "no build step" approach as the rest of this app. Works fine inside
// a Capacitor WebView as long as the device has internet access. Bump the
// version below to track newer Firebase releases if needed.
//
// The CDN imports are dynamic (not static `import ... from` statements) and
// wrapped in try/catch: a static import of a remote URL that fails to load
// (offline first launch, an ad-blocker, a misconfigured proxy) would throw
// before this module's own code runs, breaking the whole app with a blank
// screen and no error. Dynamic import lets us catch that and fall back to
// the "not configured" screen instead — the JS equivalent of the try/catch
// around Firebase.initializeApp() in the earlier Flutter build.
import { firebaseConfig } from "./firebase-config.js";

const SDK_VERSION = "10.12.2";
const CDN = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

export let auth = null;
export let db = null;
export let storage = null;
export let initError = null;

export let onAuthStateChanged;
export let signInWithEmailAndPassword;
export let signInAnonymously;
export let fbSignOut;
export let collection;
export let doc;
export let setDoc;
export let updateDoc;
export let deleteDoc;
export let onSnapshot;
export let query;
export let where;
export let orderBy;
export let serverTimestamp;
export let storageRef;
export let uploadBytes;
export let getDownloadURL;

async function init() {
  if (firebaseConfig.apiKey === "TODO") {
    initError = new Error("firebase-config.js still has placeholder values.");
    return;
  }
  try {
    const [{ initializeApp }, authMod, firestoreMod, storageMod] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore.js`),
      import(`${CDN}/firebase-storage.js`),
    ]);

    const app = initializeApp(firebaseConfig);
    auth = authMod.getAuth(app);
    db = firestoreMod.getFirestore(app);
    storage = storageMod.getStorage(app);

    ({ onAuthStateChanged, signInWithEmailAndPassword, signInAnonymously, signOut: fbSignOut } = authMod);
    ({ collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, serverTimestamp } =
      firestoreMod);
    ({ ref: storageRef, uploadBytes, getDownloadURL } = storageMod);
  } catch (err) {
    initError = err;
  }
}

const ready = init();

export function isFirebaseReady() {
  return auth !== null;
}

// Views/data.js await this before touching any Firestore call, so nothing
// races the async CDN load above.
export function whenFirebaseReady() {
  return ready;
}

export { CDN as FIREBASE_SDK_CDN };
