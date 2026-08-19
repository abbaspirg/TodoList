// Board painting entry point. Picks the classic cross board for two to four
// players and the generated ring for five or more, and owns the hit targets
// a tap is tested against.
import { paintClassic, unitPointClassic } from "./render-classic.js";
import { paintPolygon, unitPointPolygon } from "./render-polygon.js";
import { GRID } from "./board-classic.js";

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
 *
 * `override` moves one token to an arbitrary point instead of its stored
 * square — that is how the step-by-step move animation is drawn without the
 * animation having to touch the game state.
 *
 * @returns the token hit targets in canvas pixels.
 */
export function drawBoard(canvas, state, options = {}) {
  const { isDark = false, selectable = [], mySeat = null, override = null } = options;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const size = Math.min(canvas.clientWidth, canvas.clientHeight);

  // A canvas inside a hidden (or not-yet-laid-out) element measures zero,
  // and drawing into it silently produces nothing. Rather than paint a
  // blank board, wait for the next frame and try again.
  if (size === 0) {
    requestAnimationFrame(() => drawBoard(canvas, state, options));
    return lastTargets;
  }

  if (canvas.width !== Math.round(size * dpr)) {
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);

  const paintOptions = { isDark, selectable, mySeat, override: toPainterOverride(state, override, size) };
  lastTargets = state.classic
    ? paintClassic(ctx, size, state, paintOptions)
    : paintPolygon(ctx, size, state, paintOptions);
  return lastTargets;
}

/** The animator works in unit (0..1) space so it doesn't care which board is
 * on screen; each painter wants its own coordinates. */
function toPainterOverride(state, override, size) {
  if (!override) return null;
  const lift = (override.lift ?? 0) * size;
  return state.classic
    ? { ...override, lift, cell: { col: override.point.x * GRID, row: override.point.y * GRID } }
    : { ...override, lift };
}

/** Where a token sits in unit (0..1) coordinates — what the move animation
 * tweens between. */
export function tokenUnitPoint(state, seat, pos, tokenIndex) {
  return state.classic
    ? unitPointClassic(state, seat, pos, tokenIndex)
    : unitPointPolygon(state, seat, pos, tokenIndex);
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
