import { el, mount } from "../util.js";
import { initError } from "../firebase.js";

export function renderNotConfigured() {
  mount(
    el("div", { class: "card" }, [
      el("h1", { class: "page-title" }, "Firebase is not configured yet"),
      el(
        "p",
        {},
        "This preview build ships with placeholder Firebase credentials in " +
          "js/firebase-config.js. Fill in a real project's config and reload " +
          "to unlock sign-in and live data — see README.md “Getting Started”.",
      ),
      initError ? el("p", { style: "color:#c0392b" }, String(initError.message || initError)) : null,
    ]),
  );
}
