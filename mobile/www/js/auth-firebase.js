import { auth, onAuthStateChanged, signInWithEmailAndPassword, fbSignOut } from "./firebase.js";

export function watchAuthState(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function signIn(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  await fbSignOut(auth);
}

// The `role` custom claim is set server-side (Cloud Function) when an
// Admin creates/assigns a user — see docs/ARCHITECTURE.md §4.
export async function currentRole() {
  const user = auth.currentUser;
  if (!user) return null;
  const token = await user.getIdTokenResult(true);
  return token.claims.role ?? null;
}
