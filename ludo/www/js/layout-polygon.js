// Geometry for the polygon board used by five to eight players.
//
// It is the cross board's structure wrapped into a regular N-gon. Each
// player gets an arm — a wedge of the polygon — laid out exactly like an arm
// of the cross:
//
//        outward lane │ home column │ returning lane
//                     └─── tip ────┘
//
// with a triangular yard at the outer end. Two, three and four players use
// the real cross board instead (js/board-classic.js); this is only for the
// counts a four-armed cross cannot seat.
//
// Cells fan out toward the rim rather than running parallel, because the
// three lanes of an arm have to fit inside a wedge that narrows as it
// approaches the centre. That is also what makes the cells trapezoidal, the
// way they are on a real polygon board.
import { laneLength, startSquare } from "./game.js";

// Tuned so the three bands — centre, lanes, yards — fill the board with no
// dead ring between them, and so the cells stay big enough to tap on a
// phone. Changing one of these means re-checking the others.
const R_INNER = 0.125; // radius of the innermost lane cell
const CELL_STEP = 0.066; // radial distance between lane cells
const R_RIM = 0.47; // the board's outer edge
const YARD_APEX_GAP = 0.45; // gap between the outermost lane cell and the yard's inner point, in cells

export function polygonLayout(config) {
  const lane = laneLength(config);
  return {
    lane,
    seats: config.seats,
    // A third of the arm's angular width per lane, so the three lanes of an
    // arm sit side by side and neighbouring arms never overlap.
    delta: (2 * Math.PI) / config.seats / 3,
    step: CELL_STEP,
    outerRadius: R_INNER + (lane - 1) * CELL_STEP,
    rim: R_RIM,
    // Half the angular width of one arm — the polygon's edges are centred
    // on the arms, so this is also half an edge.
    half: Math.PI / config.seats,
  };
}

/** The board's outline: a regular polygon whose flat edges face outward,
 * one per player, with the corners falling between arms. */
export function boardOutline(config, layout) {
  const points = [];
  for (let arm = 0; arm < config.seats; arm++) {
    points.push(polar(R_RIM / Math.cos(layout.half), armAngle(config, arm) + layout.half));
  }
  return points;
}

/** Direction of the middle of an arm. Arm 0 points straight up. */
export function armAngle(config, arm) {
  return -Math.PI / 2 + (2 * Math.PI * arm) / config.seats;
}

function polar(radius, angle) {
  return { x: 0.5 + radius * Math.cos(angle), y: 0.5 + radius * Math.sin(angle) };
}

/**
 * One cell of the board.
 * @param laneOffset -1 outward lane, 0 middle (tip and home column), +1 returning lane
 * @param ring 0 = innermost, lane-1 = outermost
 */
export function cellAt(config, layout, arm, laneOffset, ring) {
  const angle = armAngle(config, arm) + laneOffset * layout.delta;
  const radius = R_INNER + ring * layout.step;
  return {
    ...polar(radius, angle),
    angle,
    radius,
    // Cells are as wide as their share of the arm at that radius, so they
    // tile the wedge without gaps or overlaps.
    width: radius * layout.delta * 0.94,
    height: layout.step * 0.94,
  };
}

/** Which arm, lane and ring a shared-track cell index falls on.
 *
 * Within an arm the order is: out along the -1 lane, the tip, then back
 * down the +1 lane — the same order a token travels a cross-board arm. */
export function trackCell(config, layout, index) {
  const lane = layout.lane;
  const arm = Math.floor(index / config.seg) % config.seats;
  const offset = index % config.seg;

  if (offset < lane) return { arm, laneOffset: -1, ring: offset };
  if (offset === lane) return { arm, laneOffset: 0, ring: lane - 1 }; // the tip
  return { arm, laneOffset: 1, ring: lane - 1 - (offset - lane - 1) };
}

/** A seat's home column cell, `step` cells in from the rim (0 = first cell
 * entered, which sits just inside the tip). */
export function homeCell(config, layout, seat, step) {
  const arm = armOfSeat(config, seat);
  return { arm, laneOffset: 0, ring: Math.max(0, layout.lane - 2 - step) };
}

/** The arm a seat owns, derived from its start square so the geometry can
 * never disagree with the rules. */
export function armOfSeat(config, seat) {
  return Math.floor(startSquare(config, seat) / config.seg);
}

/** Where a seat's yard begins, measured inward from the rim. */
function yardApex(layout) {
  return layout.outerRadius + YARD_APEX_GAP * layout.step;
}

/** A seat's yard: a triangle sitting on the board's rim with its point
 * aimed at the centre — the shape a real polygon board uses. Returned as
 * [left corner, inner point, right corner]. */
export function yardTriangle(config, layout, arm) {
  const angle = armAngle(config, arm);
  // The base runs along the polygon's flat edge, so it has to reach the
  // edge rather than a circle — hence dividing by cos of the half-angle.
  const spread = layout.half * 0.88;
  const edge = layout.rim / Math.cos(spread);
  return [polar(edge, angle - spread), polar(yardApex(layout), angle), polar(edge, angle + spread)];
}

/** Where the four pieces park inside a yard. Laid out as two rows that
 * narrow toward the point, so they sit inside the taper rather than
 * spilling over the edges. */
export function yardSpots(config, layout, arm) {
  const angle = armAngle(config, arm);
  const apex = yardApex(layout);
  const depth = layout.rim - apex;
  const row = (t, spreadFactor) => {
    const radius = apex + depth * t;
    const spread = layout.half * spreadFactor * t;
    return [polar(radius, angle - spread), polar(radius, angle + spread)];
  };
  return [...row(0.32, 0.58), ...row(0.72, 0.48)];
}

/** The wedge of the centre polygon belonging to one arm — where that
 * player's pieces finish. */
export function centreWedge(config, layout, arm) {
  const angle = armAngle(config, arm);
  const radius = R_INNER - layout.step * 0.35;
  return {
    centre: { x: 0.5, y: 0.5 },
    a: polar(radius / Math.cos(layout.half), angle - layout.half),
    b: polar(radius / Math.cos(layout.half), angle + layout.half),
    mid: polar(radius * 0.58, angle),
    radius,
  };
}

/** Where a token sits, in unit (0..1) coordinates. */
export function tokenPointPolygon(config, seat, pos, tokenIndex) {
  const layout = polygonLayout(config);
  const arm = armOfSeat(config, seat);

  if (pos < 0) {
    const spots = yardSpots(config, layout, arm);
    return spots[tokenIndex % spots.length];
  }
  if (pos < config.trackLen) {
    const index = (startSquare(config, seat) + pos) % config.trackLen;
    const cell = trackCell(config, layout, index);
    return cellAt(config, layout, cell.arm, cell.laneOffset, cell.ring);
  }
  const step = pos - config.trackLen;
  // The last home position is the centre wedge, not a column cell.
  if (step >= config.homeLen - 1) return centreWedge(config, layout, arm).mid;
  const cell = homeCell(config, layout, seat, step);
  return cellAt(config, layout, cell.arm, cell.laneOffset, cell.ring);
}
