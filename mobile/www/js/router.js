// Minimal hash router — no framework, matches the rest of this app.
// Routes are registered as `#/admin/scoring/:itemId`-style patterns.

const routes = [];
let notFoundHandler = () => {};

export function route(pattern, handler) {
  const paramNames = [];
  const regex = new RegExp(
    "^" +
      pattern.replace(/:[^/]+/g, (m) => {
        paramNames.push(m.slice(1));
        return "([^/]+)";
      }) +
      "$",
  );
  routes.push({ regex, paramNames, handler });
}

export function notFound(handler) {
  notFoundHandler = handler;
}

function currentPath() {
  return location.hash.slice(1) || "/";
}

async function render() {
  const path = currentPath();
  for (const r of routes) {
    const match = path.match(r.regex);
    if (match) {
      const params = {};
      r.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(match[i + 1])));
      await r.handler(params);
      highlightNav(path);
      return;
    }
  }
  await notFoundHandler();
}

function highlightNav(path) {
  document.querySelectorAll("#navLinks a").forEach((a) => {
    a.classList.toggle("active", a.getAttribute("href") === `#${path}`);
  });
}

export function navigate(path) {
  location.hash = path;
}

export function startRouter() {
  window.addEventListener("hashchange", render);
  render();
}
