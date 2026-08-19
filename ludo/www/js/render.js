// Canvas painter for the ring board. Reads a game state and a layout and
// draws; it holds no state of its own beyond the last frame's token
// positions, which the tap handler uses for hit testing.
import { boardLayout, cellRadius, tokenPlacements } from "./layout.js";
import { seatColor } from "./colors.js";
import { safeSquares, startSquare, HOME_LEN } from "./game.js";

const THEMES = {
  light: { board: "#f2f5f4", cell: "#ffffff", cellEdge: "#d8e0dc", ink: "#1c2521", faint: "#8c9a94" },
  dark: { board: "#121a17", cell: "#1d2723", cellEdge: "#2f3c37", ink: "#eaf1ee", faint: "#7f918a" },
};

function theme(isDark) {
  return isDark ? THEMES.dark : THEMES.light;
}

// The tap targets from the most recent successful paint. Held here rather
// than returned to the caller alone, because a paint can be deferred to the
// next frame (see the zero-size guard below) and the deferred one must
// still update what a tap hits.
let lastTargets = [];

export function getHitTargets() {
  return lastTargets;
}

/**
 * Draws one frame.
 * @returns {Array} the token hit targets in canvas pixels, for tap handling.
 */
export function drawBoard(canvas, state, { isDark = false, selectable = [], mySeat = null } = {}) {
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const size = Math.min(canvas.clientWidth, canvas.clientHeight);

  // A canvas inside a hidden (or not-yet-laid-out) element measures zero,
  // and drawing into it silently produces nothing. Rather than paint a
  // blank board, wait for the next frame and try again.
  if (size === 0) {
    requestAnimationFrame(() => drawBoard(canvas, state, { isDark, selectable, mySeat }));
    return lastTargets;
  }

  if (canvas.width !== Math.round(size * dpr)) {
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const t = theme(isDark);
  const layout = boardLayout(state);
  const r = cellRadius(state) * size;
  const px = (p) => ({ x: p.x * size, y: p.y * size });

  ctx.fillStyle = t.board;
  ctx.fillRect(0, 0, size, size);

  const safe = safeSquares(state);
  const startCells = new Map();
  for (let seat = 0; seat < state.seats; seat++) startCells.set(startSquare(state, seat), seat);

  // --- The ring ------------------------------------------------------
  for (let cell = 0; cell < state.trackLen; cell++) {
    const p = px(layout.ring[cell]);
    const owner = startCells.get(cell);
    if (owner !== undefined) {
      // A seat's start cell, in that seat's colour — the square a token
      // steps onto when it leaves the yard.
      fillCircle(ctx, p, r, seatColor(owner).hex);
      strokeCircle(ctx, p, r, shade(seatColor(owner).hex, -0.25), 2);
    } else if (safe.has(cell)) {
      fillCircle(ctx, p, r, t.cell);
      strokeCircle(ctx, p, r, t.faint, 2);
      drawStar(ctx, p, r * 0.55, t.faint);
    } else {
      fillCircle(ctx, p, r, t.cell);
      strokeCircle(ctx, p, r, t.cellEdge, 1);
    }
  }

  // --- Home columns --------------------------------------------------
  for (let seat = 0; seat < state.seats; seat++) {
    const color = seatColor(seat);
    const column = layout.home[seat];
    ctx.save();
    ctx.strokeStyle = withAlpha(color.hex, 0.35);
    ctx.lineWidth = r * 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    const first = px(column[0]);
    const last = px(column[HOME_LEN - 1]);
    ctx.moveTo(first.x, first.y);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();

    // Home-column cells are drawn as faint, smaller SLOTS, not as solid
    // discs: at token size and token opacity they were indistinguishable
    // from actual tokens sitting in the column, so a six-cell column read
    // as six tokens.
    column.forEach((point, index) => {
      const p = px(point);
      const isCentre = index === HOME_LEN - 1;
      if (isCentre) {
        fillCircle(ctx, p, r * 1.2, color.hex);
        strokeCircle(ctx, p, r * 1.2, shade(color.hex, -0.35), 2);
      } else {
        fillCircle(ctx, p, r * 0.6, withAlpha(color.hex, 0.3));
        strokeCircle(ctx, p, r * 0.6, withAlpha(color.hex, 0.55), 1);
      }
    });
  }

  // --- Yards ---------------------------------------------------------
  for (let seat = 0; seat < state.seats; seat++) {
    const color = seatColor(seat);
    const centre = px(layout.yardCentres[seat]);
    const boxSize = r * 3.4;
    roundRect(ctx, centre.x - boxSize / 2, centre.y - boxSize / 2, boxSize, boxSize, r * 0.8);
    ctx.fillStyle = withAlpha(color.hex, state.turn === seat ? 0.42 : 0.2);
    ctx.fill();
    ctx.strokeStyle = state.turn === seat ? color.hex : withAlpha(color.hex, 0.5);
    ctx.lineWidth = state.turn === seat ? 3 : 1.5;
    ctx.stroke();

    // Seat number, so colour is never the only way to tell players apart.
    // Drawn as a watermark inside the yard rather than as a label outside
    // it — outside, the yards nearest the canvas edge had their labels
    // clipped off.
    ctx.fillStyle = withAlpha(t.ink, 0.32);
    ctx.font = `800 ${Math.max(11, boxSize * 0.62)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(seat + 1), centre.x, centre.y);
  }

  // --- Tokens --------------------------------------------------------
  const selectableSet = new Set(selectable);
  const hitTargets = [];
  for (const placement of tokenPlacements(layout, state)) {
    const p = px(placement.point);
    const color = seatColor(placement.seat);
    const isMine = placement.seat === state.turn;
    const canMove = isMine && selectableSet.has(placement.tokenIndex);
    const radius = r * 0.78;

    if (canMove) {
      // A soft halo marks exactly which tokens this roll can play, so a
      // player never has to guess and tap around to find out.
      fillCircle(ctx, p, radius * 1.7, withAlpha(color.hex, 0.3));
    }
    fillCircle(ctx, p, radius, color.hex);
    strokeCircle(ctx, p, radius, canMove ? t.ink : shade(color.hex, -0.35), canMove ? 2.5 : 1.5);

    if (placement.seat === mySeat) {
      // A white pip marks your own tokens at a glance in a seven-player game.
      fillCircle(ctx, p, radius * 0.32, color.ink);
    }

    hitTargets.push({ ...placement, x: p.x, y: p.y, radius: Math.max(radius * 1.8, 16) });
  }

  lastTargets = hitTargets;
  return hitTargets;
}

function fillCircle(ctx, p, radius, fill) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function strokeCircle(ctx, p, radius, stroke, width) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawStar(ctx, p, radius, fill) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? radius : radius * 0.45;
    const x = p.x + rad * Math.cos(angle);
    const y = p.y + rad * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function shade(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const adjust = (c) =>
    Math.max(0, Math.min(255, Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))));
  return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`;
}

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** Finds the token under a tap. Returns null when the tap missed
 * everything, so a stray tap on the board does nothing. */
export function hitTest(targets, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const target of targets) {
    const distance = Math.hypot(target.x - x, target.y - y);
    if (distance <= target.radius && distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }
  return best;
}
