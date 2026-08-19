// Firebase JS SDK, loaded from the CDN as ES modules — no bundler, same
// approach as the fest app in this repo. Only Auth and Firestore: Cloud
// Functions and Cloud Storage both need the paid Blaze plan, and this game
// needs neither.
//
// Firestore's job here is the room document and the voice handshake. The
// voice audio itself never touches Firebase — it goes directly between the
// players' devices, which is why seven-way voice costs nothing to run.
//
// The imports are dynamic and wrapped in try/catch: a static import of a
// remote URL that fails to load throws before this module's own code runs,
// which would blank the whole app instead of showing a diagnosable error.
import { getFirebaseConfig } from "./app-config.js";

const SDK_VERSION = "10.12.2";
const CDN = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;

export let auth = null;
export let db = null;
export let initError = null;

export let onAuthStateChanged;
export let signInAnonymously;
export let fbSignOut;

export let collection;
export let doc;
export let addDoc;
export let getDoc;
export let getDocs;
export let setDoc;
export let updateDoc;
export let deleteDoc;
export let onSnapshot;
export let query;
export let where;
export let orderBy;
export let limit;
export let serverTimestamp;
export let runTransaction;

export function needsSetup() {
  return getFirebaseConfig() === null;
}

export function hasFirebaseError() {
  return !needsSetup() && initError !== null;
}

async function init() {
  if (needsSetup()) return;
  try {
    const [{ initializeApp }, authMod, firestoreMod] = await Promise.all([
      import(`${CDN}/firebase-app.js`),
      import(`${CDN}/firebase-auth.js`),
      import(`${CDN}/firebase-firestore.js`),
    ]);

    const app = initializeApp(getFirebaseConfig());
    auth = authMod.getAuth(app);
    db = firestoreMod.getFirestore(app);

    ({ onAuthStateChanged, signInAnonymously, signOut: fbSignOut } = authMod);
    ({
      collection,
      doc,
      addDoc,
      getDoc,
      getDocs,
      setDoc,
      updateDoc,
      deleteDoc,
      onSnapshot,
      query,
      where,
      orderBy,
      limit,
      serverTimestamp,
      runTransaction,
    } = firestoreMod);
  } catch (err) {
    initError = err;
  }
}

const ready = init();

export function whenFirebaseReady() {
  return ready;
}
