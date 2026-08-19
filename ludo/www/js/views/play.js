import { el, toast } from "../util.js";
import { seatColor } from "../colors.js";
import { legalMoves, seatProgress } from "../game.js";
import { drawBoard, hitTest, getHitTargets } from "../render.js";
import { isDark } from "../theme.js";

const DIE_FACES = ["🎲", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

let lastDie = null;
let tapHandler = null;

/** Paints the whole game screen from the room document. Called on every
 * snapshot, so it must be cheap and idempotent — it redraws rather than
 * diffing, which at this size is far simpler and fast enough. */
export function renderGame({ room, myUid, presence, voice, onRoll, onMove, onPlayAgain, onLeave, onToggleVoice }) {
  const game = room.game;
  const mySeat = room.seatByUid[myUid];
  const isMyTurn = game.turn === mySeat && room.status === "playing";
  const canRoll = isMyTurn && game.dice === null;
  const movable = isMyTurn && game.dice !== null ? legalMoves(game) : [];

  const nameFor = (seat) => room.players.find((p) => p.seat === seat)?.name || `Seat ${seat + 1}`;

  // --- Status line ---------------------------------------------------
  const statusHost = document.getElementById("gameStatus");
  const turnColor = seatColor(game.turn);
  statusHost.replaceChildren(
    el("span", { class: "seat-dot", style: `--seat-color:${turnColor.hex}` }, String(game.turn + 1)),
    el(
      "span",
      { class: "who" },
      room.status === "finished"
        ? "Game over"
        : isMyTurn
          ? game.dice === null
            ? "Your turn — tap the die"
            : movable.length
              ? "Tap a token to move"
              : "No move available…"
          : `${nameFor(game.turn)}'s turn`,
    ),
    voice?.isActive?.()
      ? el(
          "button",
          { class: "icon-btn", title: voice.isMuted() ? "Unmute" : "Mute", onclick: onToggleVoice },
          voice.isMuted() ? "🔇" : "🎙",
        )
      : el("button", { class: "icon-btn", title: "Join voice", onclick: onToggleVoice }, "🎙"),
  );

  // --- Board ---------------------------------------------------------
  const canvas = document.getElementById("board");
  drawBoard(canvas, game, { isDark: isDark(), selectable: movable, mySeat });

  // The click listener is attached once and reads the handler through a
  // module-level slot, so re-rendering doesn't stack up listeners.
  tapHandler = (hit) => {
    if (hit.seat !== mySeat) {
      toast(hit.seat === game.turn ? "That's not your token." : `That token belongs to ${nameFor(hit.seat)}.`);
      return;
    }
    if (!isMyTurn) return toast("Wait for your turn.");
    if (game.dice === null) return toast("Roll the die first.");
    if (!movable.includes(hit.tokenIndex)) return toast("That token can't make this move.");
    onMove(hit.tokenIndex);
  };

  if (!canvas.dataset.bound) {
    canvas.dataset.bound = "1";
    canvas.addEventListener("click", (event) => {
      const rect = canvas.getBoundingClientRect();
      // Read the targets at tap time, not render time — a deferred repaint
      // may have replaced them since.
      const hit = hitTest(getHitTargets(), event.clientX - rect.left, event.clientY - rect.top);
      if (hit) tapHandler?.(hit);
    });
  }

  // --- Controls ------------------------------------------------------
  const controls = document.getElementById("gameControls");
  const die = el(
    "button",
    {
      class: `die${canRoll ? " rollable" : ""}${game.dice !== null && game.dice !== lastDie ? " rolling" : ""}`,
      disabled: !canRoll || undefined,
      title: canRoll ? "Roll" : "Not your turn",
      onclick: onRoll,
    },
    // Always a die face: a placeholder dot while waiting for someone else
    // read as a broken glyph rather than as "no roll yet".
    DIE_FACES[game.dice ?? 0],
  );
  lastDie = game.dice;

  controls.replaceChildren(
    die,
    room.status === "finished"
      ? el("button", { class: "btn", onclick: onPlayAgain }, "Play again")
      : el(
          "button",
          { class: "btn secondary", disabled: !canRoll || undefined, onclick: onRoll },
          canRoll ? "Roll the die" : isMyTurn ? "Move a token" : "Waiting…",
        ),
    el("button", { class: "icon-btn", title: "Leave game", onclick: onLeave }, "✕"),
  );

  // --- Players -------------------------------------------------------
  const panel = document.getElementById("playersPanel");
  panel.replaceChildren(
    ...[...room.players]
      .sort((a, b) => a.seat - b.seat)
      .map((player) => {
        const color = seatColor(player.seat);
        const progress = seatProgress(game, player.seat);
        const rank = game.finished.indexOf(player.seat);
        const speaking = presence.find((p) => p.uid === player.uid)?.voiceOn;
        return el(
          "span",
          {
            class: `player-chip${game.turn === player.seat ? " is-turn" : ""}`,
            style: `--seat-color:${color.hex}`,
          },
          [
            el("span", { class: "pip" }),
            player.name + (player.uid === myUid ? " (you)" : ""),
            rank >= 0
              ? el("span", { class: "tag live" }, `#${rank + 1}`)
              : el("span", { class: "tag" }, `${progress.home}/4 home`),
            speaking ? el("span", { title: "on voice" }, "🎙") : null,
          ],
        );
      }),
  );

  // --- Move history --------------------------------------------------
  const log = document.getElementById("moveLog");
  log.replaceChildren(
    ...[...game.log].reverse().map((entry) => el("li", {}, humanise(entry.message, nameFor))),
  );

  if (room.status === "finished") {
    const podium = game.finished.map((seat, i) => `${i + 1}. ${nameFor(seat)}`).join("   ");
    statusHost.append(el("span", { class: "tag live" }, podium));
  }
}

/** The engine logs in terms of seat numbers, since it knows nothing about
 * players; the screen shows names. */
function humanise(message, nameFor) {
  return message.replace(/[Ss]eat (\d+)/g, (_, n) => nameFor(Number(n)));
}

export function announceTurnChange(room, myUid, previousTurn) {
  const game = room.game;
  if (!game || game.turn === previousTurn) return;
  if (game.turn === room.seatByUid[myUid]) toast("Your turn");
}
