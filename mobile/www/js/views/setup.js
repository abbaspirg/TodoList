import { el, mount, toast } from "../util.js";
import { parseConfigInput, saveFirebaseConfig } from "../app-config.js";
import { enableLocalMode } from "../firebase.js";

// Shown when the app has no Firebase project configured and none baked
// into the build — see js/app-config.js for the resolution order.
//
// An institution's admin pastes their project's config here once per
// device. The values are not secret (a Firebase web config ships in the
// source of every Firebase web app; access is controlled by
// firestore.rules), so it's safe for the admin to forward the same text to
// their judges and to anyone who wants live results on their own phone.
export async function renderSetup() {
  const input = el("textarea", {
    rows: "9",
    placeholder: '{\n  "apiKey": "...",\n  "authDomain": "....firebaseapp.com",\n  "projectId": "...",\n  "appId": "..."\n}',
    style: "width:100%;font-family:monospace;font-size:0.8rem",
  });
  const connectBtn = el("button", { class: "btn" }, "Connect");

  connectBtn.addEventListener("click", () => {
    let config;
    try {
      config = parseConfigInput(input.value);
    } catch (err) {
      toast(err.message);
      return;
    }
    saveFirebaseConfig(config);
    // A full reload is the simplest correct way to apply it: js/firebase.js
    // initializes the SDK once at module load, so the app has to start
    // over against the new project rather than patch itself live.
    location.reload();
  });

  mount(
    el("div", { style: "max-width:460px;margin:24px auto" }, [
      el("div", { class: "card" }, [
        el("h1", { class: "page-title", style: "text-align:center" }, "🕌 Set up your fest"),
        el(
          "p",
          { class: "subtitle" },
          "Paste your institution's Firebase configuration below. Your admin can send you this — " +
            "it's the same text on every device, and it isn't a password.",
        ),
        el("div", { class: "field", style: "margin-top:12px" }, [
          el("label", {}, "Firebase config"),
          input,
        ]),
        el("div", { class: "btn-row" }, [connectBtn]),
      ]),

      el("div", { class: "card" }, [
        el("h2", { style: "margin-top:0;font-size:1rem" }, "Just want to look around?"),
        el(
          "p",
          { class: "subtitle", style: "margin-bottom:12px" },
          "Local Test Mode runs the whole app on this device with no account and no project. " +
            "Nothing syncs to other phones — good for trying it out or demoing.",
        ),
        el(
          "button",
          {
            class: "btn secondary",
            onclick: () => {
              enableLocalMode();
              location.reload();
            },
          },
          "Try it without a project",
        ),
      ]),

      el(
        "details",
        { class: "card" },
        [
          el("summary", {}, "Where do I find this?"),
          el(
            "ol",
            { class: "subtitle", style: "padding-left:20px;line-height:1.7" },
            [
              el("li", {}, "Open console.firebase.google.com and pick your project."),
              el("li", {}, "Project settings (gear icon) → General → Your apps → Web app."),
              el("li", {}, "Under “SDK setup and configuration”, choose Config."),
              el("li", {}, "Copy the whole { ... } block and paste it above."),
            ],
          ),
        ],
      ),
    ]),
  );
}
