// Room sync over Firestore.
//
// The entire game lives in ONE document per room: the player list, whose
// turn it is, and the full board state as produced by js/game.js. That is
// deliberate — a move is then a single atomic write that every device
// receives as one snapshot, so there is no window where two phones disagree
// about the board and no merge logic to get wrong.
//
// What a document write costs: a Ludo game is a few hundred moves, so a
// seven-player game is a few hundred writes and a few thousand reads. The
// Spark (free) plan allows 20,000 writes and 50,000 reads a day, so this
// runs at no cost for a family playing daily — the same reason the fest app
// stays on Spark.
import {
  db,
  auth,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "./firebase.js";
import { createGame, applyRoll, applyMove, passTurn, rollDice, MAX_SEATS, MIN_SEATS } from "./game.js";

// No 0/O/1/I/5/S — a room code gets read aloud over the phone or typed from
// a screenshot, and those are the pairs people get wrong.
const CODE_ALPHABET = "ACDEFGHJKMNPQRTUVWXYZ2346789";
const CODE_LENGTH = 5;

function randomCode() {
  let code = "";
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

export function roomRef(code) {
  return doc(db, "rooms", code);
}

/** Creates a room with the caller as host in seat 0. Retries on the
 * astronomically unlikely code collision rather than handing back a code
 * that is already someone else's game. */
export async function createRoom({ seats, name }) {
  if (seats < MIN_SEATS || seats > MAX_SEATS) {
    throw new Error(`Pick between ${MIN_SEATS} and ${MAX_SEATS} players.`);
  }
  const uid = auth.currentUser.uid;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const ref = roomRef(code);
    const created = await runTransaction(db, async (tx) => {
      const existing = await tx.get(ref);
      if (existing.exists()) return false;
      tx.set(ref, {
        code,
        hostUid: uid,
        status: "lobby",
        seats,
        players: [{ uid, name, seat: 0 }],
        // Duplicated as a plain map because firestore.rules cannot search
        // an array of objects — this is what lets the rules check "is it
        // actually your turn?" on every move.
        seatByUid: { [uid]: 0 },
        game: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return true;
    });
    if (created) return code;
  }
  throw new Error("Couldn't create a room — please try again.");
}

export async function joinRoom(code, name) {
  const uid = auth.currentUser.uid;
  const ref = roomRef(code.toUpperCase());

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("No room with that code.");
    const room = snap.data();

    const already = room.players.find((p) => p.uid === uid);
    if (already) {
      // Rejoining your own seat after a reload or a dropped connection is
      // always allowed, even mid-game — that is the common case, not an
      // error.
      if (already.name !== name) {
        const players = room.players.map((p) => (p.uid === uid ? { ...p, name } : p));
        tx.update(ref, { players, updatedAt: serverTimestamp() });
      }
      return { code: room.code, seat: already.seat, rejoined: true };
    }

    if (room.status !== "lobby") throw new Error("That game has already started.");
    if (room.players.length >= room.seats) throw new Error("That room is full.");

    const taken = new Set(room.players.map((p) => p.seat));
    let seat = 0;
    while (taken.has(seat)) seat++;

    tx.update(ref, {
      players: [...room.players, { uid, name, seat }],
      seatByUid: { ...room.seatByUid, [uid]: seat },
      updatedAt: serverTimestamp(),
    });
    return { code: room.code, seat, rejoined: false };
  });
}

export function watchRoom(code, cb, onError) {
  return onSnapshot(
    roomRef(code),
    (snap) => cb(snap.exists() ? snap.data() : null),
    (err) => {
      console.error("Room listener failed:", err);
      onError?.(err);
    },
  );
}

/** Host only. Locks the lobby and deals a fresh board sized to the players
 * who actually turned up, not the number of seats originally chosen. */
export async function startGame(code) {
  const ref = roomRef(code);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("Room is gone.");
    const room = snap.data();
    if (room.hostUid !== auth.currentUser.uid) throw new Error("Only the host can start the game.");
    if (room.status === "playing") return;
    if (room.players.length < MIN_SEATS) throw new Error("At least two players are needed.");

    // Seats are re-packed to 0..n-1 so a lobby someone left doesn't deal a
    // board with an empty colour nobody is playing.
    const players = [...room.players]
      .sort((a, b) => a.seat - b.seat)
      .map((p, index) => ({ ...p, seat: index }));
    const seatByUid = Object.fromEntries(players.map((p) => [p.uid, p.seat]));

    tx.update(ref, {
      status: "playing",
      players,
      seatByUid,
      seats: players.length,
      game: createGame(players.length),
      updatedAt: serverTimestamp(),
    });
  });
}

/** Rolls for the player on turn. The roll and its consequences are computed
 * inside a transaction against the stored board, so two devices tapping at
 * once cannot both apply a roll. */
export async function rollForTurn(code) {
  const ref = roomRef(code);
  const uid = auth.currentUser.uid;
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const room = snap.data();
    if (!room?.game || room.status !== "playing") return null;
    if (room.seatByUid[uid] !== room.game.turn) return null; // not your turn
    if (room.game.dice !== null) return null; // already rolled, waiting on a move

    const dice = rollDice();
    tx.update(ref, { game: applyRoll(room.game, dice), updatedAt: serverTimestamp() });
    return dice;
  });
}

export async function moveToken(code, tokenIndex) {
  const ref = roomRef(code);
  const uid = auth.currentUser.uid;
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const room = snap.data();
    if (!room?.game || room.status !== "playing") return;
    if (room.seatByUid[uid] !== room.game.turn) return;

    const game = applyMove(room.game, tokenIndex);
    tx.update(ref, {
      game,
      status: game.status === "finished" ? "finished" : "playing",
      updatedAt: serverTimestamp(),
    });
  });
}

/** Moves play on past a player who has stopped responding.
 *
 * Without this a single locked phone ends the game for everyone: only the
 * player on turn may write the board, so if they never act, nobody can.
 * The host may always do it; any other player may once the room has been
 * untouched long enough (firestore.rules enforces the wait, this is just
 * the client side of it). */
export async function skipTurn(code) {
  const ref = roomRef(code);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const room = snap.data();
    if (!room?.game || room.status !== "playing") return;
    const name = room.players.find((p) => p.seat === room.game.turn)?.name || null;
    tx.update(ref, { game: passTurn(room.game, name), updatedAt: serverTimestamp() });
  });
}

/** Host only: deal again with the same players, so a group can play another
 * round without everyone rejoining. */
export async function playAgain(code) {
  const ref = roomRef(code);
  const snap = await getDoc(ref);
  const room = snap.data();
  if (room.hostUid !== auth.currentUser.uid) throw new Error("Only the host can start a new round.");
  await updateDoc(ref, {
    status: "playing",
    game: createGame(room.players.length),
    updatedAt: serverTimestamp(),
  });
}

export async function leaveRoom(code) {
  const ref = roomRef(code);
  const uid = auth.currentUser.uid;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const room = snap.data();
    const players = room.players.filter((p) => p.uid !== uid);
    if (players.length === 0) {
      tx.delete(ref);
      return;
    }
    const seatByUid = { ...room.seatByUid };
    delete seatByUid[uid];
    tx.update(ref, {
      players,
      seatByUid,
      // The room needs a host at all times, or nobody can start or restart
      // it; the longest-standing remaining player inherits it.
      hostUid: room.hostUid === uid ? players[0].uid : room.hostUid,
      updatedAt: serverTimestamp(),
    });
  });
  await clearMySignals(code).catch(() => {});
}

// --- Presence (who is online, who has voice on) ---------------------------
// Kept in a subcollection rather than the room document so that updating it
// is not blocked by the "only the player on turn may write the room" rule.

export function presenceRef(code, uid) {
  return doc(db, "rooms", code, "presence", uid);
}

export async function setPresence(code, { name, voiceOn }) {
  await setDoc(
    presenceRef(code, auth.currentUser.uid),
    { uid: auth.currentUser.uid, name, voiceOn, lastSeen: serverTimestamp() },
    { merge: true },
  );
}

export function watchPresence(code, cb) {
  return onSnapshot(collection(db, "rooms", code, "presence"), (snap) =>
    cb(snap.docs.map((d) => d.data())),
  );
}

async function clearMySignals(code) {
  const uid = auth.currentUser.uid;
  const mine = await getDocs(
    query(collection(db, "rooms", code, "signals"), where("to", "==", uid)),
  );
  await Promise.all(mine.docs.map((d) => deleteDoc(d.ref)));
}
