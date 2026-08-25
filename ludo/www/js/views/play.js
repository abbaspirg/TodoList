import { el, toast } from "../util.js";
import { colorForSeat } from "../colors.js";
import { legalMoves, seatProgress, YARD_TRIES } from "../game.js";
import { drawBoard, hitTest, getHitTargets } from "../render.js";
import { animateMove, animateDie, diffBoards, cancelAnimation } from "../animate.js";
import { sounds, isMuted, toggleMuted } from "../sound.js";
import { EMOJI_TRAY, flyEmote } from "../emotes.js";
import { isDark } from "../theme.js";

export const DIE_FACES = ["🎲", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

let tapHandler = null;
// The board as it was last drawn. Comparing the incoming snapshot against
// this is what tells us a token moved and needs walking, rather than
// teleporting into place.
let shownBoard = null;
// Bumped every time a walk starts. A walk that finds the generation has
// moved on was superseded by a newer snapshot and must not paint its own
// (now stale) board over it.
let generation = 0;
let animating = false;
// The most recent context handed to renderGame. A walk finishes some
// hundreds of milliseconds after it started, by which time the room may
// have moved on — repainting from the context the walk captured would put
// stale controls over a fresh board, which deadlocked the game: the die
// showed one turn and the board another, so nobody could act.
let currentContext = null;
// When the board last changed hands. A turn that has not moved on for a
// long time means the player is gone, not thinking — that is when the
// escape hatch appears.
let turnKey = null;
let turnSince = 0;
let idleTimer = null;
const STALL_MS = 25000;

export function resetPlayView() {
  cancelAnimation();
  clearTimeout(idleTimer);
  shownBoard = null;
  animating = false;
  currentContext = null;
  turnKey = null;
  lastAnimatedRoll = null;
  generation++;
}

/** Repaints just the controls from the current room — used when the stall
 * timer fires and the escape hatch needs to appear. */
function refreshChrome() {
  if (!currentContext) return;
  renderChrome(currentContext, {
    mySeat: currentContext.room.seatByUid[currentContext.myUid],
    animating: false,
  });
}

/** Paints the whole game screen from the room document. Called on every
 * snapshot, so it must be idempotent — it redraws rather than diffing the
 * DOM, which at this size is simpler and fast enough. */
export function renderGame(context) {
  currentContext = context;
  const { room, myUid } = context;
  const game = room.game;
  const mySeat = room.seatByUid[myUid];
  const canvas = document.getElementById("board");

  const change = diffBoards(shownBoard, game);
  const previousBoard = shownBoard;
  // Recorded before the walk starts, so a snapshot arriving mid-walk is
  // diffed against where the board is going, not where it came from.
  shownBoard = game;

  renderChrome(context, { mySeat, animating: Boolean(change?.moved) });

  if (change?.moved) {
    // Paint the pre-move board first — the walk starts from there.
    drawFrame(canvas, previousBoard, context, mySeat);
    playMove(canvas, game, change, context, mySeat);
  } else {
    drawFrame(canvas, game, context, mySeat);
  }
}

/** Walks the piece, then plays whatever the move earned. */
async function playMove(canvas, game, change, context, mySeat) {
  const mine = ++generation;
  animating = true;
  const { moved } = change;

  if (change.leftYard) sounds.release();

  await animateMove(canvas, game, {
    seat: moved.seat,
    tokenIndex: moved.tokenIndex,
    fromPos: moved.fromPos,
    toPos: moved.toPos,
    drawOptions: drawOptionsFor(game, context, mySeat),
  });

  // A newer move superseded this one while it was walking. The newer walk
  // owns the screen now; painting this move's board would rewind it.
  if (mine !== generation) return;

  if (change.captured.length) sounds.capture();
  if (change.reachedHome) sounds.home();
  if (game.status === "finished") sounds.win();

  animating = false;
  settle(canvas);
}

/** Repaints board and controls from whatever the room looks like NOW, not
 * from the state the finished walk was animating. */
function settle(canvas) {
  const context = currentContext;
  if (!context) return;
  const seat = context.room.seatByUid[context.myUid];
  shownBoard = context.room.game;
  drawFrame(canvas, context.room.game, context, seat);
  renderChrome(context, { mySeat: seat, animating: false });
}

function drawOptionsFor(game, context, mySeat) {
  const { room, passAndPlay } = context;
  const isMyTurn = game.turn === mySeat && room.status === "playing";
  return {
    isDark: isDark(),
    selectable: isMyTurn && game.dice !== null ? legalMoves(game) : [],
    // No "these are mine" marker on a shared phone — every seat is played
    // from it, so marking one would be misleading.
    mySeat: passAndPlay ? null : mySeat,
  };
}

function drawFrame(canvas, game, context, mySeat) {
  drawBoard(canvas, game, drawOptionsFor(game, context, mySeat));

  // Attached once; re-rendering swaps the handler rather than stacking
  // listeners on the canvas.
  if (!canvas.dataset.bound) {
    canvas.dataset.bound = "1";
    canvas.addEventListener("click", (event) => {
      const rect = canvas.getBoundingClientRect();
      const hit = hitTest(getHitTargets(), event.clientX - rect.left, event.clientY - rect.top);
      if (hit) tapHandler?.(hit);
    });
  }
}

function renderChrome(context, { mySeat, animating: isWalking }) {
  const {
    room,
    myUid,
    presence,
    voice,
    passAndPlay,
    onRoll,
    onMove,
    onPlayAgain,
    onLeave,
    onToggleVoice,
    onThrowEmote,
    onSkipTurn,
  } = context;
  const game = room.game;
  const isMyTurn = game.turn === mySeat && room.status === "playing";
  const canRoll = isMyTurn && game.dice === null && !isWalking;
  const movable = isMyTurn && game.dice !== null ? legalMoves(game) : [];
  const nameFor = (seat) => room.players.find((p) => p.seat === seat)?.name || `Seat ${seat + 1}`;

  // --- Stall detection ------------------------------------------------
  const key = `${game.turn}-${game.dice}-${room.status}-${JSON.stringify(game.tokens)}`;
  if (key !== turnKey) {
    turnKey = key;
    turnSince = Date.now();
  }
  const stalledFor = Date.now() - turnSince;
  const stalled = room.status === "playing" && !isMyTurn && stalledFor >= STALL_MS;
  clearTimeout(idleTimer);
  if (room.status === "playing" && !isMyTurn && !stalled) {
    // Come back and re-check exactly when the wait becomes a stall, so the
    // button appears without anyone having to touch the screen.
    idleTimer = setTimeout(refreshChrome, STALL_MS - stalledFor + 250);
  }

  tapHandler = (hit) => {
    if (isWalking || animating) return;
    if (hit.seat !== mySeat) {
      toast(hit.seat === game.turn ? "That's not your token." : `That token belongs to ${nameFor(hit.seat)}.`);
      return;
    }
    if (!isMyTurn) return toast("Wait for your turn.");
    if (game.dice === null) return toast("Roll the die first.");
    if (!movable.includes(hit.tokenIndex)) return toast("That token can't make this move.");
    onMove(hit.tokenIndex);
  };

  // --- Status --------------------------------------------------------
  const statusHost = document.getElementById("gameStatus");
  const turnColor = colorForSeat(game, game.turn);
  statusHost.replaceChildren(
    ...[
    el("span", { class: "seat-dot", style: `--seat-color:${turnColor.hex}` }, String(game.turn + 1)),
    el(
      "span",
      { class: "who" },
      room.status === "finished"
        ? `🏆 ${nameFor(game.finished[0])} wins!`
        : isMyTurn
          ? game.dice === null
            ? passAndPlay
              ? `${nameFor(game.turn)} — roll!`
              : "Your turn — roll!"
            : movable.length
              ? passAndPlay
                ? `${nameFor(game.turn)}, tap a token`
                : "Tap a token to move"
              : "No move available…"
          : `${nameFor(game.turn)}'s turn`,
    ),
    el(
      "button",
      { class: "icon-btn", title: isMuted() ? "Sound off" : "Sound on", onclick: onToggleSound },
      isMuted() ? "🔈" : "🔊",
    ),
    passAndPlay
      ? null
      : el(
          "button",
          {
            class: `icon-btn${voice?.isActive?.() && !voice.isMuted() ? " on" : ""}`,
            title: voice?.isActive?.() ? (voice.isMuted() ? "Unmute" : "Mute") : "Join voice",
            onclick: onToggleVoice,
          },
          voice?.isActive?.() && voice.isMuted() ? "🔇" : "🎙",
        ),
    ].filter(Boolean),
  );

  // --- Controls ------------------------------------------------------
  const controls = document.getElementById("gameControls");
  const explainDie = () => {
    if (room.status === "finished") return toast("The game is over — tap Play again.");
    if (!isMyTurn) return toast(`Waiting for ${nameFor(game.turn)} to roll.`);
    if (game.dice !== null) {
      return toast(movable.length ? "You've rolled — now tap a token." : "No move available.");
    }
    if (isWalking) return; // a piece is mid-hop; the tap will work in a moment
  };
  const die = el(
    "button",
    {
      id: "die",
      class: `die${canRoll ? " rollable" : " waiting"}`,
      // Deliberately NOT the disabled attribute. A dead button that does
      // nothing when tapped is indistinguishable from a broken one, which
      // is exactly how this was reported. It stays tappable and explains.
      "aria-disabled": canRoll ? undefined : "true",
      title: canRoll ? "Roll the die" : `${nameFor(game.turn)}'s turn`,
      onclick: canRoll ? onRoll : explainDie,
    },
    DIE_FACES[game.dice ?? game.lastRoll ?? 0],
  );

  const mainAction = () => {
    if (room.status === "finished") {
      return el("button", { class: "btn glow", onclick: onPlayAgain }, "Play again");
    }
    if (canRoll) return el("button", { class: "btn glow", onclick: onRoll }, "ROLL");
    if (stalled) {
      // The escape hatch. Without it, one locked phone ends the game for
      // everyone: only the player on turn may act, so if they never do,
      // nobody can.
      return el(
        "button",
        {
          class: "btn danger",
          onclick: () => {
            if (confirm(`${nameFor(game.turn)} hasn't played. Skip their turn?`)) onSkipTurn();
          },
        },
        `Skip ${nameFor(game.turn)}`,
      );
    }
    return el(
      "button",
      { class: "btn secondary", "aria-disabled": "true", onclick: explainDie },
      isMyTurn ? "Move a token" : `Waiting for ${nameFor(game.turn)}…`,
    );
  };

  controls.replaceChildren(
    ...[
      die,
      mainAction(),
      passAndPlay
        ? null
        : el("button", { class: "icon-btn", title: "Throw an emoji", onclick: () => toggleTray(onThrowEmote) }, "😀"),
      el("button", { class: "icon-btn", title: passAndPlay ? "Back to menu" : "Leave game", onclick: onLeave }, "✕"),
    ].filter(Boolean),
  );

  // --- Players -------------------------------------------------------
  const panel = document.getElementById("playersPanel");
  panel.replaceChildren(
    ...[...room.players]
      .sort((a, b) => a.seat - b.seat)
      .map((player) => {
        const color = colorForSeat(game, player.seat);
        const progress = seatProgress(game, player.seat);
        const rank = game.finished.indexOf(player.seat);
        const onVoice = presence.find((p) => p.uid === player.uid)?.voiceOn;
        return el(
          "span",
          {
            class: `player-chip${game.turn === player.seat ? " is-turn" : ""}`,
            style: `--seat-color:${color.hex}`,
          },
          [
            el("span", { class: "pip" }),
            player.name + (!passAndPlay && player.uid === myUid ? " (you)" : ""),
            rank >= 0
              ? el("span", { class: "tag live" }, `${["🥇", "🥈", "🥉"][rank] || "#" + (rank + 1)}`)
              : el("span", { class: "tag" }, `${progress.home}/4`),
            onVoice ? el("span", { title: "on voice" }, "🎙") : null,
          ],
        );
      }),
  );
}

/** The die is animated only when a NEW roll arrives, so a redraw for some
 * other reason doesn't set it tumbling again.
 *
 * Keyed on rollCount, not on the dice value: a roll that leaves no legal
 * move clears `dice` and passes the turn in the same step, so keying on the
 * value meant those rolls — five in six at the start of a game, when every
 * token is still in the yard — never animated and never made a sound. That
 * is what "the die doesn't roll, it just moves to the next player" was.
 * Rolling the same number twice running was invisible for the same reason. */
let lastAnimatedRoll = null;
export function maybeAnimateDie(game) {
  const die = document.getElementById("die");
  if (!die) return;
  const count = game.rollCount ?? 0;

  if (count === 0) {
    // A freshly dealt game. Anchoring at zero means the very first roll of
    // the game still animates.
    lastAnimatedRoll = 0;
    return;
  }
  if (lastAnimatedRoll === null) {
    // Joined or resumed part-way through: adopt the count rather than
    // replaying every roll that already happened.
    lastAnimatedRoll = count;
    return;
  }
  if (count === lastAnimatedRoll) return;
  lastAnimatedRoll = count;

  sounds.diceRoll();
  animateDie(die, game.lastRoll, DIE_FACES);

  // A turn that ended without a move needs saying out loud, or it reads as
  // the app ignoring the tap — which is exactly how it was reported.
  if (!game.rollNote) return;

  // A retry keeps the turn, so the roller is the player still on it.
  const retry = game.rollNote === "retry";
  const roller = retry ? game.turn : previousSeatOf(game);
  const rollerName = nameOfSeat(game, roller);
  const why =
    game.rollNote === "three-sixes"
      ? "three sixes — turn lost!"
      : retry
        ? `roll again for a 6 (${game.yardTries} of ${YARD_TRIES})`
        : allTokensInYard(game, roller)
          ? "needs a 6 to come out"
          : "no move possible";

  // Hold the story on screen until the die has landed and been read.
  // Without this the status line flips to the next player instantly, while
  // the die is still tumbling, so the roll appears to have been ignored.
  const who = document.querySelector("#gameStatus .who");
  if (who) who.textContent = `${rollerName} rolled ${game.lastRoll} — ${why}`;
  setTimeout(() => toast(`Rolled ${game.lastRoll} — ${why}`), 640);
  setTimeout(refreshChrome, 1900);
}

/** Names come from the room, which the engine knows nothing about; fall
 * back to the seat number when this is called without one. */
function nameOfSeat(game, seat) {
  const players = currentContext?.room?.players || [];
  return players.find((p) => p.seat === seat)?.name || `Player ${seat + 1}`;
}

/** Whose roll it was: the turn has already moved on by the time the screen
 * sees a roll that ended without a move. */
function previousSeatOf(game) {
  for (let step = 1; step <= game.seats; step++) {
    const seat = (game.turn - step + game.seats * 2) % game.seats;
    if (!game.finished.includes(seat)) return seat;
  }
  return game.turn;
}

function allTokensInYard(game, seat) {
  return (game.tokens[seat] || []).every((pos) => pos < 0);
}

function onToggleSound() {
  const muted = toggleMuted();
  toast(muted ? "Sound off" : "Sound on");
  if (!muted) sounds.step(0);
  // Repaint the button's icon without a full re-render.
  const button = document.querySelector('#gameStatus .icon-btn[title^="Sound"]');
  if (button) {
    button.textContent = muted ? "🔈" : "🔊";
    button.title = muted ? "Sound off" : "Sound on";
  }
}

function toggleTray(onThrowEmote) {
  const existing = document.querySelector(".emote-tray");
  if (existing) {
    existing.remove();
    return;
  }
  const tray = el(
    "div",
    { class: "emote-tray" },
    EMOJI_TRAY.map((emoji) =>
      el(
        "button",
        {
          class: "emote-pick",
          onclick: () => {
            onThrowEmote(emoji);
            tray.remove();
          },
        },
        emoji,
      ),
    ),
  );
  document.getElementById("gameControls").after(tray);
}

export function showEmote(emoji, fromName) {
  sounds.emote();
  flyEmote(emoji, fromName);
}

export function announceTurnChange(room, myUid, previousTurn, passAndPlay = false) {
  const game = room.game;
  if (!game || game.turn === previousTurn || previousTurn === null) return;
  if (passAndPlay) {
    // Whose go it is now matters more when the phone is being handed over.
    const next = room.players.find((p) => p.seat === game.turn);
    sounds.yourTurn();
    if (next) toast(`${next.name}'s turn`);
    return;
  }
  if (game.turn === room.seatByUid[myUid]) {
    sounds.yourTurn();
    toast("Your turn");
  }
}
