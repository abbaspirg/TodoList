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
