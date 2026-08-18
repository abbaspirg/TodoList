import { el, mount, initials, genId, toast } from "../util.js";
import { watchStudents, watchGroups, addStudent, updateStudent } from "../data.js";
import { FEST_ID } from "../firebase-config.js";

export async function renderAdminStudents() {
  let groups = [];
  let students = [];
  let search = "";
  let groupFilter = "";

  const listHost = el("ul", { class: "list" });
  const formHost = el("div", {});

  const searchInput = el("input", {
    type: "search",
    placeholder: "Search students",
    oninput: (e) => {
      search = e.target.value.toLowerCase();
      renderList();
    },
  });
  const groupSelect = el("select", {
    onchange: (e) => {
      groupFilter = e.target.value;
      renderList();
    },
  });

  mount(
    el("div", {}, [
      el("h1", { class: "page-title" }, "Students"),
      el("div", { class: "card" }, [
        el("div", { class: "btn-row" }, [searchInput, groupSelect]),
      ]),
      el("div", { class: "card" }, [listHost]),
      formHost,
      el("button", { class: "btn fab", onclick: () => openForm() }, "+ Add Student"),
    ]),
  );

  function renderGroupOptions() {
    groupSelect.replaceChildren(
      el("option", { value: "" }, "All groups"),
      ...groups.map((g) => el("option", { value: g.id }, g.name)),
    );
  }

  function renderList() {
    const filtered = students.filter((s) => {
      if (groupFilter && s.groupId !== groupFilter) return false;
      return s.name.toLowerCase().includes(search);
    });
    if (filtered.length === 0) {
      listHost.replaceChildren(el("li", { class: "empty-state" }, "No students found."));
      return;
    }
    listHost.replaceChildren(
      ...filtered.map((s) => {
        const group = groups.find((g) => g.id === s.groupId);
        return el("li", { class: "list-row", onclick: () => openForm(s) }, [
          el("div", { class: "avatar" }, s.photoUrl ? el("img", { src: s.photoUrl }) : initials(s.name)),
          el("div", { style: "flex:1" }, [
            el("div", { class: "title" }, s.name),
            el("div", { class: "subtitle" }, s.className || ""),
          ]),
          el("span", { class: "group-dot", style: `--group-color:${group?.colorHex || "#999"}` }),
        ]);
      }),
    );
  }

  function openForm(existing) {
    const nameInput = el("input", { type: "text", value: existing?.name || "", required: true });
    const classInput = el("input", { type: "text", value: existing?.className || "" });
    const groupSelectField = el(
      "select",
      {},
      groups.map((g) =>
        el("option", { value: g.id, selected: existing?.groupId === g.id || undefined }, g.name),
      ),
    );

    formHost.replaceChildren(
      el(
        "form",
        {
          class: "card",
          onsubmit: async (e) => {
            e.preventDefault();
            const student = {
              id: existing?.id || genId(),
              festId: FEST_ID,
              name: nameInput.value.trim(),
              className: classInput.value.trim(),
              groupId: groupSelectField.value,
            };
            if (!student.name || !student.groupId) return;
            await (existing ? updateStudent(FEST_ID, student) : addStudent(FEST_ID, student));
            toast(existing ? "Student updated" : "Student added");
            formHost.replaceChildren();
          },
        },
        [
          el("h2", { style: "margin-top:0" }, existing ? "Edit Student" : "Add Student"),
          el("div", { class: "field" }, [el("label", {}, "Full name"), nameInput]),
          el("div", { class: "field" }, [el("label", {}, "Class"), classInput]),
          el("div", { class: "field" }, [el("label", {}, "Group"), groupSelectField]),
          el("div", { class: "btn-row" }, [
            el("button", { class: "btn", type: "submit" }, "Save"),
            el("button", { class: "btn secondary", type: "button", onclick: () => formHost.replaceChildren() }, "Cancel"),
          ]),
        ],
      ),
    );
  }

  watchGroups(FEST_ID, (g) => {
    groups = g;
    renderGroupOptions();
    renderList();
  });
  watchStudents(FEST_ID, null, (s) => {
    students = s;
    renderList();
  });
}
