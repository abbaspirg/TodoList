import { el, mount, genId, toast } from "../util.js";
import { watchJudges, watchItems, addJudge, assignJudgeToItems } from "../data.js";
import { FEST_ID } from "../app-config.js";

export async function renderAdminJudges() {
  let items = [];
  const listHost = el("div", {});
  const formHost = el("div", {});

  mount(
    el("div", {}, [
      el("h1", { class: "page-title" }, "Judges"),
      listHost,
      formHost,
      el("button", { class: "btn fab", onclick: () => openForm() }, "+ Add Judge"),
    ]),
  );

  function openForm() {
    const nameInput = el("input", { type: "text" });
    const emailInput = el("input", { type: "email" });
    formHost.replaceChildren(
      el(
        "form",
        {
          class: "card",
          onsubmit: async (e) => {
            e.preventDefault();
            if (!nameInput.value.trim()) return;
            await addJudge(FEST_ID, {
              id: genId(),
              festId: FEST_ID,
              name: nameInput.value.trim(),
              email: emailInput.value.trim(),
            });
            toast("Judge added");
            formHost.replaceChildren();
          },
        },
        [
          el("h2", { style: "margin-top:0" }, "Add Judge"),
          el("div", { class: "field" }, [el("label", {}, "Name"), nameInput]),
          el("div", { class: "field" }, [el("label", {}, "Email"), emailInput]),
          el("div", { class: "btn-row" }, [
            el("button", { class: "btn", type: "submit" }, "Save"),
            el("button", { class: "btn secondary", type: "button", onclick: () => formHost.replaceChildren() }, "Cancel"),
          ]),
        ],
      ),
    );
  }

  function renderJudges(judges) {
    if (judges.length === 0) {
      listHost.replaceChildren(el("div", { class: "card empty-state" }, "No judges added yet."));
      return;
    }
    listHost.replaceChildren(
      ...judges.map((judge) => {
        const assigned = new Set(judge.assignedItemIds || []);
        return el("div", { class: "card" }, [
          el("div", { class: "title" }, judge.name),
          el("div", { class: "subtitle", style: "margin-bottom:8px" }, judge.email || ""),
          ...items.map((item) =>
            el("label", { class: "list-row" }, [
              el("input", {
                type: "checkbox",
                checked: assigned.has(item.id) || undefined,
                onchange: (e) => {
                  const updated = new Set(assigned);
                  e.target.checked ? updated.add(item.id) : updated.delete(item.id);
                  assignJudgeToItems(FEST_ID, judge.id, [...updated]).catch(() =>
                    toast("Couldn't update assignment — is Cloud Functions deployed?"),
                  );
                },
              }),
              item.name,
            ]),
          ),
        ]);
      }),
    );
  }

  watchItems(FEST_ID, null, (i) => {
    items = i;
  });
  watchJudges(FEST_ID, renderJudges);
}
