import { el, mountInto, toast } from "../util.js";
import { seatColor } from "../colors.js";
import { MIN_SEATS } from "../game.js";

/** The waiting room: the code to share, who has arrived, and (for the host)
 * the button that deals the board. */
export function renderLobby({ room, myUid, presence, voice, onStart, onLeave, onToggleVoice }) {
  const isHost = room.hostUid === myUid;
  const players = [...room.players].sort((a, b) => a.seat - b.seat);
  const canStart = players.length >= MIN_SEATS;

  const shareBtn = el("button", { class: "btn secondary" }, "Share code");
  shareBtn.addEventListener("click", async () => {
    const text = `Join my Ludo game — room code ${room.code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(room.code);
        toast("Room code copied");
      }
    } catch {
      // A cancelled share sheet is not an error worth reporting.
    }
  });

  const startBtn = el(
    "button",
    { class: "btn wide", disabled: !canStart || undefined, onclick: onStart },
    canStart ? `Start game with ${players.length} players` : "Waiting for one more player…",
  );

  mountInto(
    "lobbyHost",
    el("div", {}, [
      el("h1", { class: "page-title" }, "Waiting room"),

      el("div", { class: "card" }, [
        el("p", { class: "subtitle", style: "margin:0 0 8px" }, "Share this code — everyone types it on their own phone."),
        el("div", { class: "room-code" }, room.code),
        el("div", { style: "height:12px" }),
        el("div", { class: "btn-row" }, [shareBtn, voiceButton(voice, onToggleVoice)]),
      ]),

      el("div", { class: "card" }, [
        el("h2", { class: "card-title" }, `Players (${players.length} of ${room.seats})`),
        el(
          "ul",
          { class: "seat-list" },
          players.map((player) => {
            const color = seatColor(player.seat);
            const here = presence.find((p) => p.uid === player.uid);
            return el("li", { class: "seat-row", style: `--seat-color:${color.hex}` }, [
              el("span", { class: "seat-dot" }, String(player.seat + 1)),
              el("span", { class: "name" }, player.name + (player.uid === myUid ? " (you)" : "")),
              player.uid === room.hostUid ? el("span", { class: "tag" }, "host") : null,
              here?.voiceOn ? el("span", { class: "tag live" }, "🎙 voice") : null,
            ]);
          }),
        ),
      ]),

      isHost
        ? el("div", { class: "card" }, [startBtn])
        : el("div", { class: "card empty-state" }, "Waiting for the host to start the game…"),

      el("div", { class: "btn-row" }, [
        el("button", { class: "btn danger", onclick: onLeave }, "Leave room"),
      ]),
    ]),
  );
}

export function voiceButton(voice, onToggle) {
  const on = voice?.isActive?.() === true;
  return el(
    "button",
    { class: on ? "btn" : "btn secondary", onclick: onToggle },
    on ? "🎙 Voice on" : "🎙 Join voice",
  );
}
