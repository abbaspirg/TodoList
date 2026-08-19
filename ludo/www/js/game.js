// Ludo rules engine — pure functions, no DOM and no network, so the same
// code runs in the browser and under `node ludo/test/game.test.mjs`.
//
// Every function takes a state and returns a NEW state rather than mutating
// one. That is what makes the multiplayer sync simple: the whole game state
// is one JSON object written to one Firestore document, so a move is a
// single atomic write and every device converges on the same board without
// any merge logic.
//
// ## Two board shapes
//
// Ludo is a four-player game: the classic cross has exactly four arms, and
// seven players do not fit on it. So two to four players get the real
// 52-cell cross board, and five to eight get a polygon with one arm each —
// the shape a physical seven-player set uses. Both are the same structure
// (a lane out, a tip, a lane back, home column up the middle), differing
// only in lane length. See boardConfig below.

/** Squares in a player's home column, the last of which is the centre. A
 * token needs an exact roll to land on it. */
export const HOME_LEN = 6;
export const TOKENS_PER_PLAYER = 4;
export const MIN_SEATS = 2;
export const MAX_SEATS = 8;

/** Token positions are stored relative to that player's own start square,
 * which is what makes one set of rules work for every seat:
 *
 *   -1                            in the yard, not yet on the board
 *   0 .. trackLen-1               on the shared track, `pos` steps from own start
 *   trackLen .. trackLen+homeLen-2  in own home column
 *   trackLen+homeLen-1            the centre — finished
 */
export const YARD = -1;

/** The classic board is 52 cells with four arms 13 apart. Two, three and
 * four players all play on exactly that board — which is what lets them be
 * drawn as the familiar cross. Only five or more need a generated ring.
 *
 * Which corners get used matters: with two players they sit OPPOSITE each
 * other, as on a real board, rather than side by side. */
export const CLASSIC_TRACK = 52;
const CLASSIC_SEG = 13;
const CLASSIC_CORNERS = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };

// Both board shapes are built from the same unit: an arm (or sector) of
// `lane` cells running outward, one cell across the tip, and `lane` cells
// running back — plus a home column of `lane - 1` cells up the middle.
//
//   cells on the shared track per arm = 2 * lane + 1
//   home positions (column + centre)  = lane
//
// The classic cross has six-cell lanes, which is where its 13-per-arm and
// 52-cell track come from. The polygon boards for five or more players use
// four-cell lanes, because seven arms of thirteen would be a 91-cell track
// and a game that never ends. Four keeps every board between 48 and 75
// steps from yard to centre, against the classic board's 57.
export const CLASSIC_LANE = 6;
export const POLYGON_LANE = 4;

/** Cells along one lane of an arm — the number every other board dimension
 * is derived from. */
export function laneLength(config) {
  return config.classic ? CLASSIC_LANE : POLYGON_LANE;
}

/** Board size for a given number of players.
 *
 * Up to four players it is the classic board, unchanged. Beyond that the
 * gap between starts is 52/seats (never below 6), which keeps a game about
 * the same length however many are playing instead of letting an
 * eight-player board run nearly twice as long. */
export function boardConfig(seats) {
  if (!Number.isInteger(seats) || seats < MIN_SEATS || seats > MAX_SEATS) {
    throw new Error(`Ludo needs between ${MIN_SEATS} and ${MAX_SEATS} players.`);
  }
  if (seats <= 4) {
    return {
      seats,
      seg: CLASSIC_SEG,
      trackLen: CLASSIC_TRACK,
      homeLen: CLASSIC_LANE,
      classic: true,
      // Which of the four corners each seat occupies, so the renderer and
      // the rules agree on where a seat starts.
      starts: CLASSIC_CORNERS[seats].map((corner) => corner * CLASSIC_SEG),
    };
  }

  // A polygon with one arm per player — the shape a real seven-player board
  // uses. Each arm is laid out exactly like an arm of the cross: out along
  // one lane, across the tip, back along the other, with the home column up
  // the middle.
  const seg = 2 * POLYGON_LANE + 1;
  return {
    seats,
    seg,
    trackLen: seats * seg,
    homeLen: POLYGON_LANE,
    classic: false,
    // A seat starts on the second cell of its own arm's returning lane,
    // which is the cell its yard opens onto — the same place a player
    // starts on the classic board.
    starts: Array.from({ length: seats }, (_, seat) => seat * seg + POLYGON_LANE + 2),
  };
}

export function finishPos(config) {
  return config.trackLen + config.homeLen - 1;
}

/** Where a seat's own start square sits on the shared track. */
export function startSquare(config, seat) {
  return config.starts[seat];
}

/** A relative position turned into a square on the shared track, or null if
 * the token is in the yard or has left the track for its home column. */
export function ringSquare(config, seat, pos) {
  if (pos < 0 || pos >= config.trackLen) return null;
  return (startSquare(config, seat) + pos) % config.trackLen;
}

/** The eight starred/coloured squares of a classic board: the four corner
 * start cells, and the star eight steps on from each. Hard-coded rather
 * than derived because these are the positions printed on a real board, and
 * they hold whether two, three or four people are playing. */
const CLASSIC_SAFE = [0, 8, 13, 21, 26, 34, 39, 47];

/** Squares where a token can't be captured. */
export function safeSquares(config) {
  if (config.trackLen === CLASSIC_TRACK) return new Set(CLASSIC_SAFE);
  // On a generated ring: every seat's start, plus one square midway along
  // each segment — the same idea as the stars, spaced to suit the arms.
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

/** Moves play on without a roll.
 *
 * Recovery, not a rule: a player whose phone locked, who lost signal or who
 * simply walked off stops the game dead for everyone else, because only the
 * player on turn may act. This is the way out. */
export function passTurn(state, playerName = null) {
  if (state.status !== "playing") return state;
  return endTurn(state, `${playerName ? playerName : `Seat ${state.turn}`}'s turn was skipped`);
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
