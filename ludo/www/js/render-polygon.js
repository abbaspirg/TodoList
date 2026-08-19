// Painter for the polygon board (5-8 players) — the shape a real
// seven-player Ludo board uses: a triangular yard per player around the
// rim, three radial lanes per arm, and a coloured wedge at the centre.
import {
  polygonLayout,
  cellAt,
  trackCell,
  homeCell,
  armOfSeat,
  yardTriangle,
  yardSpots,
  boardOutline,
  centreWedge,
  tokenPointPolygon,
} from "./layout-polygon.js";
import { seatColor } from "./colors.js";
import { safeSquares, startSquare, laneLength } from "./game.js";
import { fillCircle, strokeCircle, drawStar, drawArrow, drawToken, withAlpha, shade } from "./render-util.js";

const THEME = {
  light: { paper: "#ffffff", line: "#c9d2ce", ink: "#33413b", rim: "#eef2f0" },
  dark: { paper: "#e8ece9", line: "#a9b4af", ink: "#2a3630", rim: "#dbe2de" },
};

export function paintPolygon(ctx, size, state, { isDark, selectable, mySeat, override }) {
  const t = isDark ? THEME.dark : THEME.light;
  const layout = polygonLayout(state);
  const lane = laneLength(state);
  const px = (p) => ({ x: p.x * size, y: p.y * size });

  // --- The board itself ----------------------------------------------
  // One solid polygon with a flat edge per player, so it reads as a board
  // rather than a scattering of cells.
  ctx.beginPath();
  boardOutline(state, layout)
    .map(px)
    .forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = t.paper;
  ctx.fill();
  ctx.strokeStyle = t.line;
  ctx.lineWidth = Math.max(1, size * 0.005);
  ctx.stroke();

  // --- Track cells ---------------------------------------------------
  const safe = safeSquares(state);
  const startOf = new Map();
  for (let seat = 0; seat < state.seats; seat++) startOf.set(startSquare(state, seat), seat);

  for (let index = 0; index < state.trackLen; index++) {
    const { arm, laneOffset, ring } = trackCell(state, layout, index);
    const cell = cellAt(state, layout, arm, laneOffset, ring);
    const owner = startOf.get(index);
    const color = owner !== undefined ? seatColor(owner) : null;

    drawCell(ctx, size, cell, {
      fill: color ? color.hex : t.paper,
      stroke: t.line,
    });

    if (color) {
      // The entry square points the way out of the yard.
      drawArrow(
        ctx,
        cell.x * size,
        cell.y * size,
        cell.height * size * 0.26,
        // A piece leaves the yard heading inward along its own arm, so the
        // arrow points at the centre rather than in a fixed compass
        // direction the way it can on the axis-aligned cross.
        cell.angle + Math.PI,
        withAlpha("#ffffff", 0.95),
      );
    } else if (safe.has(index)) {
      drawStar(ctx, cell.x * size, cell.y * size, cell.height * size * 0.3, withAlpha(t.ink, 0.42));
    }
  }

  // --- Home columns --------------------------------------------------
  for (let seat = 0; seat < state.seats; seat++) {
    const color = seatColor(seat);
    for (let step = 0; step < state.homeLen - 1; step++) {
      const { arm, laneOffset, ring } = homeCell(state, layout, seat, step);
      drawCell(ctx, size, cellAt(state, layout, arm, laneOffset, ring), {
        fill: color.hex,
        stroke: withAlpha("#ffffff", 0.6),
      });
    }
  }

  // --- Centre --------------------------------------------------------
  for (let seat = 0; seat < state.seats; seat++) {
    const wedge = centreWedge(state, layout, armOfSeat(state, seat));
    const c = px(wedge.centre);
    const a = px(wedge.a);
    const b = px(wedge.b);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.closePath();
    ctx.fillStyle = seatColor(seat).hex;
    ctx.fill();
    ctx.strokeStyle = withAlpha("#ffffff", 0.65);
    ctx.lineWidth = Math.max(1, size * 0.004);
    ctx.stroke();
  }

  // --- Yards ---------------------------------------------------------
  for (let seat = 0; seat < state.seats; seat++) {
    const arm = armOfSeat(state, seat);
    const color = seatColor(seat);
    const [left, tip, right] = yardTriangle(state, layout, arm).map(px);

    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.lineTo(right.x, right.y);
    ctx.closePath();
    ctx.fillStyle = color.hex;
    ctx.fill();
    ctx.lineWidth = Math.max(2, size * 0.006);
    ctx.strokeStyle = state.turn === seat ? "#ffffff" : shade(color.hex, -0.3);
    ctx.stroke();

    // The four parking rings inside the triangle.
    for (const spot of yardSpots(state, layout, arm)) {
      const p = px(spot);
      strokeCircle(ctx, p.x, p.y, layout.step * size * 0.32, withAlpha("#ffffff", 0.85), size * 0.006);
    }
  }

  // --- Tokens --------------------------------------------------------
  const selectableSet = new Set(selectable);
  const targets = [];
  const groups = new Map();

  for (let seat = 0; seat < state.seats; seat++) {
    for (let i = 0; i < state.tokens[seat].length; i++) {
      const pos = state.tokens[seat][i];
      const moving = override && override.seat === seat && override.tokenIndex === i;
      const key = moving
        ? `moving-${seat}-${i}`
        : pos < 0
          ? `yard-${seat}-${i}`
          : pos < state.trackLen
            ? `track-${(startSquare(state, seat) + pos) % state.trackLen}`
            : `home-${seat}-${pos}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ seat, tokenIndex: i, pos, moving });
    }
  }

  const radius = layout.step * size * 0.36;
  for (const group of groups.values()) {
    group.forEach((token, indexInGroup) => {
      const base = token.moving
        ? override.point
        : tokenPointPolygon(state, token.seat, token.pos, token.tokenIndex);
      const spread = group.length > 1 ? radius * 0.55 : 0;
      const angle = (2 * Math.PI * indexInGroup) / Math.max(group.length, 1);
      const x = base.x * size + spread * Math.cos(angle);
      const y = base.y * size + spread * Math.sin(angle);

      drawToken(ctx, x, y, group.length > 2 ? radius * 0.85 : radius, seatColor(token.seat).hex, {
        mine: token.seat === mySeat,
        highlight: token.seat === state.turn && selectableSet.has(token.tokenIndex) && !token.moving,
        lift: token.moving ? override.lift ?? 0 : 0,
      });

      targets.push({
        seat: token.seat,
        tokenIndex: token.tokenIndex,
        pos: token.pos,
        x,
        y,
        radius: Math.max(radius * 1.9, 17),
      });
    });
  }
  return targets;
}

/** One trapezoidal cell, rotated to face the centre. Drawn as a rounded
 * rect in the cell's own rotated frame — close enough to a trapezoid at
 * this size, and far cheaper than four-point path maths per cell. */
function drawCell(ctx, size, cell, { fill, stroke }) {
  const w = cell.width * size;
  const h = cell.height * size;
  ctx.save();
  ctx.translate(cell.x * size, cell.y * size);
  ctx.rotate(cell.angle + Math.PI / 2);
  ctx.beginPath();
  const r = Math.min(w, h) * 0.22;
  ctx.moveTo(-w / 2 + r, -h / 2);
  ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r);
  ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r);
  ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r);
  ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(1, size * 0.0035);
  ctx.stroke();
  ctx.restore();
}

export { tokenPointPolygon as unitPointPolygon };
