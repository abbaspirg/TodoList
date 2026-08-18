import { el, mount } from "../util.js";
import { watchGroupTotals } from "../data.js";
import { FEST_ID } from "../firebase-config.js";
import { signOut } from "../auth.js";

const NAV_TILES = [
  { href: "/admin/students", icon: "👥", label: "Students" },
  { href: "/admin/groups", icon: "🚩", label: "Groups" },
  { href: "/admin/categories", icon: "🏷️", label: "Categories" },
  { href: "/admin/items", icon: "🎤", label: "Items" },
  { href: "/admin/registrations", icon: "📝", label: "Registrations" },
  { href: "/admin/judges", icon: "⚖️", label: "Judges" },
  { href: "/admin/results", icon: "🏆", label: "Results & Analytics" },
];

export async function renderAdminDashboard() {
  const scoreBarHost = el("div", { class: "card" }, "Loading grand total…");

  const grid = el(
    "div",
    { class: "grid-nav" },
    NAV_TILES.map((t) =>
      el("a", { href: `#${t.href}` }, [el("span", { class: "icon" }, t.icon), t.label]),
    ),
  );

  mount(
    el("div", {}, [
      el("div", { class: "btn-row", style: "justify-content:flex-end;margin-bottom:8px" }, [
        el("button", { class: "btn secondary", onclick: signOut }, "Sign out"),
      ]),
      scoreBarHost,
      grid,
    ]),
  );

  watchGroupTotals(FEST_ID, (totals) => renderScoreBar(scoreBarHost, totals));
}

function renderScoreBar(host, totals) {
  if (totals.length < 2) {
    host.replaceChildren("Group totals will appear once scoring begins.");
    return;
  }
  const sorted = [...totals].sort((a, b) => a.groupName.localeCompare(b.groupName));
  const max = Math.max(1, ...sorted.map((g) => g.totalPoints || 0));

  host.replaceChildren(
    el("h2", { style: "margin:0 0 12px" }, "Grand Total"),
    ...sorted.map((g) =>
      el("div", { class: "score-bar-row" }, [
        el("div", { class: "btn-row", style: "justify-content:space-between;margin-bottom:4px" }, [
          el("span", {}, [el("span", { class: "group-dot", style: `--group-color:${g.groupColorHex}` }), " ", g.groupName]),
          el("strong", {}, `${(g.totalPoints || 0).toFixed(0)} pts`),
        ]),
        el("div", { class: "score-bar-track" }, [
          el("div", {
            class: "score-bar-fill",
            style: `--group-color:${g.groupColorHex};width:${((g.totalPoints || 0) / max) * 100}%`,
          }),
        ]),
      ]),
    ),
  );
}
