import { el, mount, genId, toast } from "../util.js";
import { watchCategories, addCategory, updateCategory, deleteCategory } from "../data.js";
import { FEST_ID } from "../app-config.js";
import { openModal } from "../modal.js";

export async function renderAdminCategories() {
  const listHost = el("ul", { class: "list" });

  mount(
    el("div", {}, [
      el("h1", { class: "page-title" }, "Categories"),
      el("div", { class: "card" }, [listHost]),
      el("button", { class: "btn fab", onclick: () => openForm() }, "+ Add Category"),
    ]),
  );

  function openForm(existing) {
    const nameInput = el("input", { type: "text", value: existing?.name || "" });
    const minInput = el("input", { type: "number", value: existing?.minAge ?? "" });
    const maxInput = el("input", { type: "number", value: existing?.maxAge ?? "" });

    let dialog = null;
    const form = el(
      "form",
      {
        onsubmit: async (e) => {
          e.preventDefault();
          const category = {
            id: existing?.id || genId(),
            festId: FEST_ID,
            name: nameInput.value.trim(),
            minAge: minInput.value ? Number(minInput.value) : null,
            maxAge: maxInput.value ? Number(maxInput.value) : null,
            sortOrder: existing?.sortOrder ?? 0,
          };
          if (!category.name) return;
          await (existing ? updateCategory(FEST_ID, category) : addCategory(FEST_ID, category));
          toast(existing ? "Category updated" : "Category added");
          dialog?.close();
        },
      },
      [
        el("div", { class: "field" }, [el("label", {}, "Category name"), nameInput]),
        el("div", { class: "btn-row" }, [
          el("div", { class: "field" }, [el("label", {}, "Min age"), minInput]),
          el("div", { class: "field" }, [el("label", {}, "Max age"), maxInput]),
        ]),
        el("div", { class: "btn-row" }, [
          el("button", { class: "btn", type: "submit" }, "Save"),
          el("button", { class: "btn secondary", type: "button", onclick: () => dialog?.close() }, "Cancel"),
        ]),
      ],
    );

    dialog = openModal({ title: existing ? "Edit Category" : "Add Category", content: form });
  }

  watchCategories(FEST_ID, (categories) => {
    if (categories.length === 0) {
      listHost.replaceChildren(el("li", { class: "empty-state" }, 'Add your first category, e.g. "Sub-Junior".'));
      return;
    }
    listHost.replaceChildren(
      ...categories.map((c) =>
        el("li", { class: "list-row" }, [
          el("div", { style: "flex:1", onclick: () => openForm(c) }, [
            el("div", { class: "title" }, c.name),
            el("div", { class: "subtitle" }, c.minAge != null ? `Ages ${c.minAge}-${c.maxAge}` : "No age range set"),
          ]),
          el(
            "button",
            {
              class: "icon-btn",
              title: "Delete category",
              // The row itself opens the edit dialog, and this used to
              // delete on a single unconfirmed tap.
              onclick: async (e) => {
                e.stopPropagation();
                if (
                  !confirm(
                    `Delete "${c.name}"? Items and students already in this category keep it ` +
                      `until you move them to another one.`,
                  )
                ) {
                  return;
                }
                try {
                  await deleteCategory(FEST_ID, c.id);
                  toast(`"${c.name}" deleted`);
                } catch (err) {
                  toast(err?.message || "Couldn't delete that category.");
                }
              },
            },
            "🗑",
          ),
        ]),
      ),
    );
  });
}
