import { el, mount, toast } from "../util.js";
import { watchStudents, watchGroups, watchAttendance, setAttendance, setAttendanceBulk } from "../data.js";
import { FEST_ID } from "../app-config.js";
import { navigate } from "../router.js";

const STATUSES = [
  { key: "present", label: "P", title: "Present" },
  { key: "late", label: "L", title: "Late" },
  { key: "absent", label: "A", title: "Absent" },
];

/** Today as a local YYYY-MM-DD string. Deliberately not
 * toISOString().slice(0,10), which is UTC — west of UTC that files an
 * evening's attendance under the previous day. */
function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(date, days) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

// Daily attendance, taken one class at a time — which is how a madrasa
// actually registers students, and keeps the list short enough to work
// through on a phone.
export async function renderAdminAttendance() {
  let students = [];
  let groups = [];
  let records = [];
  let unsubAttendance = null;

  let date = todayLocal();
  let selectedClass = "";

  const dateInput = el("input", { type: "date", value: date });
  const classSelect = el("select", {});
  const summaryEl = el("div", { class: "subtitle", style: "margin-bottom:10px" }, "");
  const listHost = el("div", {});
  const markAllBtn = el("button", { class: "btn secondary" }, "Mark all present");

  mount(
    el("div", {}, [
      el("div", { class: "btn-row", style: "justify-content:space-between;align-items:center" }, [
        el("h1", { class: "page-title" }, "Attendance"),
        el("button", { class: "btn secondary", onclick: () => navigate("/admin/attendance/report") }, "Report"),
      ]),
      el("div", { class: "card" }, [
        el("div", { class: "field" }, [el("label", {}, "Date"), dateInput]),
        el("div", { class: "btn-row", style: "margin-bottom:12px" }, [
          el("button", { class: "btn secondary", onclick: () => setDate(shiftDate(date, -1)) }, "‹ Prev"),
          el("button", { class: "btn secondary", onclick: () => setDate(todayLocal()) }, "Today"),
          el("button", { class: "btn secondary", onclick: () => setDate(shiftDate(date, 1)) }, "Next ›"),
        ]),
        el("div", { class: "field" }, [el("label", {}, "Class"), classSelect]),
        summaryEl,
        el("div", { class: "btn-row" }, [markAllBtn]),
      ]),
      listHost,
    ]),
  );

  function setDate(next) {
    date = next;
    dateInput.value = next;
    subscribeAttendance();
  }

  function subscribeAttendance() {
    if (unsubAttendance) unsubAttendance();
    records = [];
    render();
    unsubAttendance = watchAttendance(FEST_ID, date, (list) => {
      records = list;
      render();
    });
  }

  dateInput.addEventListener("change", () => {
    if (dateInput.value) setDate(dateInput.value);
  });
  classSelect.addEventListener("change", () => {
    selectedClass = classSelect.value;
    render();
  });

  /** Classes come from the students themselves — className is free text on
   * the student form, not a managed collection, so there is nothing else to
   * read them from. */
  function classesFromStudents() {
    return [...new Set(students.map((s) => (s.className || "").trim()).filter(Boolean))].sort();
  }

  function renderClassOptions() {
    const classes = classesFromStudents();
    const previous = selectedClass;
    classSelect.replaceChildren(
      el("option", { value: "" }, "All classes"),
      ...classes.map((c) => el("option", { value: c }, c)),
      ...(students.some((s) => !(s.className || "").trim())
        ? [el("option", { value: "__none__" }, "No class set")]
        : []),
    );
    classSelect.value = classes.includes(previous) || previous === "__none__" ? previous : "";
    selectedClass = classSelect.value;
  }

  function visibleStudents() {
    return students
      .filter((s) => {
        const cls = (s.className || "").trim();
        if (selectedClass === "") return true;
        if (selectedClass === "__none__") return cls === "";
        return cls === selectedClass;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function statusOf(studentId) {
    return records.find((r) => r.studentId === studentId)?.status ?? null;
  }

  function recordFor(student, status) {
    const group = groups.find((g) => g.id === student.groupId);
    return {
      festId: FEST_ID,
      date,
      studentId: student.id,
      studentName: student.name,
      // Denormalized so a report reads the class the student was in that
      // day, not whichever class they are in now.
      className: (student.className || "").trim(),
      groupId: student.groupId ?? null,
      groupName: group?.name ?? null,
      status,
    };
  }

  async function mark(student, status) {
    try {
      await setAttendance(FEST_ID, recordFor(student, status));
    } catch (err) {
      toast(err?.message || "Couldn't save that.");
    }
  }

  markAllBtn.addEventListener("click", async () => {
    const list = visibleStudents();
    if (list.length === 0) return;
    markAllBtn.disabled = true;
    markAllBtn.textContent = "Saving…";
    try {
      await setAttendanceBulk(FEST_ID, list.map((s) => recordFor(s, "present")));
      toast(`Marked ${list.length} present`);
    } catch (err) {
      toast(err?.message || "Couldn't mark everyone present.");
    } finally {
      markAllBtn.disabled = false;
      markAllBtn.textContent = "Mark all present";
    }
  });

  function render() {
    renderClassOptions();
    const list = visibleStudents();

    const counts = { present: 0, late: 0, absent: 0, unmarked: 0 };
    for (const s of list) {
      const st = statusOf(s.id);
      if (st && counts[st] !== undefined) counts[st] += 1;
      else counts.unmarked += 1;
    }
    summaryEl.textContent = list.length
      ? `${list.length} student${list.length === 1 ? "" : "s"} · ${counts.present} present · ` +
        `${counts.late} late · ${counts.absent} absent · ${counts.unmarked} not marked`
      : "No students in this class.";

    if (list.length === 0) {
      listHost.replaceChildren(
        el("div", { class: "card empty-state" }, "No students here yet — add them under Students first."),
      );
      return;
    }

    listHost.replaceChildren(
      el(
        "div",
        { class: "card" },
        el(
          "ul",
          { class: "list" },
          list.map((s) => {
            const current = statusOf(s.id);
            return el("li", { class: "list-row" }, [
              el("div", { style: "flex:1" }, [
                el("div", { class: "title" }, s.name),
                el("div", { class: "subtitle" }, [s.className, groups.find((g) => g.id === s.groupId)?.name]
                  .filter(Boolean)
                  .join(" · ")),
              ]),
              el(
                "div",
                { class: "btn-row", style: "flex-wrap:nowrap;gap:4px" },
                STATUSES.map((st) =>
                  el(
                    "button",
                    {
                      class: `btn ${current === st.key ? "" : "secondary"} attendance-btn`,
                      title: st.title,
                      onclick: () => mark(s, st.key),
                    },
                    st.label,
                  ),
                ),
              ),
            ]);
          }),
        ),
      ),
    );
  }

  watchGroups(FEST_ID, (g) => {
    groups = g;
    render();
  });
  watchStudents(FEST_ID, null, (s) => {
    students = s;
    render();
  });
  subscribeAttendance();
}
