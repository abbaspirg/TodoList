import { el, mountInto, toast } from "../util.js";
import { getSavedTurn, saveTurn, clearTurn } from "../ice.js";
import { clearFirebaseConfig, isBakedIn } from "../app-config.js";

const DIE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

export function renderSettings({ onBack }) {
  const turn = getSavedTurn();
  const urlsInput = el("input", { type: "text", placeholder: "turn:turn.example.com:3478", value: turn?.urls || "" });
  const userInput = el("input", { type: "text", placeholder: "username", value: turn?.username || "" });
  const passInput = el("input", { type: "text", placeholder: "password", value: turn?.credential || "" });

  mountInto(
    "settingsHost",
    el("div", {}, [
      el("h1", { class: "page-title" }, "Settings"),

      el("div", { class: "card" }, [
        el("h2", { class: "card-title" }, "Voice relay (TURN)"),
        el(
          "p",
          { class: "subtitle", style: "margin:0 0 10px" },
          "Voice goes directly between phones, which works for most connections. Some networks — " +
            "strict mobile carriers especially — won't allow that, and those calls need a relay in " +
            "the middle. Without one, most people still hear each other and a few pairs won't. " +
            "Add your own relay here; it stays on this device only.",
        ),
        el("div", { class: "field" }, [el("label", {}, "Server URL"), urlsInput]),
        el("div", { class: "field" }, [el("label", {}, "Username"), userInput]),
        el("div", { class: "field" }, [el("label", {}, "Password"), passInput]),
        el("div", { class: "btn-row" }, [
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                try {
                  saveTurn({ urls: urlsInput.value, username: userInput.value, credential: passInput.value });
                  toast("Relay saved — it applies to the next call you join");
                } catch (err) {
                  toast(err.message);
                }
              },
            },
            "Save relay",
          ),
          turn
            ? el(
                "button",
                {
                  class: "btn secondary",
                  onclick: () => {
                    clearTurn();
                    urlsInput.value = userInput.value = passInput.value = "";
                    toast("Relay removed");
                  },
                },
                "Remove",
              )
            : null,
        ]),
      ]),

      el("div", { class: "card" }, [
        el("h2", { class: "card-title" }, "House rules"),
        el(
          "ul",
          { class: "subtitle", style: "margin:0;padding-left:18px;line-height:1.7" },
          [
            `Roll a ${DIE_FACES[6]} six to bring a token out of your yard.`,
            "A six, a capture, or getting a token home all earn another roll.",
            "Three sixes in a row and you lose the turn.",
            "Land on an opponent and they go back to their yard — unless they are on a ★ square or their own start.",
            "The centre needs an exact roll; overshooting is not a legal move.",
            "Players who get all four tokens home are ranked in the order they finish.",
          ].map((text) => el("li", {}, text)),
        ),
      ]),

      !isBakedIn()
        ? el("div", { class: "card" }, [
            el("h2", { class: "card-title" }, "Firebase project"),
            el(
              "p",
              { class: "subtitle", style: "margin:0 0 10px" },
              "Clears the project this device is pointed at and returns to the setup screen.",
            ),
            el(
              "button",
              {
                class: "btn danger",
                onclick: () => {
                  if (!confirm("Forget this Firebase project on this device?")) return;
                  clearFirebaseConfig();
                  location.reload();
                },
              },
              "Forget project",
            ),
          ])
        : null,

      el("div", { class: "btn-row" }, [
        el("button", { class: "btn secondary", onclick: onBack }, "Back"),
      ]),
    ]),
  );
}
