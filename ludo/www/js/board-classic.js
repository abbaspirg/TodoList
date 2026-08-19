// The familiar cross-shaped Ludo board, on the standard 15x15 grid.
//
// Used whenever the track is the classic 52 cells — two, three or four
// players. Five or more can't fit on a four-armed cross and get the
// polygon board in js/layout-polygon.js instead.
//
// The 52 track cells are enumerated once, in play order, starting at the
// red corner's entry square. Everything else — which cell is a start, where
// a home column runs, where the stars go — is indexed off that one list, so
// the drawing and the rules can never disagree about where a token is.

export const GRID = 15;

/** The 52 track cells as [col, row] on the 15x15 grid, in play order.
 * Index 0 is red's start; the four corner starts land on 0, 13, 26 and 39. */
export const TRACK_CELLS = buildTrack();

function buildTrack() {
  const cells = [];
  const run = (from, to, fn) => {
    const step = from <= to ? 1 : -1;
    for (let i = from; step > 0 ? i <= to : i >= to; i += step) cells.push(fn(i));
  };

  run(1, 5, (c) => [c, 6]); //  0-4   left arm, upper row, heading right
  run(5, 0, (r) => [6, r]); //  5-10  up the left side of the top arm
  cells.push([7, 0]); //        11    across the top
  run(0, 5, (r) => [8, r]); //  12-17 down the right side of the top arm
  run(9, 14, (c) => [c, 6]); // 18-23 right arm, upper row
  cells.push([14, 7]); //       24    around the right tip
  run(14, 9, (c) => [c, 8]); // 25-30 right arm, lower row, heading back
  run(9, 14, (r) => [8, r]); // 31-36 down the right side of the bottom arm
  cells.push([7, 14]); //       37    across the bottom
  run(14, 9, (r) => [6, r]); // 38-43 up the left side of the bottom arm
  run(5, 0, (c) => [c, 8]); //  44-49 left arm, lower row, heading left
  cells.push([0, 7]); //        50    around the left tip
  cells.push([0, 6]); //        51    back to just before red's start

  return cells;
}

/** The five home-column cells for each corner, running inward, followed by
 * the centre. Corner order matches the track: 0 red, 1 green, 2 yellow,
 * 3 blue — the same order the start squares appear in. */
export const HOME_CELLS = [
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [7, 7]],
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 7]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [7, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 7]],
];

/** Each corner's 6x6 yard block, as [col, row] of its top-left cell. */
export const YARD_BLOCKS = [
  [0, 0],
  [9, 0],
  [9, 9],
  [0, 9],
];

/** The four parking spots inside a yard, relative to the yard's top-left. */
const YARD_SPOTS = [
  [1.5, 1.5],
  [3.5, 1.5],
  [1.5, 3.5],
  [3.5, 3.5],
];

/** Which corner (0-3) a seat occupies. Derived from its start square, so it
 * follows whatever boardConfig decided — two players get opposite corners. */
export function cornerOfSeat(config, seat) {
  return config.starts[seat] / 13;
}

export function yardSpot(config, seat, tokenIndex) {
  const [col, row] = YARD_BLOCKS[cornerOfSeat(config, seat)];
  const [dc, dr] = YARD_SPOTS[tokenIndex % YARD_SPOTS.length];
  return { col: col + dc, row: row + dr };
}

/** Grid position of a token, from its relative position. Returns grid
 * coordinates (0..15), which the painter scales to pixels. */
export function cellOf(config, seat, pos, tokenIndex) {
  if (pos < 0) return yardSpot(config, seat, tokenIndex);
  if (pos < config.trackLen) {
    const index = (config.starts[seat] + pos) % config.trackLen;
    const [col, row] = TRACK_CELLS[index];
    return { col: col + 0.5, row: row + 0.5 };
  }
  const corner = cornerOfSeat(config, seat);
  const step = Math.min(pos - config.trackLen, HOME_CELLS[corner].length - 1);
  const [col, row] = HOME_CELLS[corner][step];
  return { col: col + 0.5, row: row + 0.5 };
}
