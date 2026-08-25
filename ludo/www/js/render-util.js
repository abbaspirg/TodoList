// Canvas drawing helpers shared by both board painters.

export function fillCircle(ctx, x, y, radius, fill) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokeCircle(ctx, x, y, radius, stroke, width) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function drawStar(ctx, x, y, radius, fill, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 === 0 ? radius : radius * 0.44;
    const px = x + r * Math.cos(angle);
    const py = y + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A triangle pointing somewhere, used for the arrows on the entry squares.
 * `direction` is either one of four compass names (the cross board, whose
 * arms are axis-aligned) or an angle in radians (the polygon board, whose
 * arms point every which way). */
export function drawArrow(ctx, x, y, size, direction, fill) {
  const angle =
    typeof direction === "number"
      ? direction
      : ({ right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[direction] ?? 0);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.7, size * 0.75);
  ctx.lineTo(-size * 0.7, -size * 0.75);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

/** One playing piece. Drawn with a dark rim, a lighter top and a highlight
 * so it reads as a physical counter rather than a flat dot — at 20-odd
 * pixels on a phone that shading is most of what makes it look like a game
 * rather than a diagram. */
export function drawToken(ctx, x, y, radius, color, { mine = false, highlight = false, lift = 0 } = {}) {
  if (lift > 0) {
    // A soft shadow underneath, offset by how far the piece is "lifted" —
    // what makes a moving token look like it is hopping between squares.
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.filter = "blur(1px)";
    fillCircle(ctx, x, y + lift * 0.9 + radius * 0.35, radius * 0.85, "#000");
    ctx.restore();
  }

  if (highlight) {
    fillCircle(ctx, x, y, radius * 1.75, withAlpha(color, 0.32));
    strokeCircle(ctx, x, y, radius * 1.75, withAlpha(color, 0.6), 2);
  }

  fillCircle(ctx, x, y, radius, shade(color, -0.35));
  fillCircle(ctx, x, y, radius * 0.86, color);

  // Glossy top-left highlight.
  ctx.save();
  ctx.beginPath();
  ctx.arc(x - radius * 0.22, y - radius * 0.28, radius * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha("#ffffff", 0.42);
  ctx.fill();
  ctx.restore();

  if (mine) {
    fillCircle(ctx, x, y, radius * 0.3, "#ffffff");
    strokeCircle(ctx, x, y, radius * 0.3, withAlpha("#000000", 0.25), 1);
  }
}

export function withAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function shade(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const adjust = (c) =>
    Math.max(0, Math.min(255, Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))));
  return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`;
}

export function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}
