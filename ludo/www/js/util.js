// Small DOM helpers, same dependency-free style as the rest of the repo.

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
  toastTimer = setTimeout(() => node.classList.remove("show"), 2400);
}

/** Screens are shown and hidden rather than routed to by URL. A game in
 * progress is not a page you can bookmark or reload into halfway, so there
 * is deliberately no hash routing here. */
export function showScreen(name) {
  for (const section of document.querySelectorAll("section[data-screen]")) {
    section.hidden = section.dataset.screen !== name;
  }
}

export function mountInto(hostId, ...children) {
  const host = document.getElementById(hostId);
  host.replaceChildren(...children);
  return host;
}
