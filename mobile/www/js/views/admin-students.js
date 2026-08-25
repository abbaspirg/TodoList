import { el, mount, initials, genId, toast, resizeImageFile } from "../util.js";
import {
  watchStudents,
  watchGroups,
  watchCategories,
  addStudent,
  updateStudent,
  deleteStudent,
  uploadStudentPhoto,
} from "../data.js";
import { FEST_ID } from "../app-config.js";
import { openModal } from "../modal.js";

export async function renderAdminStudents() {
  let groups = [];
  let categories = [];
  let students = [];
  let search = "";
  let groupFilter = "";

  const listHost = el("ul", { class: "list" });

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
        const category = categories.find((c) => c.id === s.categoryId);
        return el("li", { class: "list-row", onclick: () => openForm(s) }, [
          el("div", { class: "avatar" }, s.photoUrl ? el("img", { src: s.photoUrl }) : initials(s.name)),
          el("div", { style: "flex:1" }, [
            el("div", { class: "title" }, s.name),
            el("div", { class: "subtitle" }, [s.className, category?.name].filter(Boolean).join(" · ")),
          ]),
          el("span", { class: "group-dot", style: `--group-color:${group?.colorHex || "#999"}` }),
          el(
            "button",
            {
              class: "btn danger",
              style: "font-size:0.72rem;padding:5px 9px",
              // The whole row opens the edit form; without this the
              // confirm would be followed by the form popping open.
              onclick: async (e) => {
                e.stopPropagation();
                if (
                  !confirm(
                    `Delete ${s.name}? Their registrations and any marks given to them are removed too. ` +
                      `Results already published keep their own record.`,
                  )
                ) {
                  return;
                }
                try {
                  await deleteStudent(FEST_ID, s.id);
                  toast(`${s.name} deleted`);
                } catch (err) {
                  toast(err?.message || "Couldn't delete that student.");
                }
              },
            },
            "Delete",
          ),
        ]);
      }),
    );
  }

  function openForm(existing) {
    const studentId = existing?.id || genId();
    let pendingPhotoCanvas = null;

    const nameInput = el("input", { type: "text", value: existing?.name || "", required: true });
    const classInput = el("input", { type: "text", value: existing?.className || "" });
    const groupSelectField = el(
      "select",
      {},
      groups.map((g) =>
        el("option", { value: g.id, selected: existing?.groupId === g.id || undefined }, g.name),
      ),
    );
    const categorySelectField = el("select", {}, [
      el("option", { value: "" }, "No category"),
      ...categories.map((c) =>
        el("option", { value: c.id, selected: existing?.categoryId === c.id || undefined }, c.name),
      ),
    ]);

    const photoPreview = el(
      "div",
      { class: "avatar", style: "width:72px;height:72px;font-size:1.4rem" },
      existing?.photoUrl ? el("img", { src: existing.photoUrl }) : initials(nameInput.value || "?"),
    );
    const photoInput = el("input", {
      type: "file",
      accept: "image/*",
      onchange: async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        pendingPhotoCanvas = await resizeImageFile(file);
        photoPreview.replaceChildren(el("img", { src: pendingPhotoCanvas.toDataURL("image/jpeg", 0.82) }));
      },
    });

    const submitBtn = el("button", { class: "btn", type: "submit" }, "Save");
    // Assigned right after openModal below; the handlers that read it only
    // ever run once the dialog is on screen.
    let dialog = null;

    const form = el(
      "form",
      {
        onsubmit: async (e) => {
            e.preventDefault();
          const name = nameInput.value.trim();
          const groupId = groupSelectField.value;
          if (!name || !groupId) return;

          submitBtn.disabled = true;
          submitBtn.textContent = pendingPhotoCanvas ? "Uploading photo…" : "Saving…";
          try {
            const photoUrl = pendingPhotoCanvas
              ? await uploadStudentPhoto(FEST_ID, studentId, pendingPhotoCanvas)
              : existing?.photoUrl || null;
            const student = {
              id: studentId,
              festId: FEST_ID,
              name,
              className: classInput.value.trim(),
              groupId,
              categoryId: categorySelectField.value || null,
              photoUrl,
            };
            await (existing ? updateStudent(FEST_ID, student) : addStudent(FEST_ID, student));
            toast(existing ? "Student updated" : "Student added");
            dialog?.close();
          } catch (err) {
            toast("Couldn't save photo — check your connection and try again.");
            submitBtn.disabled = false;
            submitBtn.textContent = "Save";
          }
        },
      },
      [
        el("div", { class: "btn-row", style: "align-items:center;margin-bottom:12px" }, [
          photoPreview,
          photoInput,
        ]),
        el("div", { class: "field" }, [el("label", {}, "Full name"), nameInput]),
        el("div", { class: "field" }, [el("label", {}, "Class"), classInput]),
        el("div", { class: "field" }, [el("label", {}, "Group"), groupSelectField]),
        el("div", { class: "field" }, [el("label", {}, "Category"), categorySelectField]),
        el(
          "p",
          { class: "subtitle" },
          "Sets which competition items this student is eligible for during registration.",
        ),
        el("div", { class: "btn-row" }, [
          submitBtn,
          el("button", { class: "btn secondary", type: "button", onclick: () => dialog?.close() }, "Cancel"),
        ]),
      ],
    );

    dialog = openModal({ title: existing ? "Edit Student" : "Add Student", content: form });
  }

  watchGroups(FEST_ID, (g) => {
    groups = g;
    renderGroupOptions();
    renderList();
  });
  watchCategories(FEST_ID, (c) => {
    categories = c;
    renderList();
  });
  watchStudents(FEST_ID, null, (s) => {
    students = s;
    renderList();
  });
}
