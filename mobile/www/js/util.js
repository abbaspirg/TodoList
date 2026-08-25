// Small DOM/formatting helpers shared by every view — kept dependency-free
// to match the rest of this app (no framework, no bundler).

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value !== undefined && value !== null && value !== false) {
      node.setAttribute(key, value === true ? "" : value);
    }
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined) continue;
    node.append(child.nodeType ? child : document.createTextNode(child));
  }
  return node;
}

export function genId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function initials(name) {
  return (name || "?").trim().charAt(0).toUpperCase();
}

let toastTimer = null;
export function toast(message) {
  let node = document.querySelector(".toast");
  if (!node) {
    node = el("div", { class: "toast" });
    document.body.append(node);
  }
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("show"), 2200);
}

export function clear(node) {
  node.innerHTML = "";
}

export function mount(...children) {
  const view = document.getElementById("view");
  view.replaceChildren(...children);
  return view;
}

/** Downscales an <input type="file"> image to a <canvas> capped at maxDim
 * on its longest side — used before every student photo upload so neither
 * Cloud Storage nor (especially) localStorage's ~5-10MB quota in Local Test
 * Mode has to hold a full-resolution phone photo for a small poster/avatar
 * image. Callers turn the canvas into whatever the active backend needs
 * (a Blob for Storage, a data URL for localStorage) — see
 * js/data-firestore.js and js/data-local.js uploadStudentPhoto(). */
export function resizeImageFile(file, maxDim = 480) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height >= width && height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
