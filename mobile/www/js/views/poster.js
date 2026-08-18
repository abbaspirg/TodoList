import { el, mount, initials, toast } from "../util.js";
import { getFestSettings } from "../data.js";
import { FEST_ID } from "../firebase-config.js";
import { isDark as isAppDark } from "../theme.js";

const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };
const MEDAL_COLORS = { 1: "#d4af37", 2: "#b7bcc4", 3: "#c07a3c" };

// Two visual themes the generator can render a poster in — picked up from
// localStorage so the user's last choice sticks across posters.
const THEMES = {
  dark: {
    bgTop: "#0b3d2c",
    bgBottom: "#04120c",
    frame: "rgba(212, 175, 55, 0.55)",
    panel: "rgba(255, 255, 255, 0.08)",
    panelBorder: "rgba(212, 175, 55, 0.55)",
    gold: "#d4af37",
    textPrimary: "#ffffff",
    textSecondary: "rgba(255, 255, 255, 0.72)",
    textMuted: "rgba(255, 255, 255, 0.5)",
  },
  light: {
    bgTop: "#fdf8ea",
    bgBottom: "#f0e4c4",
    frame: "rgba(169, 122, 20, 0.55)",
    panel: "#ffffff",
    panelBorder: "#c9971f",
    gold: "#a97a14",
    textPrimary: "#17301f",
    textSecondary: "rgba(23, 48, 31, 0.72)",
    textMuted: "rgba(23, 48, 31, 0.55)",
  },
};

// Defaults to whichever mode the user hasn't explicitly picked for posters
// yet by following the app-wide theme, rather than always starting dark.
const savedPosterTheme = localStorage.getItem("posterTheme");
let currentTheme =
  savedPosterTheme === "light" || savedPosterTheme === "dark" ? savedPosterTheme : isAppDark() ? "dark" : "light";

// Renders the poster on a <canvas> (photo, name, group, rank, item name,
// fest branding) and offers Download/Share — the web equivalent of the
// widget-to-image approach described in docs/ARCHITECTURE.md §1. Canvas
// export works the same whether this runs in a browser tab or inside the
// Capacitor WebView. Two entry modes: a single-winner poster (`ranking`) or
// a combined top-3 "podium" poster (`rankings`, mode: "top3").
export async function renderPoster() {
  const data = window.__posterData;
  if (!data) {
    mount(el("div", { class: "card empty-state" }, "Open a result's “Poster” button first."));
    return;
  }
  const isTop3 = data.mode === "top3";
  const settings = await getFestSettings(FEST_ID);
  const madrasaName = settings?.madrasaName || "";

  const canvas = el("canvas", { id: "posterCanvas", width: "720", height: isTop3 ? "1000" : "960" });
  const lightBtn = el("button", { class: "btn secondary" }, "☀️ Light");
  const darkBtn = el("button", { class: "btn secondary" }, "🌙 Dark");
  const downloadBtn = el("button", { class: "btn" }, "Download");
  const shareBtn = el("button", { class: "btn secondary" }, "Share");

  mount(
    el("div", {}, [
      el("h1", { class: "page-title" }, isTop3 ? "Winners Poster" : "Poster"),
      el("div", { class: "btn-row", style: "justify-content:center;margin-bottom:12px" }, [lightBtn, darkBtn]),
      canvas,
      el("div", { class: "btn-row", style: "justify-content:center;margin-top:16px" }, [downloadBtn, shareBtn]),
    ]),
  );

  function syncThemeButtons() {
    lightBtn.classList.toggle("active", currentTheme === "light");
    darkBtn.classList.toggle("active", currentTheme === "dark");
  }
  async function redraw() {
    syncThemeButtons();
    const theme = THEMES[currentTheme];
    if (isTop3) await drawTop3Poster(canvas, data.result, data.rankings, theme, madrasaName);
    else await drawPoster(canvas, data.result, data.ranking, theme, madrasaName);
  }
  await redraw();

  lightBtn.addEventListener("click", () => {
    currentTheme = "light";
    localStorage.setItem("posterTheme", "light");
    redraw();
  });
  darkBtn.addEventListener("click", () => {
    currentTheme = "dark";
    localStorage.setItem("posterTheme", "dark");
    redraw();
  });

  const fileName = isTop3 ? `${data.result.itemId}_top3.png` : `${data.result.itemId}_rank${data.ranking.rank}.png`;

  downloadBtn.addEventListener("click", () =>
    runButtonAction(downloadBtn, "Download", "Saving…", () => downloadPoster(canvas, fileName)),
  );
  shareBtn.addEventListener("click", () =>
    runButtonAction(shareBtn, "Share", "Preparing…", () => sharePoster(canvas, fileName, data.result.itemName)),
  );
}

async function runButtonAction(btn, idleLabel, busyLabel, action) {
  btn.disabled = true;
  btn.textContent = busyLabel;
  try {
    await action();
  } catch (err) {
    toast(err?.message || "Something went wrong — please try again.");
  } finally {
    btn.disabled = false;
    btn.textContent = idleLabel;
  }
}

// Plain `<a download>` and the Web Share API don't work inside a Capacitor
// Android WebView (no download-manager/share-sheet integration for
// blob:/data: URLs) — window.CapPlugins (built by `npm run build:plugins`,
// see mobile/plugins-src/capacitor-plugins.js) is only defined when this
// page is running inside the native app, so it doubles as the "are we
// native" check; a plain browser tab (e.g. `npx serve` for local testing)
// falls through to the ordinary web APIs, which do work there.
function isNative() {
  return Boolean(window.CapPlugins?.Capacitor?.isNativePlatform?.());
}

async function canvasToBase64Png(canvas) {
  return canvas.toDataURL("image/png").split(",")[1];
}

async function downloadPoster(canvas, fileName) {
  if (!isNative()) return downloadPosterWeb(canvas, fileName);

  const { Filesystem, Directory } = window.CapPlugins;
  let status = await Filesystem.checkPermissions();
  if (status.publicStorage !== "granted") status = await Filesystem.requestPermissions();
  if (status.publicStorage !== "granted") {
    throw new Error("Storage permission is needed to save the poster.");
  }

  const data = await canvasToBase64Png(canvas);
  await Filesystem.writeFile({ path: fileName, data, directory: Directory.Documents, recursive: true });
  toast("Poster saved to Documents");
}

async function sharePoster(canvas, fileName, title) {
  if (!isNative()) return sharePosterWeb(canvas, fileName, title);

  const { Filesystem, Directory, Share } = window.CapPlugins;
  const data = await canvasToBase64Png(canvas);
  // Directory.Cache needs no runtime permission (unlike Documents), and a
  // share sheet only needs the file to exist long enough to be read once.
  const { uri } = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache, recursive: true });
  await Share.share({ title, files: [uri] });
}

function downloadPosterWeb(canvas, fileName) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Couldn't render the poster image."));
      const url = URL.createObjectURL(blob);
      const a = el("a", { href: url, download: fileName });
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      resolve();
    }, "image/png");
  });
}

function sharePosterWeb(canvas, fileName, title) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("Couldn't render the poster image."));
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title });
          return resolve();
        } catch (err) {
          if (err?.name === "AbortError") return resolve(); // user cancelled
          return reject(err);
        }
      }
      reject(new Error("Sharing isn't supported here — use Download instead."));
    }, "image/png");
  });
}

// ---- Shared drawing helpers -------------------------------------------------

function drawBackground(ctx, w, h, theme) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, theme.bgTop);
  gradient.addColorStop(1, theme.bgBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

// A simple double-line frame gives the canvas a "printed certificate" edge —
// standard on real fest posters — instead of the plain flat rectangle before.
function drawFrame(ctx, w, h, theme) {
  ctx.save();
  ctx.strokeStyle = theme.frame;
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(32, 32, w - 64, h - 64);
  ctx.restore();
}

// `madrasaName`, when set via Admin > Settings, replaces the generic
// "MEELAD FEST" wordmark so the poster carries the actual institution's
// name rather than static app branding.
function drawBrandHeader(ctx, w, theme, topY, madrasaName) {
  ctx.textAlign = "center";
  ctx.font = "44px sans-serif";
  ctx.fillStyle = theme.textPrimary;
  ctx.fillText("🕌", w / 2, topY);
  ctx.font = "700 30px sans-serif";
  ctx.fillStyle = theme.gold;
  ctx.fillText(truncate(ctx, madrasaName || "MEELAD FEST", w - 160), w / 2, topY + 44);
  ctx.font = "16px sans-serif";
  ctx.fillStyle = theme.textMuted;
  ctx.fillText(madrasaName ? "Meelad Fest Celebration" : "Madrasa Meelad Fest Manager", w / 2, topY + 68);
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawPill(ctx, text, cx, y, theme, opts = {}) {
  const { font = "600 24px sans-serif", fg = theme.textPrimary, bg = theme.panel, border = theme.panelBorder } = opts;
  ctx.font = font;
  const textWidth = ctx.measureText(text).width;
  const paddingX = 22;
  const h = 44;
  const w = textWidth + paddingX * 2;
  roundRectPath(ctx, cx - w / 2, y, w, h, h / 2);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = border;
  ctx.stroke();
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
  return h;
}

// Five-point star used as a small decorative accent on the divider — a
// restrained nod to Islamic-star motifs without borrowing unrelated imagery.
function drawStar(ctx, cx, cy, outerR, innerR, color) {
  const spikes = 5;
  let rot = (Math.PI / 2) * 3;
  const step = Math.PI / spikes;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerR);
  for (let i = 0; i < spikes; i++) {
    ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
    rot += step;
    ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
    rot += step;
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawDivider(ctx, cx, y, width, theme) {
  ctx.save();
  ctx.strokeStyle = theme.panelBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - width / 2, y);
  ctx.lineTo(cx - 18, y);
  ctx.moveTo(cx + 18, y);
  ctx.lineTo(cx + width / 2, y);
  ctx.stroke();
  drawStar(ctx, cx, y, 10, 4, theme.gold);
  ctx.restore();
}

async function drawAvatar(ctx, cx, cy, radius, photoUrl, name, ringColor, theme) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
  ctx.fillStyle = ringColor;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = theme.panel;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  if (photoUrl) {
    try {
      const img = await loadImage(photoUrl);
      ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
    } catch {
      drawInitialsFallback();
    }
  } else {
    drawInitialsFallback();
  }
  ctx.restore();
  ctx.restore();

  function drawInitialsFallback() {
    ctx.fillStyle = theme.textPrimary;
    ctx.font = `bold ${Math.round(radius * 0.8)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials(name), cx, cy);
    ctx.textBaseline = "alphabetic";
  }
}

function truncate(ctx, text, maxWidth) {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

// ---- Single-winner poster ---------------------------------------------------

async function drawPoster(canvas, result, ranking, theme, madrasaName) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  drawBackground(ctx, width, height, theme);
  drawFrame(ctx, width, height, theme);
  drawBrandHeader(ctx, width, theme, 96, madrasaName);

  const medalColor = MEDAL_COLORS[ranking.rank] || theme.gold;

  // Rank badge
  const badgeY = 232;
  const badgeR = 64;
  ctx.beginPath();
  ctx.arc(width / 2, badgeY, badgeR, 0, Math.PI * 2);
  ctx.fillStyle = theme.panel;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = medalColor;
  ctx.stroke();
  ctx.font = "60px sans-serif";
  ctx.fillStyle = theme.textPrimary;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(MEDALS[ranking.rank] || `#${ranking.rank}`, width / 2, badgeY + 4);
  ctx.textBaseline = "alphabetic";

  const avatarY = 420;
  const avatarR = 100;
  await drawAvatar(ctx, width / 2, avatarY, avatarR, ranking.studentPhotoUrl, ranking.studentName, medalColor, theme);

  ctx.font = "700 46px sans-serif";
  ctx.fillStyle = theme.textPrimary;
  ctx.fillText(ranking.studentName, width / 2, avatarY + avatarR + 66);

  drawPill(ctx, ranking.groupName || "", width / 2, avatarY + avatarR + 92, theme, { font: "600 24px sans-serif" });

  ctx.font = "italic 30px sans-serif";
  ctx.fillStyle = theme.textSecondary;
  wrapText(ctx, result.itemName || "", width / 2, avatarY + avatarR + 194, width - 150, 38);

  drawDivider(ctx, width / 2, height - 148, 260, theme);

  const footer = ranking.grade
    ? `Rank ${ranking.rank}  ·  Grade ${ranking.grade}  ·  ${ranking.points} pts`
    : `Rank ${ranking.rank}`;
  ctx.font = "600 26px sans-serif";
  ctx.fillStyle = theme.textPrimary;
  ctx.fillText(footer, width / 2, height - 100);

  ctx.font = "16px sans-serif";
  ctx.fillStyle = theme.textMuted;
  ctx.fillText("Congratulations!", width / 2, height - 58);
}

// ---- Combined top-3 "podium" poster -----------------------------------------

async function drawTop3Poster(canvas, result, rankings, theme, madrasaName) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  drawBackground(ctx, width, height, theme);
  drawFrame(ctx, width, height, theme);
  drawBrandHeader(ctx, width, theme, 72, madrasaName);

  ctx.font = "700 30px sans-serif";
  ctx.fillStyle = theme.textPrimary;
  ctx.textAlign = "center";
  wrapText(ctx, result.itemName || "Results", width / 2, 186, width - 160, 36);

  ctx.font = "600 18px sans-serif";
  ctx.fillStyle = theme.textMuted;
  ctx.fillText("TOP 3 WINNERS", width / 2, 268);

  drawDivider(ctx, width / 2, 300, 200, theme);

  const baseline = 830;
  const blockWidth = 168;
  const columns = {
    1: { cx: width / 2, blockH: 230, avatarR: 86, nameFont: "700 30px sans-serif", groupFont: "600 20px sans-serif" },
    2: {
      cx: width / 2 - 210,
      blockH: 170,
      avatarR: 68,
      nameFont: "700 24px sans-serif",
      groupFont: "500 18px sans-serif",
    },
    3: {
      cx: width / 2 + 210,
      blockH: 140,
      avatarR: 64,
      nameFont: "700 24px sans-serif",
      groupFont: "500 18px sans-serif",
    },
  };

  // Draw left-to-right in podium order (2nd, 1st, 3rd) so the tallest block
  // sits centered, matching the classic winners'-podium layout.
  for (const rank of [2, 1, 3]) {
    const r = rankings.find((x) => x.rank === rank);
    if (!r) continue;
    const col = columns[rank];
    const medalColor = MEDAL_COLORS[rank] || theme.gold;
    const blockTop = baseline - col.blockH;

    roundRectPath(ctx, col.cx - blockWidth / 2, blockTop, blockWidth, col.blockH, 16);
    ctx.fillStyle = theme.panel;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = medalColor;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 54px sans-serif";
    ctx.fillStyle = medalColor;
    ctx.fillText(String(rank), col.cx, blockTop + col.blockH / 2 + 8);
    ctx.textBaseline = "alphabetic";

    const avatarY = blockTop - col.avatarR - 74;
    await drawAvatar(ctx, col.cx, avatarY, col.avatarR, r.studentPhotoUrl, r.studentName, medalColor, theme);

    const colMaxWidth = blockWidth + 44;
    ctx.font = col.nameFont;
    ctx.fillStyle = theme.textPrimary;
    ctx.fillText(truncate(ctx, r.studentName || "", colMaxWidth), col.cx, avatarY + col.avatarR + 34);

    ctx.font = col.groupFont;
    ctx.fillStyle = theme.textSecondary;
    ctx.fillText(truncate(ctx, r.groupName || "", colMaxWidth), col.cx, avatarY + col.avatarR + 58);

    if (r.grade) {
      ctx.font = "600 17px sans-serif";
      ctx.fillStyle = theme.textMuted;
      ctx.fillText(`Grade ${r.grade} · ${r.points} pts`, col.cx, blockTop + col.blockH + 24);
    }
  }

  drawDivider(ctx, width / 2, height - 92, 220, theme);
  ctx.font = "16px sans-serif";
  ctx.fillStyle = theme.textMuted;
  ctx.fillText(madrasaName || "Madrasa Meelad Fest Manager", width / 2, height - 52);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let lineY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, lineY);
}
