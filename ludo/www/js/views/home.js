import { el, mountInto, toast } from "../util.js";
import { getSavedName, saveName } from "../auth.js";
import { MAX_SEATS, MIN_SEATS, boardConfig } from "../game.js";

/** Home screen: your name, then either start a room or join one. */
export function renderHome({ onCreate, onJoin, onSettings }) {
  const nameInput = el("input", { type: "text", value: getSavedName(), placeholder: "Your name", maxlength: "18" });

  const seatSelect = el(
    "select",
    {},
    Array.from({ length: MAX_SEATS - MIN_SEATS + 1 }, (_, i) => {
      const seats = MIN_SEATS + i;
      return el("option", { value: String(seats), selected: seats === 7 || undefined }, `${seats} players`);
    }),
  );
  const seatNote = el("p", { class: "subtitle", style: "margin:6px 0 0" }, "");
  const updateSeatNote = () => {
    const config = boardConfig(Number(seatSelect.value));
    seatNote.textContent =
      `${config.trackLen} squares around the board, starts ${config.seg} apart` +
      (config.seats === 4 ? " — exactly the classic board." : ".");
  };
  seatSelect.addEventListener("change", updateSeatNote);
  updateSeatNote();

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

  mountInto(
    "homeHost",
    el("div", {}, [
      el("h1", { class: "page-title" }, "Ludo Circle"),
      el("div", { class: "card" }, [
        el("div", { class: "field" }, [el("label", {}, "Your name"), nameInput]),
      ]),

      el("div", { class: "card" }, [
        el("h2", { class: "card-title" }, "Start a game"),
        el("div", { class: "field" }, [el("label", {}, "How many players"), seatSelect, seatNote]),
        el("div", { style: "height:10px" }),
        createBtn,
      ]),

      el("div", { class: "card" }, [
        el("h2", { class: "card-title" }, "Join a game"),
        el("div", { class: "field" }, [el("label", {}, "Room code"), joinInput]),
        joinBtn,
      ]),

      el("div", { class: "btn-row" }, [
        el("button", { class: "btn secondary", onclick: onSettings }, "Settings"),
      ]),
      el(
        "p",
        { class: "footer-note" },
        "Everyone taps Join with the same code. Voice chat turns on inside the room.",
      ),
    ]),
  );
}
