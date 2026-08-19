import { el, mount, toast } from "../util.js";
import {
  watchItem,
  watchRegistrations,
  watchItemScores,
  watchJudges,
  overrideScore,
  withdrawRegistration,
  recomputeItemResult,
} from "../data.js";
import { FEST_ID } from "../app-config.js";

// The admin's view of the raw marks behind an item: every judge's mark for
// every participant, editable, plus removing a participant outright.
//
// Judges deliberately can't do either — their marks are create-once so
// nobody revises after seeing another's. But with no server there is no
// back office, so an admin needs somewhere to fix a mis-keyed mark or a
// student entered against the wrong item. Every change re-derives the
// item's result immediately, so what's published never disagrees with the
// marks underneath it.
export async function renderAdminScores({ itemId }) {
  const titleEl = el("h1", { class: "page-title" }, "Marks");
  const statusEl = el("p", { class: "subtitle" }, "");
  const listHost = el("div", {});
  mount(el("div", {}, [titleEl, statusEl, listHost]));

  let item = null;
  let registrations = [];
  let scores = [];
  let judges = [];

  function judgeName(judgeId) {
    return judges.find((j) => j.id === judgeId)?.name || "Unknown judge";
  }

  async function afterChange(message) {
    try {
      await recomputeItemResult(FEST_ID, itemId);
      toast(message);
    } catch (err) {
      toast(err?.message || "Saved, but couldn't recalculate the result.");
    }
  }

  function render() {
    if (!item) return;
    titleEl.textContent = `Marks — ${item.name}`;
    const assigned = (item.assignedJudgeIds || []).length;
    statusEl.textContent =
      `${item.status} · out of ${item.maxScore ?? 10} · ${assigned} judge${assigned === 1 ? "" : "s"} assigned. ` +
      `Editing a mark or removing a participant recalculates the result straight away.`;

    const active = registrations.filter((r) => r.status !== "withdrawn");
    if (active.length === 0) {
      listHost.replaceChildren(el("div", { class: "card empty-state" }, "Nobody is registered for this item."));
      return;
    }

    listHost.replaceChildren(
      ...active.map((reg) => {
        const regScores = scores.filter((s) => s.registrationId === reg.id);
        return el("div", { class: "card" }, [
          el("div", { class: "btn-row", style: "justify-content:space-between;align-items:flex-start" }, [
            el("div", {}, [
              el("div", { class: "title" }, `#${reg.chestNumber ?? "—"} ${reg.studentName}`),
              el("div", { class: "subtitle" }, reg.groupName || ""),
            ]),
            el(
              "button",
              {
                class: "btn danger",
                style: "font-size:0.72rem;padding:5px 9px",
                onclick: async () => {
                  if (
                    !confirm(
                      `Remove ${reg.studentName} from ${item.name}? ` +
                        `If the item was completed it reopens for scoring until the remaining marks are in.`,
                    )
                  ) {
                    return;
                  }
                  try {
                    await withdrawRegistration(reg.id);
                    await afterChange(`${reg.studentName} removed`);
                  } catch (err) {
                    toast(err?.message || "Couldn't remove that participant.");
                  }
                },
              },
              "Remove",
            ),
          ]),

          regScores.length === 0
            ? el("div", { class: "subtitle", style: "margin-top:8px" }, "No marks submitted yet.")
            : el(
                "div",
                { style: "margin-top:8px" },
                regScores.map((sc) => {
                  const input = el("input", {
                    type: "number",
                    min: "0",
                    max: String(item.maxScore ?? 10),
                    step: "0.5",
                    value: String(sc.totalMarks),
                    style: "width:84px",
                  });
                  return el("div", { class: "list-row" }, [
                    el("span", { style: "flex:1" }, [
                      judgeName(sc.judgeId),
                      sc.editedByAdminAt ? el("div", { class: "subtitle" }, "edited by admin") : null,
                    ]),
                    input,
                    el(
                      "button",
                      {
                        class: "btn secondary",
                        style: "font-size:0.72rem;padding:6px 10px",
                        onclick: async () => {
                          const value = Number(input.value);
                          const max = item.maxScore ?? 10;
                          if (!Number.isFinite(value) || value < 0 || value > max) {
                            toast(`Enter a mark between 0 and ${max}.`);
                            return;
                          }
                          try {
                            await overrideScore(FEST_ID, sc.id, value, itemId);
                            toast("Mark updated");
                          } catch (err) {
                            toast(err?.message || "Couldn't update that mark.");
                          }
                        },
                      },
                      "Save",
                    ),
                  ]);
                }),
              ),
        ]);
      }),
    );
  }

  watchItem(FEST_ID, itemId, (i) => {
    item = i;
    render();
  });
  watchRegistrations(itemId, (r) => {
    registrations = r;
    render();
  });
  watchItemScores(itemId, (s) => {
    scores = s;
    render();
  });
  watchJudges(FEST_ID, (j) => {
    judges = j;
    render();
  });
}
