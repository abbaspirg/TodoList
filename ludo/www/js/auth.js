// Sign-in for a game, which means: as little of it as possible.
//
// Anonymous auth gives each device a stable Firebase uid with no email, no
// password and no sign-up screen — you type a display name and you are in.
// Firebase keeps that uid across app restarts, so rejoining a room in
// progress after closing the app puts you back in your own seat.
//
// The trade-off, stated plainly: the identity belongs to the device, not to
// the person. Clear the app's data or switch phones and you are a new
// player. For a game played with people you know, that is the right
// trade; the seat is claimed by whoever holds the room code anyway.
//
// Enable it once per project: Firebase console -> Authentication ->
// Sign-in method -> Anonymous -> Enable.
import { auth, onAuthStateChanged, signInAnonymously, fbSignOut } from "./firebase.js";

const NAME_KEY = "ludoPlayerName";

export function getSavedName() {
  return localStorage.getItem(NAME_KEY) || "";
}

export function saveName(name) {
  localStorage.setItem(NAME_KEY, name.trim());
}

export function watchAuthState(cb) {
  return onAuthStateChanged(auth, cb);
}

export function currentUid() {
  return auth?.currentUser?.uid || null;
}

/** Signs in anonymously if this device has no session yet. */
export async function ensureSignedIn() {
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export function signOut() {
  return fbSignOut(auth);
}

export function friendlyAuthError(err) {
  const code = err?.code || "";
  if (code.includes("operation-not-allowed")) {
    return "Turn on Anonymous sign-in in the Firebase console (Authentication → Sign-in method).";
  }
  if (code.includes("network")) return "No internet connection.";
  return err?.message || "Couldn't sign in — please try again.";
}
