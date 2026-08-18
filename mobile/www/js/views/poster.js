import { el, mount, initials, toast } from "../util.js";

const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };

// Renders the poster on a <canvas> (photo, name, group, rank, item name,
// fest branding) and offers Download/Share — the web equivalent of the
// widget-to-image approach described in docs/ARCHITECTURE.md §1. Canvas
// export works the same whether this runs in a browser tab or inside the
// Capacitor WebView.
export async function renderPoster() {
  const data = window.__posterData;
  if (!data) {
    mount(el("div", { class: "card empty-state" }, "Open a result's “Poster” button first."));
    return;
  }
  const { result, ranking } = data;

  const canvas = el("canvas", { id: "posterCanvas", width: "720", height: "960" });
  const downloadBtn = el("button", { class: "btn" }, "Download");
  const shareBtn = el("button", { class: "btn secondary" }, "Share");

  mount(
    el("div", {}, [
      el("h1", { class: "page-title" }, "Poster"),
      canvas,
      el("div", { class: "btn-row", style: "justify-content:center;margin-top:16px" }, [downloadBtn, shareBtn]),
    ]),
  );

  await drawPoster(canvas, result, ranking);

  const fileName = `${result.itemId}_rank${ranking.rank}.png`;

  downloadBtn.addEventListener("click", () =>
    runButtonAction(downloadBtn, "Download", "Saving…", () => downloadPoster(canvas, fileName)),
  );
  shareBtn.addEventListener("click", () =>
    runButtonAction(shareBtn, "Share", "Preparing…", () => sharePoster(canvas, fileName, result.itemName)),
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

async function drawPoster(canvas, result, ranking) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;

  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#0f6e4f");
  gradient.addColorStop(1, "#111814");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";

  ctx.font = "120px serif";
  ctx.fillText(MEDALS[ranking.rank] || `#${ranking.rank}`, width / 2, 220);

  // Photo or initials avatar
  const avatarRadius = 110;
  const avatarY = 400;
  ctx.save();
  ctx.beginPath();
  ctx.arc(width / 2, avatarY, avatarRadius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.fill();
  if (ranking.studentPhotoUrl) {
    try {
      const img = await loadImage(ranking.studentPhotoUrl);
      ctx.clip();
      ctx.drawImage(img, width / 2 - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    } catch {
      drawInitials();
    }
  } else {
    drawInitials();
  }
  ctx.restore();

  function drawInitials() {
    ctx.font = "bold 90px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(initials(ranking.studentName), width / 2, avatarY + 32);
  }

  ctx.font = "bold 52px sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText(ranking.studentName, width / 2, avatarY + 170);

  ctx.font = "34px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(ranking.groupName, width / 2, avatarY + 220);

  ctx.font = "36px sans-serif";
  ctx.fillStyle = "#fff";
  wrapText(ctx, result.itemName || "", width / 2, avatarY + 300, width - 120, 44);

  ctx.font = "28px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(`Rank ${ranking.rank}`, width / 2, height - 60);
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
