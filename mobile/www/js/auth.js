// Dispatches to js/auth-firebase.js or js/auth-local.js depending on
// js/firebase.js isLocalMode() — mirrors the js/data.js dispatch. Views
// only ever import this file.
import { isLocalMode, auth as firebaseAuth } from "./firebase.js";
import * as fb from "./auth-firebase.js";
import {
  watchAuthStateLocal,
  currentSessionLocal,
  continueAsAdminLocal,
  continueAsJudgeLocal,
  signOutLocal,
} from "./auth-local.js";

export function watchAuthState(cb) {
  return isLocalMode() ? watchAuthStateLocal(cb) : fb.watchAuthState(cb);
}

export async function currentRole() {
  return isLocalMode() ? (currentSessionLocal()?.role ?? null) : fb.currentRole();
}

export function currentUserId() {
  return isLocalMode() ? (currentSessionLocal()?.uid ?? null) : (firebaseAuth?.currentUser?.uid ?? null);
}

export async function signIn(email, password) {
  return fb.signIn(email, password);
}

export async function signOut() {
  return isLocalMode() ? signOutLocal() : fb.signOut();
}

export const continueAsAdmin = continueAsAdminLocal;
export const continueAsJudge = continueAsJudgeLocal;
