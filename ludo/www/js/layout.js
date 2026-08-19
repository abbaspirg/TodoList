// Board geometry, derived from the player count — pure maths, no canvas.
//
// The classic Ludo board is a cross with four arms, which is exactly why it
// cannot seat seven. This lays the same game out as a ring: `trackLen` cells
// around a circle, one yard and one home column per player. Two players or
// eight, the geometry falls out of the same formulas, and at four players
// the ring carries the classic 52 cells.
//
// Everything is returned in a unit square (0..1 on both axes) so the
// renderer can scale it to whatever canvas the device gives it without any
// of this code knowing the pixel size.
import { startSquare, HOME_LEN, TOKENS_PER_PLAYER } from "./game.js";

// Radii in unit space. The yard sits furthest out, so its half-DIAGONAL —
// the box is axis-aligned but positioned radially, so a corner is what
// reaches furthest — has to stay inside 0.5 or the corner yards clip
// against the edge of the canvas.
const RING_RADIUS = 0.345;
const YARD_RADIUS = 0.425;
const HOME_INNER = 0.085;
const HOME_OUTER = 0.29;

/** Angle of a ring cell. Cell 0 sits at the top and the track runs
 * clockwise, which is the direction Ludo is played. */
function ringAngle(config, cell) {
  return -Math.PI / 2 + (2 * Math.PI * cell) / config.trackLen;
}

function polar(radius, angle) {
  return { x: 0.5 + radius * Math.cos(angle), y: 0.5 + radius * Math.sin(angle) };
}

export function boardLayout(config) {
  const ring = [];
  for (let cell = 0; cell < config.trackLen; cell++) {
    ring.push(polar(RING_RADIUS, ringAngle(config, cell)));
  }

  const home = {};
  const yards = {};
  const yardCentres = {};

  for (let seat = 0; seat < config.seats; seat++) {
    // The home column runs inward on the radius *between* the last cell of
    // the lap and this seat's start cell — the gap a token turns into once
    // it has been all the way round, exactly as on a classic board.
    const entryAngle = ringAngle(config, startSquare(config, seat) - 0.5);
    const column = [];
    for (let step = 0; step < HOME_LEN; step++) {
      // The final cell of every column lands on a small shared inner
      // circle, so each seat gets its own visible "home" spot rather than
      // all of them stacking in the middle.
      const t = step / (HOME_LEN - 1);
      column.push(polar(HOME_OUTER - t * (HOME_OUTER - HOME_INNER), entryAngle));
    }
    home[seat] = column;

    // The yard sits outside the ring by this seat's own start cell, so it
    // is obvious at a glance whose corner is whose.
    const yardAngle = ringAngle(config, startSquare(config, seat));
    const centre = polar(YARD_RADIUS, yardAngle);
    yardCentres[seat] = centre;
    const spread = cellRadius(config) * 1.15;
    yards[seat] = [
      { x: centre.x - spread, y: centre.y - spread },
      { x: centre.x + spread, y: centre.y - spread },
      { x: centre.x - spread, y: centre.y + spread },
      { x: centre.x + spread, y: centre.y + spread },
    ];
  }

  return { ring, home, yards, yardCentres, centre: { x: 0.5, y: 0.5 }, config };
}

/** Cell radius in unit space. Derived from how many cells have to fit
 * around the ring, so a 91-cell eight-player board draws smaller cells
 * rather than overlapping ones. */
export function cellRadius(config) {
  const circumferenceStep = (2 * Math.PI * RING_RADIUS) / config.trackLen;
  return Math.min(0.030, circumferenceStep * 0.46);
}

/** Where one token sits, given its relative position. `stackIndex` and
 * `stackCount` fan tokens out when several share a cell, so four tokens on
 * one square read as four rather than one. */
export function tokenPoint(layout, seat, pos, tokenIndex, stackIndex = 0, stackCount = 1) {
  const { config } = layout;
  let base;
  if (pos < 0) {
    base = layout.yards[seat][tokenIndex % TOKENS_PER_PLAYER];
    return base;
  }
  if (pos < config.trackLen) {
    const cell = (startSquare(config, seat) + pos) % config.trackLen;
    base = layout.ring[cell];
  } else {
    base = layout.home[seat][Math.min(pos - config.trackLen, HOME_LEN - 1)];
  }

  if (stackCount <= 1) return base;
  const spread = cellRadius(config) * 0.55;
  const angle = (2 * Math.PI * stackIndex) / stackCount;
  return { x: base.x + spread * Math.cos(angle), y: base.y + spread * Math.sin(angle) };
}

/** Groups every token on the board by the cell it occupies, so the renderer
 * can fan out stacks and the tap handler knows what is where. Yard tokens
 * are keyed individually — they already have their own slots. */
export function tokenPlacements(layout, state) {
  const { config } = layout;
  const byCell = new Map();
  const placements = [];

  for (let seat = 0; seat < config.seats; seat++) {
    for (let i = 0; i < state.tokens[seat].length; i++) {
      const pos = state.tokens[seat][i];
      const key =
        pos < 0
          ? `yard-${seat}-${i}`
          : pos < config.trackLen
            ? `ring-${(startSquare(config, seat) + pos) % config.trackLen}`
            : `home-${seat}-${pos}`;
      if (!byCell.has(key)) byCell.set(key, []);
      byCell.get(key).push({ seat, tokenIndex: i, pos });
    }
  }

  for (const group of byCell.values()) {
    group.forEach((token, index) => {
      placements.push({
        ...token,
        point: tokenPoint(layout, token.seat, token.pos, token.tokenIndex, index, group.length),
      });
    });
  }
  return placements;
}
