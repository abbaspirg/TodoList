import { el, mount } from "../util.js";
import {
  watchCategories,
  watchItems,
  watchStudents,
  watchGroups,
  watchRegistrations,
  registerStudent,
  withdrawRegistration,
} from "../data.js";
import { FEST_ID } from "../firebase-config.js";

export async function renderAdminRegistrations() {
  let categories = [];
  let items = [];
  let students = [];
  let groups = [];
  let registered = new Map();
  let selectedCategoryId = "";
  let selectedItemId = "";
  let unsubRegs = null;

  const categorySelect = el("select", {}, [el("option", { value: "" }, "Choose category…")]);
  const itemSelect = el("select", { disabled: true }, [el("option", { value: "" }, "Choose item…")]);
  const listHost = el("div", { class: "card" }, "Choose a category and item to register students.");

  mount(
    el("div", {}, [
      el("h1", { class: "page-title" }, "Registrations"),
      el("div", { class: "card" }, [
        el("div", { class: "field" }, [el("label", {}, "1. Category"), categorySelect]),
        el("div", { class: "field" }, [el("label", {}, "2. Item"), itemSelect]),
      ]),
      listHost,
    ]),
  );

  categorySelect.addEventListener("change", () => {
    selectedCategoryId = categorySelect.value;
    selectedItemId = "";
    renderItemOptions();
    renderRegistrationList();
  });
  itemSelect.addEventListener("change", () => {
    selectedItemId = itemSelect.value;
    watchSelectedItemRegistrations();
  });

  function renderItemOptions() {
    const filtered = items.filter((i) => i.categoryId === selectedCategoryId);
    itemSelect.disabled = !selectedCategoryId;
    itemSelect.replaceChildren(
      el("option", { value: "" }, "Choose item…"),
      ...filtered.map((i) => el("option", { value: i.id }, i.name)),
    );
  }

  function watchSelectedItemRegistrations() {
    if (unsubRegs) unsubRegs();
    if (!selectedItemId) {
      renderRegistrationList();
      return;
    }
    unsubRegs = watchRegistrations(selectedItemId, (regs) => {
      registered = new Map(regs.map((r) => [r.studentId, r]));
      renderRegistrationList();
    });
  }

  function renderRegistrationList() {
    if (!selectedItemId) {
      listHost.replaceChildren("Choose a category and item to register students.");
      return;
    }
    // Only students placed in this category are eligible for its items —
    // see js/views/admin-students.js "Category" field.
    const eligible = students.filter((s) => s.categoryId === selectedCategoryId);
    if (eligible.length === 0) {
      listHost.replaceChildren(
        "No students in this category yet — set a student's Category under Students first.",
      );
      return;
    }
    listHost.replaceChildren(
      ...eligible.map((s, i) => {
        const group = groups.find((g) => g.id === s.groupId);
        const reg = registered.get(s.id);
        const checkbox = el("input", {
          type: "checkbox",
          checked: reg && reg.status !== "withdrawn" ? true : undefined,
          onchange: async (e) => {
            if (e.target.checked) {
              await registerStudent({
                itemId: selectedItemId,
                studentId: s.id,
                studentName: s.name,
                studentPhotoUrl: s.photoUrl || null,
                groupId: s.groupId,
                groupName: group?.name || "",
                groupColorHex: group?.colorHex || "#999999",
                chestNumber: String(i + 1),
              });
            } else if (reg) {
              await withdrawRegistration(reg.id);
            }
          },
        });
        return el("label", { class: "list-row" }, [
          checkbox,
          el("span", { class: "group-dot", style: `--group-color:${group?.colorHex || "#999"}` }),
          el("span", { style: "flex:1" }, [s.name, el("div", { class: "subtitle" }, group?.name || "")]),
        ]);
      }),
    );
  }

  watchCategories(FEST_ID, (c) => {
    categories = c;
    categorySelect.replaceChildren(
      el("option", { value: "" }, "Choose category…"),
      ...c.map((cat) => el("option", { value: cat.id }, cat.name)),
    );
  });
  watchItems(FEST_ID, null, (i) => {
    items = i;
    renderItemOptions();
  });
  watchStudents(FEST_ID, null, (s) => {
    students = s;
    renderRegistrationList();
  });
  watchGroups(FEST_ID, (g) => (groups = g));
}
