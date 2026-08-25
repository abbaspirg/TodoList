import { el, mountInto, toast } from "../util.js";
import { parseConfigInput, saveFirebaseConfig } from "../app-config.js";

/** First-run screen: point the app at a Firebase project. Same pasted-config
 * flow as the fest app, and for the same reason — a Firebase *web* config is
 * not a secret, so it can safely be pasted, shared or baked into a build. */
export function renderSetup() {
  const input = el("textarea", {
    rows: "10",
    placeholder: 'Paste the whole firebaseConfig = { ... } block from the Firebase console',
    style: "width:100%;font-family:ui-monospace,Menlo,monospace;font-size:0.82rem;padding:11px;border-radius:10px;border:1px solid var(--border);background:var(--bg);color:var(--text)",
  });
  const saveBtn = el("button", { class: "btn wide" }, "Use this project");

  saveBtn.addEventListener("click", () => {
    try {
      saveFirebaseConfig(parseConfigInput(input.value));
      location.reload(); // simplest way to re-initialise the SDK cleanly
    } catch (err) {
      toast(err.message);
    }
  });

  mountInto(
    "setupHost",
    el("div", {}, [
      el("h1", { class: "page-title" }, "Set up"),
      el("div", { class: "card" }, [
        el(
          "p",
          { class: "subtitle", style: "margin-top:0" },
          "This game keeps rooms in sync through your own free Firebase project. " +
            "Create one at console.firebase.google.com, add a Web app, then paste its config here.",
        ),
        el("div", { class: "notice" }, [
          el("strong", {}, "Two switches to flip in the console: "),
          "Authentication → Sign-in method → enable Anonymous, and Firestore Database → Create database. " +
            "Then publish the rules from ludo/firestore.rules.",
        ]),
        input,
        el("div", { style: "height:12px" }),
        saveBtn,
      ]),
    ]),
  );
}
