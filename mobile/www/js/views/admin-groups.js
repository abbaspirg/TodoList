import { el, mount, toast, genId } from "../util.js";
import { watchGroups, addGroup, updateGroup, deleteGroup } from "../data.js";
import { FEST_ID } from "../firebase-config.js";

// A fest most often runs 2 competing groups, but some run 3+ — Groups are a
// plain admin-managed list, not a fixed pair. This palette just gives each
// newly added group a distinct default color to start from.
const DEFAULT_COLORS = ["#0f6e4f", "#c9971f", "#2f6fed", "#c0392b", "#8e44ad", "#16a085"];

export async function renderAdminGroups() {
  const listHost = el("div", {});
  mount(
    el("div", {}, [
      el("h1", { class: "page-title" }, "Groups"),
      listHost,
      el(
        "button",
        {
          class: "btn fab",
          onclick: async () => {
            const count = listHost.children.length;
            await addGroup(FEST_ID, {
              id: genId(),
              festId: FEST_ID,
              name: `Group ${count + 1}`,
              colorHex: DEFAULT_COLORS[count % DEFAULT_COLORS.length],
            });
            toast("Group added — edit its name and color below");
          },
        },
        "+ Add Group",
      ),
    ]),
  );

  watchGroups(FEST_ID, (groups) => {
    if (groups.length === 0) {
      listHost.replaceChildren(el("div", { class: "card empty-state" }, 'No groups yet — tap "Add Group" to get started.'));
      return;
    }
    listHost.replaceChildren(
      ...groups.map((g) => {
        const nameInput = el("input", { type: "text", value: g.name });
        const colorInput = el("input", { type: "color", value: g.colorHex });
        return el("div", { class: "card" }, [
          el("div", { class: "field" }, [el("label", {}, "Group name"), nameInput]),
          el("div", { class: "field" }, [el("label", {}, "Color"), colorInput]),
          el("div", { class: "btn-row" }, [
            el(
              "button",
              {
                class: "btn",
                onclick: async () => {
                  await updateGroup(FEST_ID, { id: g.id, name: nameInput.value.trim(), colorHex: colorInput.value });
                  toast("Group updated");
                },
              },
              "Save",
            ),
            el(
              "button",
              {
                class: "btn danger",
                type: "button",
                onclick: async () => {
                  if (!confirm(`Delete "${g.name}"? Students already assigned to it keep this group until reassigned.`)) return;
                  await deleteGroup(FEST_ID, g.id);
                  toast("Group deleted");
                },
              },
              "Delete",
            ),
          ]),
        ]);
      }),
    );
  });
}
