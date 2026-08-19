import { el, mount } from "../util.js";
import { watchGroupTotals } from "../data.js";
import { FEST_ID } from "../app-config.js";
import { navigate } from "../router.js";

export async function renderPublicLeaderboard() {
  const host = el("div", { class: "card" }, "Scoring has not started yet.");
  mount(
    el("div", {}, [
      el("div", { class: "btn-row", style: "justify-content:space-between;align-items:center" }, [
        el("h1", { class: "page-title" }, "Live Leaderboard"),
        el("button", { class: "btn secondary", onclick: () => navigate("/public/results") }, "Item Results"),
      ]),
      host,
    ]),
  );

  watchGroupTotals(FEST_ID, (totals) => {
    if (totals.length === 0) {
      host.replaceChildren("Scoring has not started yet.");
      return;
    }
    const max = Math.max(1, ...totals.map((g) => g.totalPoints || 0));
    host.replaceChildren(
      el(
        "div",
        { class: "leaderboard-columns" },
        totals.map((g) =>
          el("div", { class: "leaderboard-col" }, [
            el("div", { class: "leaderboard-points", style: `--group-color:${g.groupColorHex}` }, `${(g.totalPoints || 0).toFixed(0)}`),
            el("div", {
              class: "leaderboard-bar",
              style: `--group-color:${g.groupColorHex};height:${40 + ((g.totalPoints || 0) / max) * 180}px`,
            }),
            el("div", {}, g.groupName),
          ]),
        ),
      ),
    );
  });
}
