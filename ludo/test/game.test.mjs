// Rules tests — plain node, no dependencies:  node ludo/test/game.test.mjs
//
// The engine is pure, so every rule can be checked by driving states
// directly instead of clicking through a board. Run this before touching
// js/game.js: the capture, home-entry and turn-order rules are exactly the
// sort that look right on screen and are quietly wrong.
import {
  boardConfig,
  createGame,
  applyRoll,
  applyMove,
  legalMoves,
  finishPos,
  ringSquare,
  safeSquares,
  startSquare,
  nextActiveSeat,
  seatProgress,
  YARD,
  HOME_LEN,
  MAX_SEATS,
  MIN_SEATS,
} from "../www/js/game.js";

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failures.push(`${name}: ${err.message}`);
  }
}

function eq(actual, expected, what = "value") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what} was ${a}, expected ${e}`);
}

function ok(cond, what) {
  if (!cond) throw new Error(what);
}

// --- Board geometry --------------------------------------------------------

check("four players reproduce the classic board exactly", () => {
  const c = boardConfig(4);
  eq(c.seg, 13, "segment");
  eq(c.trackLen, 52, "track length");
});

check("every supported player count produces a sane board", () => {
  for (let seats = MIN_SEATS; seats <= MAX_SEATS; seats++) {
    const c = boardConfig(seats);
    ok(c.seg >= 6, `${seats} players: segment ${c.seg} is too small`);
    ok(c.trackLen === c.seg * seats, `${seats} players: track length mismatch`);
    // Starts must be distinct, or two players would share a start square.
    const starts = new Set();
    for (let s = 0; s < seats; s++) starts.add(startSquare(c, s));
    eq(starts.size, seats, `${seats} players: distinct start squares`);
  }
});

check("seven players — the count actually asked for — is a legal board", () => {
  const c = boardConfig(7);
  eq(c.seats, 7, "seats");
  eq(c.seg, 7, "segment");
  eq(c.trackLen, 49, "track length");
});

check("out-of-range player counts are rejected", () => {
  for (const bad of [0, 1, 9, 2.5, "4"]) {
    let threw = false;
    try {
      boardConfig(bad);
    } catch {
      threw = true;
    }
    ok(threw, `${bad} players should have been rejected`);
  }
});

check("each seat's ring positions wrap around to its own start", () => {
  const g = createGame(7);
  for (let seat = 0; seat < 7; seat++) {
    eq(ringSquare(g, seat, 0), startSquare(g, seat), `seat ${seat} at pos 0`);
    // The last ring square before turning into the home column is the one
    // just behind its own start — that's what makes it a full lap.
    eq(
      ringSquare(g, seat, g.trackLen - 1),
      (startSquare(g, seat) + g.trackLen - 1) % g.trackLen,
      `seat ${seat} at the end of its lap`,
    );
    eq(ringSquare(g, seat, g.trackLen), null, `seat ${seat} in its home column`);
    eq(ringSquare(g, seat, YARD), null, `seat ${seat} in the yard`);
  }
});

check("every seat's start square is safe", () => {
  const g = createGame(7);
  const safe = safeSquares(g);
  for (let seat = 0; seat < 7; seat++) {
    ok(safe.has(startSquare(g, seat)), `seat ${seat}'s start square is not safe`);
  }
});

// --- Leaving the yard ------------------------------------------------------

check("only a six releases a token from the yard", () => {
  const g = createGame(4);
  for (const dice of [1, 2, 3, 4, 5]) {
    eq(legalMoves({ ...g, dice }), [], `dice ${dice} from an all-yard position`);
  }
  eq(legalMoves({ ...g, dice: 6 }), [0, 1, 2, 3], "dice 6 from an all-yard position");
});

check("a roll with no legal move passes the turn immediately", () => {
  const g = createGame(4);
  const after = applyRoll(g, 3);
  eq(after.turn, 1, "turn after a dead roll");
  eq(after.dice, null, "dice cleared after a dead roll");
});

check("a token leaving the yard lands on its own start square", () => {
  const g = applyRoll(createGame(4), 6);
  const after = applyMove(g, 0);
  eq(after.tokens[0][0], 0, "position after leaving the yard");
  eq(ringSquare(after, 0, after.tokens[0][0]), startSquare(after, 0), "ring square");
});

// --- Turn order ------------------------------------------------------------

check("a six earns another turn", () => {
  let g = createGame(4);
  g = applyRoll(g, 6);
  g = applyMove(g, 0);
  eq(g.turn, 0, "seat still on turn after a six");
});

check("an ordinary roll passes the turn on", () => {
  let g = createGame(4);
  g.tokens[0][0] = 5; // already on the board
  g = applyRoll(g, 3);
  g = applyMove(g, 0);
  eq(g.turn, 1, "turn after an ordinary move");
});

check("three sixes in a row forfeit the turn without moving", () => {
  let g = createGame(4);
  g.tokens[0][0] = 5;
  g = applyRoll(g, 6);
  g = applyMove(g, 0); // first six: moves, keeps the turn
  eq(g.turn, 0, "turn after the first six");
  g = applyRoll(g, 6);
  g = applyMove(g, 0); // second six: same
  eq(g.turn, 0, "turn after the second six");
  const before = JSON.stringify(g.tokens);
  g = applyRoll(g, 6); // third six: forfeited
  eq(g.turn, 1, "turn after the third six");
  eq(JSON.stringify(g.tokens), before, "board must be untouched by a forfeited third six");
});

check("the six streak resets when the turn changes hands", () => {
  let g = createGame(4);
  g.tokens[0][0] = 5;
  g = applyRoll(g, 6);
  g = applyMove(g, 0);
  eq(g.sixStreak, 1, "streak after one six");
  g = applyRoll(g, 2);
  g = applyMove(g, 0);
  eq(g.sixStreak, 0, "streak after the turn passes");
});

// --- Capturing -------------------------------------------------------------

check("landing on an opponent sends it back to the yard", () => {
  const g = createGame(4);
  // Put seat 1's token on a square seat 0 can reach, and make sure it's not
  // one of the safe ones.
  const target = findCapturableSquare(g);
  g.tokens[0][0] = target.attackerPos - 3;
  g.tokens[1][0] = target.victimPos;
  let next = applyRoll(g, 3);
  next = applyMove(next, 0);
  eq(next.tokens[1][0], YARD, "victim sent home");
  eq(next.turn, 0, "capturing earns another turn");
});

check("a token on a safe square cannot be captured", () => {
  const g = createGame(4);
  const safeSquare = startSquare(g, 1); // seat 1's start, always safe
  // Seat 0's relative position that maps onto that same ring square:
  const attackerPos = (safeSquare - startSquare(g, 0) + g.trackLen) % g.trackLen;
  g.tokens[0][0] = attackerPos - 2;
  g.tokens[1][0] = 0; // sitting on its own start
  let next = applyRoll(g, 2);
  next = applyMove(next, 0);
  eq(next.tokens[1][0], 0, "token on a safe square must survive");
  eq(next.turn, 1, "no extra turn without a capture");
});

check("a token in its home column is out of reach", () => {
  const g = createGame(4);
  g.tokens[1][0] = g.trackLen + 2; // seat 1, in its home column
  g.tokens[0][0] = 10;
  let next = applyRoll(g, 3);
  next = applyMove(next, 0);
  eq(next.tokens[1][0], g.trackLen + 2, "home-column token must be untouched");
});

check("your own token is never captured by another of yours", () => {
  const g = createGame(4);
  g.tokens[0][0] = 10;
  g.tokens[0][1] = 7;
  let next = applyRoll(g, 3);
  next = applyMove(next, 1); // 7 + 3 = 10, same square as its own token
  eq(next.tokens[0][0], 10, "own token must stay put");
  eq(next.tokens[0][1], 10, "moving token arrives");
});

// --- Home column and finishing --------------------------------------------

check("the centre needs an exact roll — an overshoot is not a legal move", () => {
  const g = createGame(4);
  const end = finishPos(g);
  g.tokens[0][0] = end - 2;
  eq(legalMoves({ ...g, dice: 3 }), [], "overshooting must offer no move");
  eq(legalMoves({ ...g, dice: 2 }), [0], "the exact roll must be playable");
});

check("the home column is exactly HOME_LEN squares deep", () => {
  const g = createGame(7);
  eq(finishPos(g) - g.trackLen + 1, HOME_LEN, "home column depth");
});

check("getting a token home earns another turn", () => {
  const g = createGame(4);
  g.tokens[0][0] = finishPos(g) - 1;
  let next = applyRoll(g, 1);
  next = applyMove(next, 0);
  eq(next.turn, 0, "turn after getting a token home");
});

check("all four tokens home finishes that seat and moves play on", () => {
  const g = createGame(4);
  const end = finishPos(g);
  g.tokens[0] = [end, end, end, end - 1];
  let next = applyRoll(g, 1);
  eq(legalMoves(next), [3], "only the token still short of the centre may move");
  next = applyMove(next, 3);
  eq(next.finished, [0], "finishing order");
  eq(next.turn, 1, "play moves on to the next seat");
  ok(next.status === "playing", "three players left means the game continues");
});

check("a finished seat is skipped in the turn order", () => {
  const g = createGame(7);
  const state = { ...g, finished: [1, 2] };
  eq(nextActiveSeat(state, 0), 3, "skipping two finished seats");
  eq(nextActiveSeat(state, 6), 0, "wrapping past the end");
});

check("the game ends when only one player is left, and ranks everyone", () => {
  const g = createGame(3);
  const end = finishPos(g);
  const state = { ...g, finished: [2], tokens: { ...g.tokens, 0: [end, end, end, end - 1] } };
  let next = applyRoll(state, 1);
  next = applyMove(next, 3);
  eq(next.status, "finished", "status");
  eq(next.finished, [2, 0, 1], "full ranking, last player included");
});

check("a finished game accepts no further rolls or moves", () => {
  const finished = { ...createGame(4), status: "finished" };
  eq(applyRoll(finished, 6), finished, "roll on a finished game");
  eq(applyMove({ ...finished, dice: 6 }, 0).tokens, finished.tokens, "move on a finished game");
});

// --- Integrity -------------------------------------------------------------

check("an illegal token index is ignored rather than corrupting the board", () => {
  const g = applyRoll(createGame(4), 3); // 3 with everything in the yard passes the turn
  const before = JSON.stringify(g);
  eq(JSON.stringify(applyMove(g, 2)), before, "state must be unchanged");
});

check("an out-of-range dice value is rejected", () => {
  for (const bad of [0, 7, -1, 2.5, null]) {
    let threw = false;
    try {
      applyRoll(createGame(4), bad);
    } catch {
      threw = true;
    }
    ok(threw, `dice ${bad} should have been rejected`);
  }
});

check("applying a move never mutates the state it was given", () => {
  const g = applyRoll(createGame(4), 6);
  const snapshot = JSON.stringify(g);
  applyMove(g, 0);
  eq(JSON.stringify(g), snapshot, "input state must be untouched");
});

check("the log stays capped so the document can't grow without limit", () => {
  let g = createGame(2);
  g.tokens[0][0] = 1;
  g.tokens[1][0] = 1;
  for (let i = 0; i < 100; i++) {
    g = applyRoll(g, 1);
    const moves = legalMoves(g);
    if (moves.length) g = applyMove(g, moves[0]);
  }
  ok(g.log.length <= 30, `log grew to ${g.log.length} entries`);
});

check("progress reporting counts finished tokens and distance", () => {
  const g = createGame(4);
  const end = finishPos(g);
  g.tokens[0] = [end, 10, YARD, YARD];
  const p = seatProgress(g, 0);
  eq(p.home, 1, "tokens home");
  eq(p.travelled, end + 10, "distance travelled");
});

// A full seven-player game played to completion with random dice — the
// check that matters most, since it exercises every rule together and would
// catch a state the engine can get stuck in.
check("a random seven-player game always reaches a finish", () => {
  for (let trial = 0; trial < 30; trial++) {
    let g = createGame(7, { seed: trial });
    let turns = 0;
    let random = mulberry32(trial + 1);
    while (g.status === "playing") {
      if (++turns > 200000) throw new Error(`game ${trial} never finished`);
      g = applyRoll(g, 1 + Math.floor(random() * 6));
      const moves = legalMoves(g);
      if (moves.length) g = applyMove(g, moves[Math.floor(random() * moves.length)]);
    }
    eq(g.finished.length, 7, `game ${trial}: everyone ranked`);
    eq(new Set(g.finished).size, 7, `game ${trial}: no seat ranked twice`);
  }
});

check("token counts are conserved across a whole game", () => {
  let g = createGame(5);
  const random = mulberry32(99);
  while (g.status === "playing") {
    g = applyRoll(g, 1 + Math.floor(random() * 6));
    const moves = legalMoves(g);
    if (moves.length) g = applyMove(g, moves[Math.floor(random() * moves.length)]);
    for (let seat = 0; seat < g.seats; seat++) {
      eq(g.tokens[seat].length, 4, `seat ${seat} must always have four tokens`);
      for (const p of g.tokens[seat]) {
        ok(p === YARD || (p >= 0 && p <= finishPos(g)), `seat ${seat} token out of range at ${p}`);
      }
    }
  }
});

/** Finds a square seat 0 can move onto that seat 1 can occupy and that is
 * not safe — the setup a capture test needs. */
function findCapturableSquare(g) {
  const safe = safeSquares(g);
  for (let attackerPos = 4; attackerPos < g.trackLen; attackerPos++) {
    const square = ringSquare(g, 0, attackerPos);
    if (safe.has(square)) continue;
    const victimPos = (square - startSquare(g, 1) + g.trackLen) % g.trackLen;
    if (victimPos > 0 && victimPos < g.trackLen) return { attackerPos, victimPos };
  }
  throw new Error("no capturable square found");
}

/** Small deterministic PRNG so a failing game can be reproduced. */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

console.log(`\n${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  FAIL  ${f}`);
process.exit(failures.length ? 1 : 0);
