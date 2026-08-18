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

  downloadBtn.addEventListener("click", () => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = el("a", { href: url, download: `${result.itemId}_rank${ranking.rank}.png` });
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }, "image/png");
  });

  shareBtn.addEventListener("click", async () => {
    canvas.toBlob(async (blob) => {
      const file = new File([blob], `${result.itemId}_rank${ranking.rank}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: result.itemName });
          return;
        } catch {
          // user cancelled or share failed — fall through to a toast below
        }
      }
      toast("Sharing isn't supported here — use Download instead.");
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
