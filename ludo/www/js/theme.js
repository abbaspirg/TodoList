// App-wide light/dark theme. Persists an explicit user choice in
// localStorage as `data-theme="light"|"dark"` on <html>; with neither set,
// style.css's `prefers-color-scheme` media query follows the OS setting —
// see index.html's inline bootstrap script for why the *first* paint
// already has the right attribute (this module runs too late to avoid a
// flash on its own, since <script type=module> is deferred).
const KEY = "appTheme";

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function isDark() {
  const explicit = localStorage.getItem(KEY);
  return explicit === "dark" || (explicit !== "light" && systemPrefersDark());
}

export function setTheme(theme) {
  localStorage.setItem(KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
}

export function toggleTheme() {
  setTheme(isDark() ? "light" : "dark");
}
