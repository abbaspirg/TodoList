import { el, mount } from "../util.js";
import { initError } from "../firebase.js";
import { clearFirebaseConfig, isBakedIn } from "../app-config.js";

// Shown only for a *real* Firebase failure: a project is configured but
// initializing it failed (wrong project, no internet, CDN blocked). Having
// no project at all is a different state and shows views/setup.js instead
// — see js/firebase.js needsSetup() vs hasFirebaseError().
export function renderNotConfigured() {
  mount(
    el("div", { class: "card" }, [
      el("h1", { class: "page-title" }, "Couldn't connect"),
      el(
        "p",
        {},
        "The app has a Firebase project configured, but couldn't reach it. " +
          "Check that this device has internet access, then try again.",
      ),
      initError ? el("p", { style: "color:var(--danger)" }, String(initError.message || initError)) : null,
      // A baked-in build has one fixed project, so there's nothing for the
      // user to re-enter — only a pasted config can be cleared and redone.
      !isBakedIn()
        ? el("div", { class: "btn-row" }, [
            el(
              "button",
              {
                class: "btn secondary",
                onclick: () => {
                  clearFirebaseConfig();
                  location.reload();
                },
              },
              "Re-enter configuration",
            ),
          ])
        : null,
    ]),
  );
}
