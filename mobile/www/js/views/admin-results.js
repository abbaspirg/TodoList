import { el, mount, initials } from "../util.js";
import { watchAllResults, publishResult } from "../data.js";
import { FEST_ID } from "../firebase-config.js";
import { navigate } from "../router.js";

const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };

export async function renderAdminResults() {
  const listHost = el("div", {});
  mount(el("div", {}, [el("h1", { class: "page-title" }, "Results & Analytics"), listHost]));

  watchAllResults(FEST_ID, (results) => {
    if (results.length === 0) {
      listHost.replaceChildren(
        el("div", { class: "card empty-state" }, "No results yet. Open an item for scoring to get started."),
      );
      return;
    }
    listHost.replaceChildren(
      ...results.map((result) =>
        el("div", { class: "card" }, [
          el("div", { class: "btn-row", style: "justify-content:space-between;align-items:center" }, [
            el("strong", {}, result.itemName || result.itemId),
            el("div", { class: "btn-row" }, [
              (result.rankings || []).length > 0
                ? el(
                    "button",
                    {
                      class: "btn secondary",
                      onclick: () => {
                        window.__posterData = { mode: "top3", result, rankings: result.rankings.slice(0, 3) };
                        navigate("/poster");
                      },
                    },
                    "Poster (Top 3)",
                  )
                : null,
              !result.published
                ? el("button", { class: "btn secondary", onclick: () => publishResult(FEST_ID, result.itemId) }, "Publish")
                : el("span", { class: "chip status-completed" }, "Published"),
            ]),
          ]),
          el(
            "div",
            { class: "medal-row", style: "margin-top:10px" },
            (result.rankings || []).slice(0, 3).map((r) =>
              el("div", { class: "medal-card" }, [
                el("div", { class: "medal" }, MEDALS[r.rank] || `#${r.rank}`),
                el("div", { class: "avatar", style: "margin:4px auto" }, initials(r.studentName)),
                el("div", { class: "name" }, r.studentName),
                el("div", { class: "group" }, r.groupName),
                el("div", { class: "subtitle" }, `${r.totalMarks?.toFixed(1) ?? "—"}/${r.maxScore ?? "—"} · ${r.points} pts`),
                r.grade ? el("span", { class: "chip" }, `Grade ${r.grade}`) : null,
                el(
                  "button",
                  {
                    class: "btn secondary",
                    style: "margin-top:6px;font-size:0.72rem;padding:6px 10px",
                    onclick: () => {
                      window.__posterData = { result, ranking: r };
                      navigate("/poster");
                    },
                  },
                  "Poster",
                ),
              ]),
            ),
          ),
          (result.rankings || []).length > 3
            ? el(
                "ul",
                { class: "list", style: "margin-top:8px" },
                result.rankings.slice(3).map((r) =>
                  el("li", { class: "list-row" }, [
                    el("span", {}, `#${r.rank}`),
                    el("span", { style: "flex:1" }, [r.studentName, el("div", { class: "subtitle" }, r.groupName)]),
                    el("span", { class: "subtitle" }, `${r.totalMarks?.toFixed(1) ?? "—"}/${r.maxScore ?? "—"}`),
                    r.grade ? el("span", { class: "chip" }, r.grade) : null,
                    el("span", { class: "subtitle" }, `${r.points} pts`),
                  ]),
                ),
              )
            : null,
        ]),
      ),
    );
  });
}
