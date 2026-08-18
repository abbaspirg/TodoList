import { el, mount, toast } from "../util.js";
import { watchGroups, updateGroup } from "../data.js";
import { FEST_ID } from "../firebase-config.js";

export async function renderAdminGroups() {
  const listHost = el("div", {});
  mount(el("div", {}, [el("h1", { class: "page-title" }, "Groups"), listHost]));

  watchGroups(FEST_ID, (groups) => {
    listHost.replaceChildren(
      ...groups.map((g) => {
        const nameInput = el("input", { type: "text", value: g.name });
        const colorInput = el("input", { type: "color", value: g.colorHex });
        return el("div", { class: "card" }, [
          el("div", { class: "field" }, [el("label", {}, "Group name"), nameInput]),
          el("div", { class: "field" }, [el("label", {}, "Color"), colorInput]),
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
        ]);
      }),
    );
  });
}
