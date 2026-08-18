import { el, mount } from "../util.js";
import { initError } from "../firebase.js";

// Shown only for a *real* Firebase misconfiguration (a project was
// configured but failed to initialize) — Local Test Mode's placeholder
// config doesn't hit this at all, it runs against js/data-local.js
// instead. See js/firebase.js hasFirebaseError().
export function renderNotConfigured() {
  mount(
    el("div", { class: "card" }, [
      el("h1", { class: "page-title" }, "Couldn't connect to Firebase"),
      el(
        "p",
        {},
        "js/firebase-config.js has a project configured, but initializing it " +
          "failed — check the project ID/API key and that the device has " +
          "internet access. To fall back to Local Test Mode instead, reset " +
          "apiKey to \"TODO\" in that file.",
      ),
      initError ? el("p", { style: "color:var(--danger)" }, String(initError.message || initError)) : null,
    ]),
  );
}
