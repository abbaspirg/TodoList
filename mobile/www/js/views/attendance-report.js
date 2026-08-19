import { el, mount } from "../util.js";
import { watchStudents, watchAllAttendance } from "../data.js";
import { FEST_ID } from "../app-config.js";
import { navigate } from "../router.js";

// Attendance across dates: who has missed most, and each student's
// attendance rate.
//
// The percentage is over days the student was actually marked, not over
// every date in the fest. A day nobody recorded them isn't an absence —
// it's unknown — and counting it as one would quietly defame a student
// whose class simply wasn't registered that day. Those days are reported
// separately as "not marked" so a gap in record-keeping stays visible
// instead of being laundered into a number.
export async function renderAttendanceReport() {
  let students = [];
  let records = [];

  const fromInput = el("input", { type: "date" });
  const toInput = el("input", { type: "date" });
  const classSelect = el("select", {});
  const sortSelect = el("select", {}, [
    el("option", { value: "absent" }, "Most absent first"),
    el("option", { value: "percent" }, "Lowest attendance first"),
    el("option", { value: "name" }, "Name"),
  ]);
  const summaryHost = el("div", { class: "card" }, "Loading…");
  const listHost = el("div", {});

  mount(
    el("div", {}, [
      el("div", { class: "btn-row", style: "justify-content:space-between;align-items:center" }, [
        el("h1", { class: "page-title" }, "Attendance Report"),
        el("button", { class: "btn secondary", onclick: () => navigate("/admin/attendance") }, "Mark today"),
      ]),
      el("div", { class: "card" }, [
        el("div", { class: "field" }, [el("label", {}, "From (optional)"), fromInput]),
        el("div", { class: "field" }, [el("label", {}, "To (optional)"), toInput]),
        el("div", { class: "field" }, [el("label", {}, "Class"), classSelect]),
        el("div", { class: "field" }, [el("label", {}, "Sort by"), sortSelect]),
      ]),
      summaryHost,
      listHost,
    ]),
  );

  for (const control of [fromInput, toInput, classSelect, sortSelect]) {
    control.addEventListener("change", render);
  }

  function inRange(date) {
    if (fromInput.value && date < fromInput.value) return false;
    if (toInput.value && date > toInput.value) return false;
    return true;
  }

  function renderClassOptions() {
    const classes = [...new Set(students.map((s) => (s.className || "").trim()).filter(Boolean))].sort();
    const previous = classSelect.value;
    classSelect.replaceChildren(
      el("option", { value: "" }, "All classes"),
      ...classes.map((c) => el("option", { value: c }, c)),
    );
    classSelect.value = classes.includes(previous) ? previous : "";
  }

  function render() {
    renderClassOptions();
    const selectedClass = classSelect.value;
    const scoped = records.filter((r) => inRange(r.date));

    // Days on which each class was registered at all — the yardstick for
    // spotting students who were missed rather than absent.
    const datesByClass = new Map();
    for (const r of scoped) {
      const cls = (r.className || "").trim();
      if (!datesByClass.has(cls)) datesByClass.set(cls, new Set());
      datesByClass.get(cls).add(r.date);
    }

    const rows = students
      .filter((s) => !selectedClass || (s.className || "").trim() === selectedClass)
      .map((s) => {
        const mine = scoped.filter((r) => r.studentId === s.id);
        const present = mine.filter((r) => r.status === "present").length;
        const late = mine.filter((r) => r.status === "late").length;
        const absent = mine.filter((r) => r.status === "absent").length;
        const marked = present + late + absent;
        const classDays = datesByClass.get((s.className || "").trim())?.size ?? 0;
        return {
          student: s,
          present,
          late,
          absent,
          marked,
          notMarked: Math.max(0, classDays - marked),
          // Late still counts as attending — they turned up.
          percent: marked > 0 ? Math.round(((present + late) / marked) * 100) : null,
        };
      });

    const sortBy = sortSelect.value;
    rows.sort((a, b) => {
      if (sortBy === "name") return a.student.name.localeCompare(b.student.name);
      if (sortBy === "percent") {
        // Never-marked students have no rate to rank; keep them last
        // rather than letting them masquerade as 0%.
        if (a.percent === null) return 1;
        if (b.percent === null) return -1;
        return a.percent - b.percent || b.absent - a.absent;
      }
      return b.absent - a.absent || (a.percent ?? 101) - (b.percent ?? 101);
    });

    const allDates = [...new Set(scoped.map((r) => r.date))].sort();
    const totals = rows.reduce(
      (acc, r) => ({
        present: acc.present + r.present,
        late: acc.late + r.late,
        absent: acc.absent + r.absent,
        marked: acc.marked + r.marked,
      }),
      { present: 0, late: 0, absent: 0, marked: 0 },
    );
    const overall = totals.marked > 0 ? Math.round(((totals.present + totals.late) / totals.marked) * 100) : null;

    summaryHost.replaceChildren(
      el("h2", { style: "margin:0 0 8px;font-size:1rem" }, "Summary"),
      el(
        "div",
        { class: "subtitle" },
        allDates.length === 0
          ? "No attendance recorded for this range yet."
          : `${allDates.length} day${allDates.length === 1 ? "" : "s"} recorded ` +
            `(${allDates[0]} to ${allDates[allDates.length - 1]}) · ${rows.length} students · ` +
            `overall attendance ${overall}% · ${totals.absent} absence${totals.absent === 1 ? "" : "s"}`,
      ),
    );

    if (rows.length === 0) {
      listHost.replaceChildren(el("div", { class: "card empty-state" }, "No students match this filter."));
      return;
    }

    listHost.replaceChildren(
      el(
        "div",
        { class: "card" },
        el(
          "ul",
          { class: "list" },
          rows.map((r) =>
            el("li", { class: "list-row" }, [
              el("div", { style: "flex:1" }, [
                el("div", { class: "title" }, r.student.name),
                el(
                  "div",
                  { class: "subtitle" },
                  [
                    (r.student.className || "").trim() || "No class",
                    `${r.present} present`,
                    r.late ? `${r.late} late` : null,
                    `${r.absent} absent`,
                    r.notMarked ? `${r.notMarked} not marked` : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                ),
              ]),
              el(
                "span",
                {
                  class: "chip",
                  style:
                    r.percent === null
                      ? ""
                      : r.percent < 75
                        ? "color:var(--danger);border-color:var(--danger)"
                        : "",
                },
                r.percent === null ? "—" : `${r.percent}%`,
              ),
            ]),
          ),
        ),
      ),
    );
  }

  watchStudents(FEST_ID, null, (s) => {
    students = s;
    render();
  });
  watchAllAttendance(FEST_ID, (a) => {
    records = a;
    render();
  });
}
