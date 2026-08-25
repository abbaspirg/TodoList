// Painter for the classic cross board (2-4 players).
import {
  GRID,
  TRACK_CELLS,
  HOME_CELLS,
  YARD_BLOCKS,
  cornerOfSeat,
  cellOf,
} from "./board-classic.js";
import { CLASSIC_COLORS } from "./colors.js";
import { safeSquares, startSquare } from "./game.js";
import {
  fillCircle,
  strokeCircle,
  roundRect,
  drawStar,
  drawArrow,
  drawToken,
  withAlpha,
  shade,
} from "./render-util.js";

// Which way a token faces when it steps out of each corner's yard.
const ENTRY_DIRECTION = ["right", "down", "left", "up"];

const THEME = {
  light: { paper: "#ffffff", line: "#c9d2ce", idle: "#b9c4bf", ink: "#33413b" },
  dark: { paper: "#e8ece9", line: "#a9b4af", idle: "#9aa5a0", ink: "#2a3630" },
};

/**
 * @returns tap targets in canvas pixels.
 */
export function paintClassic(ctx, size, state, { isDark, selectable, mySeat, override }) {
  const t = isDark ? THEME.dark : THEME.light;
  const cell = size / GRID;
  const px = (gridCoord) => gridCoord * cell;

  // Which corners are actually in play; the rest are drawn greyed so the
  // board still looks like a board with two or three players.
  const cornerSeat = new Map();
  for (let seat = 0; seat < state.seats; seat++) cornerSeat.set(cornerOfSeat(state, seat), seat);
  const cornerColor = (corner) => (cornerSeat.has(corner) ? CLASSIC_COLORS[corner] : { hex: t.idle, ink: "#fff" });

  // --- Paper ---------------------------------------------------------
  ctx.fillStyle = t.paper;
  roundRect(ctx, 0, 0, size, size, cell * 0.5);
  ctx.fill();

  // --- Corner yards --------------------------------------------------
  for (let corner = 0; corner < 4; corner++) {
    const [col, row] = YARD_BLOCKS[corner];
    const color = cornerColor(corner);
    ctx.fillStyle = color.hex;
    roundRect(ctx, px(col), px(row), cell * 6, cell * 6, cell * 0.5);
    ctx.fill();

    // The white inner box that the four pieces park in.
    ctx.fillStyle = t.paper;
    roundRect(ctx, px(col + 0.9), px(row + 0.9), cell * 4.2, cell * 4.2, cell * 0.35);
    ctx.fill();

    for (const [dc, dr] of [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]]) {
      strokeCircle(ctx, px(col + dc), px(row + dr), cell * 0.52, withAlpha(color.hex, 0.75), cell * 0.13);
    }
  }

  // --- Track cells ---------------------------------------------------
  const safe = safeSquares(state);
  const startIndex = new Map();
  for (let seat = 0; seat < state.seats; seat++) startIndex.set(startSquare(state, seat), seat);

  ctx.lineWidth = Math.max(1, cell * 0.06);
  ctx.strokeStyle = t.line;

  TRACK_CELLS.forEach(([col, row], index) => {
    const owner = startIndex.get(index);
    const corner = index / 13;
    // A start cell takes its corner's colour; everything else is paper.
    const isStart = Number.isInteger(corner) && corner < 4;
    ctx.fillStyle = isStart ? cornerColor(corner).hex : t.paper;
    ctx.fillRect(px(col), px(row), cell, cell);
    ctx.strokeRect(px(col), px(row), cell, cell);

    if (isStart) {
      drawArrow(
        ctx,
        px(col + 0.5),
        px(row + 0.5),
        cell * 0.26,
        ENTRY_DIRECTION[corner],
        withAlpha("#ffffff", owner === undefined ? 0.5 : 0.95),
      );
    } else if (safe.has(index)) {
      drawStar(ctx, px(col + 0.5), px(row + 0.5), cell * 0.34, withAlpha(t.ink, 0.45));
    }
  });

  // --- Home columns --------------------------------------------------
  for (let corner = 0; corner < 4; corner++) {
    const color = cornerColor(corner);
    // The last entry is the centre, drawn separately below.
    for (const [col, row] of HOME_CELLS[corner].slice(0, -1)) {
      ctx.fillStyle = color.hex;
      ctx.fillRect(px(col), px(row), cell, cell);
      ctx.strokeStyle = withAlpha("#ffffff", 0.55);
      ctx.strokeRect(px(col), px(row), cell, cell);
    }
  }

  // --- Centre --------------------------------------------------------
  // Four triangles meeting in the middle, one per corner — the home
  // everyone is racing into.
  const c0 = px(6);
  const c1 = px(9);
  const mid = px(7.5);
  const corners = [
    [[c0, c0], [c0, c1]], // left  -> red
    [[c0, c0], [c1, c0]], // top   -> green
    [[c1, c0], [c1, c1]], // right -> yellow
    [[c1, c1], [c0, c1]], // bottom-> blue
  ];
  // The triangle that points at a corner's home column is the one on that
  // corner's side of the centre.
  const triangleForCorner = [0, 1, 2, 3];
  triangleForCorner.forEach((triangle, corner) => {
    const [[ax, ay], [bx, by]] = corners[triangle];
    ctx.beginPath();
    ctx.moveTo(mid, mid);
    ctx.lineTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.closePath();
    ctx.fillStyle = cornerColor(corner).hex;
    ctx.fill();
    ctx.strokeStyle = withAlpha("#ffffff", 0.6);
    ctx.lineWidth = Math.max(1, cell * 0.05);
    ctx.stroke();
  });

  // --- Tokens --------------------------------------------------------
  return paintTokens(ctx, state, { cell, px, selectable, mySeat, override });
}

function paintTokens(ctx, state, { cell, px, selectable, mySeat, override }) {
  const selectableSet = new Set(selectable);
  const targets = [];

  // Group by cell so several pieces on one square fan out instead of
  // hiding each other.
  const groups = new Map();
  for (let seat = 0; seat < state.seats; seat++) {
    for (let i = 0; i < state.tokens[seat].length; i++) {
      const pos = state.tokens[seat][i];
      const isOverridden = override && override.seat === seat && override.tokenIndex === i;
      const spot = isOverridden ? override.cell : cellOf(state, seat, pos, i);
      const key = isOverridden ? `moving-${seat}-${i}` : `${spot.col.toFixed(2)},${spot.row.toFixed(2)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ seat, tokenIndex: i, pos, spot, moving: isOverridden });
    }
  }

  for (const group of groups.values()) {
    group.forEach((token, indexInGroup) => {
      const spread = group.length > 1 ? cell * 0.2 : 0;
      const angle = (2 * Math.PI * indexInGroup) / Math.max(group.length, 1);
      const x = px(token.spot.col) + spread * Math.cos(angle);
      const y = px(token.spot.row) + spread * Math.sin(angle);
      const radius = cell * (group.length > 2 ? 0.32 : 0.38);
      const color = CLASSIC_COLORS[cornerOfSeat(state, token.seat)];

      drawToken(ctx, x, y, radius, color.hex, {
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
        radius: Math.max(radius * 1.7, 18),
      });
    });
  }
  return targets;
}

/** Where a token sits, in unit (0..1) coordinates — what the move animation
 * tweens between. */
export function unitPointClassic(state, seat, pos, tokenIndex) {
  const spot = cellOf(state, seat, pos, tokenIndex);
  return { x: spot.col / GRID, y: spot.row / GRID };
}
