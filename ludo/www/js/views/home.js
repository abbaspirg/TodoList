import { el, mountInto, toast } from "../util.js";
import { getSavedName, saveName } from "../auth.js";
import { MAX_SEATS, MIN_SEATS, boardConfig } from "../game.js";
import { describeSavedGame } from "../local-game.js";

const NAMES_KEY = "ludoLocalNames";

function savedLocalNames() {
  try {
    return JSON.parse(localStorage.getItem(NAMES_KEY) || "[]");
  } catch {
    return [];
  }
}

/** Home screen: play on this phone, or play with people on their own
 * phones. Pass-and-play comes first because it needs nothing set up — no
 * project, no internet, no room code. */
export function renderHome({ onCreate, onJoin, onSettings, onStartLocal, onResumeLocal, online }) {
  mountInto(
    "homeHost",
    el("div", {}, [
      el("h1", { class: "page-title" }, "Ludo Circle"),
      resumeCard(onResumeLocal),
      localCard(onStartLocal),
      online.ready ? onlineCards({ onCreate, onJoin }) : offlineNotice(online, onSettings),
      el("div", { class: "btn-row" }, [
        el("button", { class: "btn secondary", onclick: onSettings }, "Settings"),
      ]),
    ]),
  );
}

/** Offered only when there is a game to come back to. */
function resumeCard(onResumeLocal) {
  const saved = describeSavedGame();
  if (!saved) return null;
  return el("div", { class: "card" }, [
    el("h2", { class: "card-title" }, "Carry on where you left off"),
    el(
      "p",
      { class: "subtitle", style: "margin:0 0 10px" },
      saved.finished
        ? `Finished game with ${saved.names.join(", ")}.`
        : `${saved.players}-player game — it's ${saved.turn}'s turn.`,
    ),
    el("button", { class: "btn wide", onclick: onResumeLocal }, "Resume game"),
  ]);
}

function localCard(onStartLocal) {
  const seatSelect = el(
    "select",
    {},
    Array.from({ length: MAX_SEATS - MIN_SEATS + 1 }, (_, i) => {
      const seats = MIN_SEATS + i;
      return el("option", { value: String(seats), selected: seats === 4 || undefined }, `${seats} players`);
    }),
  );

  const nameHost = el("div", {});
  const boardNote = el("p", { class: "subtitle", style: "margin:8px 0 0" }, "");

  const previousNames = savedLocalNames();
  function renderNameFields() {
    const seats = Number(seatSelect.value);
    const existing = [...nameHost.querySelectorAll("input")].map((i) => i.value);
    nameHost.replaceChildren(
      ...Array.from({ length: seats }, (_, seat) =>
        el("input", {
          type: "text",
          placeholder: `Player ${seat + 1}`,
          maxlength: "14",
          value: existing[seat] ?? previousNames[seat] ?? "",
          style: "margin-bottom:6px",
        }),
      ),
    );
    const config = boardConfig(seats);
    boardNote.textContent = config.classic
      ? "The classic cross board."
      : `A ${seats}-sided board — one arm each.`;
  }
  seatSelect.addEventListener("change", renderNameFields);
  renderNameFields();

  const startBtn = el("button", { class: "btn wide glow" }, "Start game");
  startBtn.addEventListener("click", () => {
    const names = [...nameHost.querySelectorAll("input")].map((i) => i.value.trim());
    try {
      localStorage.setItem(NAMES_KEY, JSON.stringify(names));
    } catch {
      // Remembering names is a convenience, not worth failing a game start.
    }
    onStartLocal({ seats: Number(seatSelect.value), names });
  });

  return el("div", { class: "card" }, [
    el("h2", { class: "card-title" }, "🎲 Play on this phone"),
    el(
      "p",
      { class: "subtitle", style: "margin:0 0 10px" },
      "Everyone plays on this one device, taking it in turns. No internet needed.",
    ),
    el("div", { class: "field" }, [el("label", {}, "How many players"), seatSelect, boardNote]),
    el("div", { class: "field" }, [el("label", {}, "Names (optional)"), nameHost]),
    startBtn,
  ]);
}

function onlineCards({ onCreate, onJoin }) {
  const nameInput = el("input", { type: "text", value: getSavedName(), placeholder: "Your name", maxlength: "18" });
  const seatSelect = el(
    "select",
    {},
    Array.from({ length: MAX_SEATS - MIN_SEATS + 1 }, (_, i) => {
      const seats = MIN_SEATS + i;
      return el("option", { value: String(seats), selected: seats === 4 || undefined }, `${seats} players`);
    }),
  );
  const createBtn = el("button", { class: "btn wide" }, "Create room");
  const joinInput = el("input", {
    id: "joinCode",
    type: "text",
    placeholder: "CODE",
    maxlength: "5",
    autocapitalize: "characters",
    autocomplete: "off",
  });
  const joinBtn = el("button", { class: "btn secondary wide" }, "Join room");

  function requireName() {
    const name = nameInput.value.trim();
    if (!name) {
      toast("Enter your name first.");
      nameInput.focus();
      return null;
    }
    saveName(name);
    return name;
  }

  createBtn.addEventListener("click", async () => {
    const name = requireName();
    if (!name) return;
    createBtn.disabled = true;
    createBtn.textContent = "Creating…";
    try {
      await onCreate({ seats: Number(seatSelect.value), name });
    } catch (err) {
      toast(err?.message || "Couldn't create the room.");
    } finally {
      createBtn.disabled = false;
      createBtn.textContent = "Create room";
    }
  });

  joinBtn.addEventListener("click", async () => {
    const name = requireName();
    if (!name) return;
    const code = joinInput.value.trim().toUpperCase();
    if (code.length < 4) {
      toast("Enter the room code your host shared.");
      return;
    }
    joinBtn.disabled = true;
    joinBtn.textContent = "Joining…";
    try {
      await onJoin({ code, name });
    } catch (err) {
      toast(err?.message || "Couldn't join that room.");
    } finally {
      joinBtn.disabled = false;
      joinBtn.textContent = "Join room";
    }
  });

  return el("div", { class: "card" }, [
    el("h2", { class: "card-title" }, "📱 Play on separate phones"),
    el(
      "p",
      { class: "subtitle", style: "margin:0 0 10px" },
      "With voice chat. One person creates a room and shares the code.",
    ),
    el("div", { class: "field" }, [el("label", {}, "Your name"), nameInput]),
    el("div", { class: "field" }, [el("label", {}, "How many players"), seatSelect]),
    createBtn,
    el("div", { style: "height:14px" }),
    el("div", { class: "field" }, [el("label", {}, "…or join with a code"), joinInput]),
    joinBtn,
  ]);
}

/** Playing on separate phones is the only part that needs a Firebase
 * project, so its absence is explained here rather than blocking the whole
 * app behind a setup screen. */
function offlineNotice(online, onSettings) {
  return el("div", { class: "card" }, [
    el("h2", { class: "card-title" }, "📱 Play on separate phones"),
    el(
      "p",
      { class: "subtitle", style: "margin:0 0 10px" },
      online.reason === "error"
        ? "Can't reach the database right now. Playing on this phone still works."
        : "Needs a free Firebase project to sync the game between devices. " +
          "Playing on this phone works without one.",
    ),
    el("button", { class: "btn secondary wide", onclick: onSettings }, "Set it up"),
  ]);
}
