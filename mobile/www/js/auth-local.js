// Local Test Mode "auth" — no real accounts, just a role choice persisted
// in localStorage so a reload keeps you signed in as whatever you picked.
// A judge "signs in" by picking one of the judge records Admin created
// (see js/views/login.js); that judge's own local id becomes the uid
// js/data-local.js's assignJudgeToItems checks against.
const KEY = "madrasaFestLocalSession";
const listeners = new Set();

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

function save(session) {
  if (session) localStorage.setItem(KEY, JSON.stringify(session));
  else localStorage.removeItem(KEY);
  for (const cb of listeners) cb(session);
}

export function watchAuthStateLocal(cb) {
  listeners.add(cb);
  Promise.resolve().then(() => cb(load()));
  return () => listeners.delete(cb);
}

export function currentSessionLocal() {
  return load();
}

export async function continueAsAdminLocal() {
  save({ role: "admin", uid: "local-admin" });
}

export async function continueAsJudgeLocal(judgeId) {
  save({ role: "judge", uid: judgeId });
}

export async function signOutLocal() {
  save(null);
}
