// Ludo rules engine — pure functions, no DOM and no network, so the same
// code runs in the browser and under `node ludo/test/game.test.mjs`.
//
// Every function takes a state and returns a NEW state rather than mutating
// one. That is what makes the multiplayer sync simple: the whole game state
// is one JSON object written to one Firestore document, so a move is a
// single atomic write and every device converges on the same board without
// any merge logic.
//
// ## Why the board is generated rather than drawn
//
// Ludo is a four-player game: the classic cross-shaped board has exactly
// four arms. Seven players do not fit on it. Rather than hand-draw a
// seven-armed board, the geometry is derived from the player count — a ring
// of squares with one arm per player — so 2 through 8 players all work from
// one implementation. At four players the numbers come out exactly like
// classic Ludo (52 track squares, starts 13 apart); it simply renders as a
// ring instead of a cross.

/** Squares in a player's home column, the last of which is the centre. A
 * token needs an exact roll to land on it. */
export const HOME_LEN = 6;
export const TOKENS_PER_PLAYER = 4;
export const MIN_SEATS = 2;
export const MAX_SEATS = 8;

/** Token positions are stored relative to that player's own start square,
 * which is what makes one set of rules work for every seat:
 *
 *   -1                          in the yard, not yet on the board
 *   0 .. trackLen-1             on the shared ring, `pos` steps from own start
 *   trackLen .. trackLen+4      in own home column
 *   trackLen+5 (HOME_LEN-1)     the centre — finished
 */
export const YARD = -1;

/** Board size for a given number of players.
 *
 * `seg` is the gap between one player's start square and the next player's.
 * Picking it as 52/seats keeps a game roughly the same length regardless of
 * how many are playing — and lands on exactly 13 for four players, which is
 * the classic board. Never below 6, or the starts crowd together and the
 * opening becomes a bloodbath. */
export function boardConfig(seats) {
  if (!Number.isInteger(seats) || seats < MIN_SEATS || seats > MAX_SEATS) {
    throw new Error(`Ludo needs between ${MIN_SEATS} and ${MAX_SEATS} players.`);
  }
  const seg = Math.max(6, Math.round(52 / seats));
  return { seats, seg, trackLen: seats * seg, homeLen: HOME_LEN };
}

export function finishPos(config) {
  return config.trackLen + config.homeLen - 1;
}

/** Where a seat's own start square sits on the shared ring. */
export function startSquare(config, seat) {
  return seat * config.seg;
}

/** A relative position turned into a square on the shared ring, or null if
 * the token is in the yard or has left the ring for its home column. */
export function ringSquare(config, seat, pos) {
  if (pos < 0 || pos >= config.trackLen) return null;
  return (startSquare(config, seat) + pos) % config.trackLen;
}

/** Squares where a token can't be captured: every player's start square,
 * plus one square midway along each segment — the same idea as the starred
 * squares on a classic board, spaced to suit however many arms there are. */
export function safeSquares(config) {
  const safe = new Set();
  for (let seat = 0; seat < config.seats; seat++) {
    safe.add(startSquare(config, seat));
    safe.add((startSquare(config, seat) + Math.floor(config.seg / 2)) % config.trackLen);
  }
  return safe;
}

export function createGame(seats, { seed = Date.now() } = {}) {
  const config = boardConfig(seats);
  const tokens = {};
  for (let seat = 0; seat < seats; seat++) {
    tokens[seat] = new Array(TOKENS_PER_PLAYER).fill(YARD);
  }
  return {
    ...config,
    seed,
    turn: 0,
    dice: null,
    // Consecutive sixes by the player currently on turn. Three in a row
    // forfeits the turn — the classic rule that stops a lucky streak from
    // running forever.
    sixStreak: 0,
    tokens,
    // Seats that have got all four tokens home, in the order they did it,
    // so a seven-player game produces a full ranking rather than one winner
    // and six people who just stop.
    finished: [],
    status: "playing",
    log: [],
  };
}

export function isSeatFinished(state, seat) {
  return state.finished.includes(seat);
}

/** Seats still playing, in turn order starting after `from`. */
export function nextActiveSeat(state, from) {
  for (let step = 1; step <= state.seats; step++) {
    const seat = (from + step) % state.seats;
    if (!isSeatFinished(state, seat)) return seat;
  }
  return from;
}

function activeSeatCount(state) {
  return state.seats - state.finished.length;
}

/** Token indices the player on turn may legally move with the current dice.
 * An empty array means the turn passes. */
export function legalMoves(state) {
  if (state.status !== "playing" || state.dice === null) return [];
  const dice = state.dice;
  const seat = state.turn;
  const positions = state.tokens[seat];
  const end = finishPos(state);

  const moves = [];
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    if (pos === YARD) {
      // Only a six releases a token from the yard.
      if (dice === 6) moves.push(i);
      continue;
    }
    if (pos === end) continue; // already home
    // The centre must be reached exactly; an overshoot is not a move.
    if (pos + dice <= end) moves.push(i);
  }
  return moves;
}

/** Records the dice for the player on turn.
 *
 * Three sixes in a row forfeits the turn outright — the move is not played.
 * Otherwise, if the roll leaves no legal move, the turn passes immediately
 * so nobody has to tap through a dead end. */
export function applyRoll(state, dice) {
  if (state.status !== "playing") return state;
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) {
    throw new Error("A dice roll must be a whole number from 1 to 6.");
  }

  const sixStreak = dice === 6 ? state.sixStreak + 1 : 0;
  const next = { ...state, dice, sixStreak };

  if (sixStreak >= 3) {
    return endTurn(
      { ...next, dice: null, sixStreak: 0 },
      `Seat ${state.turn} rolled a third six — turn forfeited`,
    );
  }

  if (legalMoves(next).length === 0) {
    return endTurn({ ...next, dice: null }, `Seat ${state.turn} rolled ${dice} — no legal move`);
  }
  return log(next, `Seat ${state.turn} rolled ${dice}`);
}

/** Plays one token forward by the current dice. */
export function applyMove(state, tokenIndex) {
  if (state.status !== "playing" || state.dice === null) return state;
  if (!legalMoves(state).includes(tokenIndex)) return state;

  const seat = state.turn;
  const dice = state.dice;
  const tokens = cloneTokens(state.tokens);
  const from = tokens[seat][tokenIndex];
  const to = from === YARD ? 0 : from + dice;
  tokens[seat][tokenIndex] = to;

  let next = { ...state, tokens };
  let extraTurn = dice === 6;
  const messages = [];

  // --- Captures ------------------------------------------------------
  // Only on the shared ring, and never on a safe square.
  const landedOn = ringSquare(state, seat, to);
  if (landedOn !== null && !safeSquares(state).has(landedOn)) {
    for (let other = 0; other < state.seats; other++) {
      if (other === seat) continue;
      for (let i = 0; i < tokens[other].length; i++) {
        if (ringSquare(state, other, tokens[other][i]) === landedOn) {
          tokens[other][i] = YARD;
          extraTurn = true; // a capture earns another go
          messages.push(`captured seat ${other}'s token`);
        }
      }
    }
  }

  // --- Reaching the centre -------------------------------------------
  if (to === finishPos(state)) {
    extraTurn = true;
    messages.push("got a token home");
    if (tokens[seat].every((p) => p === finishPos(state))) {
      next = { ...next, finished: [...state.finished, seat] };
      messages.push(`SEAT ${seat} FINISHED`);
      extraTurn = false; // nothing left to move
    }
  }

  next = log(next, `Seat ${seat} moved ${describe(from)}→${describe(to)}${messages.length ? " — " + messages.join(", ") : ""}`);
  next = { ...next, dice: null };

  // One player left standing ends the game; they take the last place.
  if (activeSeatCount(next) <= 1) {
    const last = [...Array(next.seats).keys()].find((s) => !next.finished.includes(s));
    return {
      ...next,
      finished: last === undefined ? next.finished : [...next.finished, last],
      status: "finished",
      dice: null,
      sixStreak: 0,
    };
  }

  if (extraTurn && !isSeatFinished(next, seat)) {
    return { ...next, turn: seat };
  }
  return endTurn(next, null);
}

function endTurn(state, message) {
  const next = message ? log(state, message) : state;
  return {
    ...next,
    turn: nextActiveSeat(next, next.turn),
    dice: null,
    sixStreak: 0,
  };
}

function describe(pos) {
  if (pos === YARD) return "yard";
  return String(pos);
}

function cloneTokens(tokens) {
  const copy = {};
  for (const [seat, list] of Object.entries(tokens)) copy[seat] = [...list];
  return copy;
}

/** The log is what players scroll back through to see what just happened,
 * and it lives in the same document as the board — so it is capped, or a
 * long seven-player game would grow the document without limit. */
function log(state, message) {
  const entry = { at: Date.now(), message };
  return { ...state, log: [...state.log, entry].slice(-30) };
}

export function rollDice(random = Math.random) {
  return 1 + Math.floor(random() * 6);
}

/** How far a seat has left to go, used for the standings panel. */
export function seatProgress(state, seat) {
  const end = finishPos(state);
  const positions = state.tokens[seat];
  const home = positions.filter((p) => p === end).length;
  const travelled = positions.reduce((sum, p) => sum + (p === YARD ? 0 : p), 0);
  return { home, travelled, total: end * TOKENS_PER_PLAYER };
}
