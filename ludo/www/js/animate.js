// Move and dice animation.
//
// The game state that arrives from Firestore is a snapshot: a token was on
// square 7, now it is on square 12. Drawing that directly makes pieces
// teleport. This replays the difference — hopping the piece one square at a
// time, with a tick for each — so a six looks like six steps.
//
// It never touches the game state. The animation is a drawing override
// handed to render.js, so a snapshot arriving mid-animation simply ends it
// and the true board is drawn.
import { drawBoard, tokenUnitPoint } from "./render.js";
import { sounds } from "./sound.js";

const STEP_MS = 135;
const HOP_HEIGHT = 0.02; // in unit board coordinates

let running = null;

export function isAnimating() {
  return running !== null;
}

export function cancelAnimation() {
  if (!running) return;
  cancelAnimationFrame(running.frame);
  running = null;
}

/**
 * Walks a token from `fromPos` to `toPos`, redrawing each frame.
 *
 * @returns a promise that resolves when the walk finishes (or is cancelled),
 *   so the caller can play the arrival sound at the right moment.
 */
export function animateMove(canvas, state, { seat, tokenIndex, fromPos, toPos, drawOptions }) {
  cancelAnimation();

  // Leaving the yard is one hop, not a walk around the board.
  const path = [];
  if (fromPos < 0) {
    path.push(0);
  } else {
    for (let pos = fromPos + 1; pos <= toPos; pos++) path.push(pos);
  }
  if (path.length === 0) return Promise.resolve();

  const startPoint = tokenUnitPoint(state, seat, fromPos, tokenIndex);
  const points = [startPoint, ...path.map((pos) => tokenUnitPoint(state, seat, pos, tokenIndex))];
  const totalMs = STEP_MS * path.length;

  return new Promise((resolve) => {
    // The clock starts on the FIRST frame, not here. requestAnimationFrame
    // reports the timestamp of the frame it belongs to, which can be
    // earlier than a performance.now() taken while scheduling it — that
    // produced a negative elapsed time, a negative step index, and an
    // exception on the very first frame of every move.
    let startedAt = null;
    let lastStepPlayed = -1;

    const frame = (time) => {
      if (!running) return resolve(); // cancelled by a newer snapshot
      if (startedAt === null) startedAt = time;
      const elapsed = time - startedAt;
      const progress = Math.min(1, Math.max(0, elapsed / totalMs));
      const exact = progress * path.length;
      const index = Math.min(path.length - 1, Math.max(0, Math.floor(exact)));
      const withinStep = exact - index;

      if (index > lastStepPlayed) {
        lastStepPlayed = index;
        sounds.step(index);
      }

      const from = points[index];
      const to = points[index + 1];
      const point = {
        x: from.x + (to.x - from.x) * withinStep,
        y: from.y + (to.y - from.y) * withinStep,
      };
      // A little arc between squares, so the piece hops rather than slides.
      const lift = Math.sin(withinStep * Math.PI) * HOP_HEIGHT;

      drawBoard(canvas, state, {
        ...drawOptions,
        override: { seat, tokenIndex, point, lift },
      });

      if (progress >= 1) {
        running = null;
        resolve();
        return;
      }
      running.frame = requestAnimationFrame(frame);
    };

    running = { frame: requestAnimationFrame(frame) };
  });
}

/** Tumbles the die through random faces before settling on the real one.
 * The value is already decided — this only delays showing it. */
export function animateDie(element, finalValue, faces, { duration = 620 } = {}) {
  const startedAt = performance.now();
  element.classList.add("rolling");

  return new Promise((resolve) => {
    const frame = (time) => {
      const elapsed = time - startedAt;
      if (elapsed >= duration) {
        element.textContent = faces[finalValue];
        element.classList.remove("rolling");
        resolve();
        return;
      }
      // Slows down as it settles, like a die losing momentum.
      const interval = 45 + (elapsed / duration) * 110;
      if (Math.floor(elapsed / interval) !== Math.floor((elapsed - 16) / interval)) {
        element.textContent = faces[1 + Math.floor(Math.random() * 6)];
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

/** Works out what changed between two boards, so the right animation and
 * sounds can be played. Returns null when nothing moved. */
export function diffBoards(before, after) {
  if (!before || !after || before.seats !== after.seats) return null;

  let moved = null;
  const captured = [];

  for (let seat = 0; seat < after.seats; seat++) {
    for (let i = 0; i < after.tokens[seat].length; i++) {
      const from = before.tokens[seat][i];
      const to = after.tokens[seat][i];
      if (from === to) continue;
      // A token sent back to its yard is a capture, not a move.
      if (to < 0) captured.push({ seat, tokenIndex: i });
      else moved = { seat, tokenIndex: i, fromPos: from, toPos: to };
    }
  }

  if (!moved && captured.length === 0) return null;
  return {
    moved,
    captured,
    reachedHome: moved ? moved.toPos === after.trackLen + after.homeLen - 1 : false,
    leftYard: moved ? moved.fromPos < 0 : false,
  };
}
