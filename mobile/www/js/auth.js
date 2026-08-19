// Dispatches to js/auth-firebase.js or js/auth-local.js depending on
// js/firebase.js isLocalMode() — mirrors the js/data.js dispatch. Views
// only ever import this file.
import { isLocalMode } from "./firebase.js";
import * as fb from "./auth-firebase.js";
import {
  watchAuthStateLocal,
  currentSessionLocal,
  continueAsAdminLocal,
  continueAsJudgeLocal,
  signOutLocal,
} from "./auth-local.js";

// Resolved once per sign-in, before any route renders (see watchAuthState
// below), so views can read it synchronously mid-render the way they do in
// Local Test Mode. In Firestore mode the underlying lookup is a Firestore
// read, which is why it can't be done on demand from a render path.
let actorId = null;

export function watchAuthState(cb) {
  if (isLocalMode()) {
    return watchAuthStateLocal((session) => {
      actorId = session?.uid ?? null;
      cb(session);
    });
  }
  return fb.watchAuthState(async (user) => {
    actorId = user ? await fb.currentActorId() : null;
    cb(user);
  });
}

export async function currentRole() {
  return isLocalMode() ? (currentSessionLocal()?.role ?? null) : fb.currentRole();
}

export function currentUserId() {
  return actorId;
}

export async function signIn(email, password) {
  return fb.signIn(email, password);
}

export async function signOut() {
  actorId = null;
  return isLocalMode() ? signOutLocal() : fb.signOut();
}

export const continueAsAdmin = continueAsAdminLocal;
export const continueAsJudge = continueAsJudgeLocal;
