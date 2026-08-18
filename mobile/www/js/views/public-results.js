import { el, mount, initials } from "../util.js";
import { watchPublishedResults } from "../data.js";
import { FEST_ID } from "../firebase-config.js";

const MEDALS = { 1: "🥇", 2: "🥈", 3: "🥉" };

export async function renderPublicResults() {
  const listHost = el("div", {});
  mount(el("div", {}, [el("h1", { class: "page-title" }, "Results"), listHost]));

  watchPublishedResults(FEST_ID, (results) => {
    if (results.length === 0) {
      listHost.replaceChildren(el("div", { class: "card empty-state" }, "No results published yet."));
      return;
    }
    listHost.replaceChildren(
      ...results.map((result) =>
        el("div", { class: "card" }, [
          el("strong", {}, result.itemName || result.itemId),
          el(
            "div",
            { class: "medal-row", style: "margin-top:10px" },
            (result.rankings || []).slice(0, 3).map((r) =>
              el("div", { class: "medal-card" }, [
                el("div", { class: "medal" }, MEDALS[r.rank] || `#${r.rank}`),
                el("div", { class: "avatar", style: "margin:4px auto" }, initials(r.studentName)),
                el("div", { class: "name" }, r.studentName),
                el("div", { class: "group" }, r.groupName),
              ]),
            ),
          ),
        ]),
      ),
    );
  });
}
