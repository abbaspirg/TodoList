// Firebase Auth, with roles held in Firestore rather than in custom auth
// claims.
//
// Custom claims can only be set by the Admin SDK — i.e. from a server —
// and Cloud Functions require Firebase's paid Blaze plan. Roles therefore
// live in a `roles/{uid}` document that nobody can write through the app
// (firestore.rules denies all writes to it); an institution's owner sets
// it once by hand in the Firebase console. Rules read it with get() to
// authorize everything else. See README "Multi-institution setup".
//
// Shape of roles/{uid}:
//   { role: "admin" }
//   { role: "judge", judgeId: "<id of the judges/ document>" }
import { auth, db, doc, getDoc, onAuthStateChanged, signInWithEmailAndPassword, fbSignOut } from "./firebase.js";

// Cached per signed-in uid so every currentRole()/currentUserId() call
// doesn't cost a Firestore read; cleared on any auth state change.
let cachedUid = null;
let cachedRoleDoc = null;

export function watchAuthState(cb) {
  return onAuthStateChanged(auth, (user) => {
    if (user?.uid !== cachedUid) {
      cachedUid = user?.uid ?? null;
      cachedRoleDoc = null;
    }
    cb(user);
  });
}

async function roleDoc() {
  const user = auth.currentUser;
  if (!user) return null;
  if (cachedRoleDoc && cachedUid === user.uid) return cachedRoleDoc;
  const snap = await getDoc(doc(db, "roles", user.uid));
  cachedUid = user.uid;
  cachedRoleDoc = snap.exists() ? snap.data() : {};
  return cachedRoleDoc;
}

export async function signIn(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  cachedUid = null;
  cachedRoleDoc = null;
  await fbSignOut(auth);
}

export async function currentRole() {
  return (await roleDoc())?.role ?? null;
}

/** The id this user acts as when writing data. For a judge that's their
 * `judges/{judgeId}` document id — which is what item assignments and
 * score documents reference — not their Firebase Auth uid, since an admin
 * creates the judge record before that person ever has an account. */
export async function currentActorId() {
  const data = await roleDoc();
  if (!data) return null;
  return data.role === "judge" ? (data.judgeId ?? null) : (auth.currentUser?.uid ?? null);
}
