// Pass-and-play: everyone on one phone, taking turns on the same screen.
//
// No Firebase, no room code, no network — so this works on a fresh install
// with nothing set up, and keeps working on a plane or with the wifi off.
//
// It deliberately presents the SAME shape as a Firestore room document
// (code, players, seatByUid, game) and the same watch/act functions, so the
// board, the renderer and the whole game screen are the online ones,
// unmodified. The only thing that changes is where the state lives.
import { createGame, applyRoll, applyMove, passTurn, rollDice, MIN_SEATS, MAX_SEATS } from "./game.js";

const STORAGE_KEY = "ludoLocalGame";

let room = null;
const listeners = new Set();

function persist() {
  try {
    if (room) localStorage.setItem(STORAGE_KEY, JSON.stringify(room));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // A full localStorage shouldn't end the game in progress; it just
    // won't survive closing the app.
  }
}

function emit() {
  for (const cb of listeners) cb(room);
}

function update(next) {
  room = next;
  persist();
  emit();
}

/** A game left unfinished on this device, if there is one. */
export function savedLocalGame() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : null;
    return saved?.game ? saved : null;
  } catch {
    return null;
  }
}

export function describeSavedGame() {
  const saved = savedLocalGame();
  if (!saved) return null;
  const done = saved.game.finished.length;
  return {
    players: saved.players.length,
    names: saved.players.map((p) => p.name),
    finished: saved.status === "finished",
    turn: saved.players.find((p) => p.seat === saved.game.turn)?.name || "",
    done,
  };
}

export function startLocalGame(seats, names = []) {
  if (seats < MIN_SEATS || seats > MAX_SEATS) {
    throw new Error(`Pick between ${MIN_SEATS} and ${MAX_SEATS} players.`);
  }
  const players = Array.from({ length: seats }, (_, seat) => ({
    // Prefixed so a local seat id can never be mistaken for a Firebase uid.
    uid: `local-${seat}`,
    name: (names[seat] || "").trim() || `Player ${seat + 1}`,
    seat,
  }));

  update({
    code: "LOCAL",
    local: true,
    hostUid: players[0].uid,
    status: "playing",
    seats,
    players,
    seatByUid: Object.fromEntries(players.map((p) => [p.uid, p.seat])),
    game: createGame(seats),
  });
  return room;
}

export function resumeLocalGame() {
  const saved = savedLocalGame();
  if (!saved) return null;
  update(saved);
  return room;
}

export function watchLocalRoom(cb) {
  listeners.add(cb);
  // Asynchronous first call, matching how a Firestore listener behaves, so
  // callers can't accidentally depend on it being synchronous here and not
  // there.
  Promise.resolve().then(() => cb(room));
  return () => listeners.delete(cb);
}

/** Whoever is on turn is the one holding the phone, so every action is
 * allowed — there is nobody else to take it out of turn. */
export function localRoll() {
  if (!room?.game || room.status !== "playing" || room.game.dice !== null) return;
  update({ ...room, game: applyRoll(room.game, rollDice()) });
}

export function localMove(tokenIndex) {
  if (!room?.game || room.status !== "playing") return;
  const game = applyMove(room.game, tokenIndex);
  update({ ...room, game, status: game.status === "finished" ? "finished" : "playing" });
}

/** Rarely needed on one phone, but the control is shared with online play
 * and someone stepping out mid-game should not end it. */
export function localSkip() {
  if (!room?.game || room.status !== "playing") return;
  const name = room.players.find((p) => p.seat === room.game.turn)?.name || null;
  update({ ...room, game: passTurn(room.game, name) });
}

export function localPlayAgain() {
  if (!room) return;
  update({ ...room, status: "playing", game: createGame(room.players.length) });
}

export function endLocalGame() {
  update(null);
}

/** The seat holding the phone right now. Pass-and-play has no "me" — the
 * player on turn is whoever picked it up, so that seat is treated as the
 * local player and can always act. */
export function currentLocalUid() {
  if (!room?.game) return null;
  return room.players.find((p) => p.seat === room.game.turn)?.uid ?? room.players[0].uid;
}

export function isLocalRoom(candidate) {
  return Boolean(candidate?.local);
}
