import { el, mount, genId, toast } from "../util.js";
import { watchItems, watchCategories, addItem, updateItem, setItemStatus } from "../data.js";
import { FEST_ID } from "../firebase-config.js";

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

    formHost.replaceChildren(
      el(
        "form",
        {
          class: "card",
          onsubmit: async (e) => {
            e.preventDefault();
            const item = {
              id: existing?.id || genId(),
              festId: FEST_ID,
              name: nameInput.value.trim(),
              categoryId: categorySelect.value,
              type: typeSelect.value,
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
            el("div", { class: "subtitle" }, `${categoryName(item.categoryId)} · ${item.type}`),
          ]),
          el("span", { class: `chip status-${item.status}` }, item.status),
          item.status === "pending"
            ? el(
                "button",
                { class: "icon-btn", title: "Open for scoring", onclick: () => setItemStatus(FEST_ID, item.id, "ongoing") },
                "▶",
              )
            : null,
        ]),
      ),
    );
  }

  watchCategories(FEST_ID, (c) => (categories = c));
  watchItems(FEST_ID, null, renderList);
}
