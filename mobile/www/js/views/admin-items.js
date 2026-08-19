import { el, mount, genId, toast } from "../util.js";
import { watchItems, watchCategories, addItem, updateItem, setItemStatus, deleteItem } from "../data.js";
import { FEST_ID } from "../app-config.js";

export async function renderAdminItems() {
  let categories = [];
  const listHost = el("ul", { class: "list" });
  const formHost = el("div", {});

  mount(
    el("div", {}, [
      el("h1", { class: "page-title" }, "Items"),
      el("div", { class: "card" }, [listHost]),
      formHost,
      el("button", { class: "btn fab", onclick: () => openForm() }, "+ Add Item"),
    ]),
  );

  function openForm(existing) {
    const nameInput = el("input", { type: "text", value: existing?.name || "" });
    const categorySelect = el(
      "select",
      {},
      categories.map((c) =>
        el("option", { value: c.id, selected: existing?.categoryId === c.id || undefined }, c.name),
      ),
    );
    const typeSelect = el("select", {}, [
      el("option", { value: "individual", selected: (existing?.type ?? "individual") === "individual" || undefined }, "Individual"),
      el("option", { value: "group", selected: existing?.type === "group" || undefined }, "Group"),
    ]);
    const maxScoreInput = el("input", {
      type: "number",
      min: "1",
      step: "1",
      value: String(existing?.maxScore ?? 10),
    });

    formHost.replaceChildren(
      el(
        "form",
        {
          class: "card",
          onsubmit: async (e) => {
            e.preventDefault();
            const maxScore = Number(maxScoreInput.value);
            const item = {
              id: existing?.id || genId(),
              festId: FEST_ID,
              name: nameInput.value.trim(),
              categoryId: categorySelect.value,
              type: typeSelect.value,
              maxScore: maxScore > 0 ? maxScore : 10,
            };
            if (!item.name || !item.categoryId) return;
            await (existing ? updateItem(FEST_ID, item) : addItem(FEST_ID, item));
            toast(existing ? "Item updated" : "Item added");
            formHost.replaceChildren();
          },
        },
        [
          el("h2", { style: "margin-top:0" }, existing ? "Edit Item" : "Add Item"),
          el("div", { class: "field" }, [el("label", {}, "Item name"), nameInput]),
          el("div", { class: "field" }, [el("label", {}, "Category"), categorySelect]),
          el("div", { class: "field" }, [el("label", {}, "Type"), typeSelect]),
          el("div", { class: "field" }, [
            el("label", {}, "Maximum score"),
            maxScoreInput,
          ]),
          el(
            "p",
            { class: "subtitle" },
            "What judges mark out of, e.g. 10 for a solo item, 20 for a group song.",
          ),
          el("div", { class: "btn-row" }, [
            el("button", { class: "btn", type: "submit" }, "Save"),
            el("button", { class: "btn secondary", type: "button", onclick: () => formHost.replaceChildren() }, "Cancel"),
          ]),
        ],
      ),
    );
  }

  function renderList(items) {
    if (items.length === 0) {
      listHost.replaceChildren(el("li", { class: "empty-state" }, "Add your first competition item."));
      return;
    }
    const categoryName = (id) => categories.find((c) => c.id === id)?.name || "Uncategorized";
    listHost.replaceChildren(
      ...items.map((item) =>
        el("li", { class: "list-row" }, [
          el("div", { style: "flex:1", onclick: () => openForm(item) }, [
            el("div", { class: "title" }, item.name),
            el("div", { class: "subtitle" }, `${categoryName(item.categoryId)} · ${item.type} · out of ${item.maxScore ?? 10}`),
          ]),
          el("span", { class: `chip status-${item.status}` }, item.status),
          item.status === "pending"
            ? el(
                "button",
                { class: "icon-btn", title: "Open for scoring", onclick: () => setItemStatus(FEST_ID, item.id, "ongoing") },
                "▶",
              )
            : null,
          el(
            "button",
            {
              class: "btn danger",
              style: "font-size:0.72rem;padding:5px 9px",
              onclick: async (e) => {
                e.stopPropagation(); // the row itself opens the edit form
                const warning =
                  item.status === "completed"
                    ? `Delete "${item.name}"? Its result, registrations and all marks are removed, ` +
                      `and group standings will drop by the points it awarded.`
                    : `Delete "${item.name}"? Its registrations and any marks so far are removed too.`;
                if (!confirm(warning)) return;
                try {
                  await deleteItem(FEST_ID, item.id);
                  toast(`"${item.name}" deleted`);
                } catch (err) {
                  toast(err?.message || "Couldn't delete that item.");
                }
              },
            },
            "Delete",
          ),
        ]),
      ),
    );
  }

  watchCategories(FEST_ID, (c) => (categories = c));
  watchItems(FEST_ID, null, renderList);
}
