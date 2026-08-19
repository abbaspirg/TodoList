import { el, mount, toast } from "../util.js";
import {
  watchFestSettings,
  updateFestSettings,
  watchGroups,
  watchCategories,
  watchStudents,
  addStudentsBulk,
  deleteStudentsBulk,
} from "../data.js";
import { FEST_ID } from "../app-config.js";
import {
  buildSampleStudents,
  isSampleStudent,
  SAMPLE_CLASS_COUNT,
  SAMPLE_PER_CLASS,
} from "../sample-students.js";

export async function renderAdminSettings() {
  const nameInput = el("input", { type: "text", placeholder: "e.g. Darul Uloom Islamic Academy" });
  const saveBtn = el("button", { class: "btn" }, "Save");

  let groups = [];
  let categories = [];
  let students = [];

  const sampleStatus = el("p", { class: "subtitle", style: "margin:6px 0 12px" }, "");
  const addSampleBtn = el("button", { class: "btn secondary" }, "Add sample students");
  const removeSampleBtn = el("button", { class: "btn danger" }, "Remove sample students");

  mount(
    el("div", {}, [
      el("h1", { class: "page-title" }, "Fest Settings"),
      el("div", { class: "card" }, [
        el("div", { class: "field" }, [el("label", {}, "Madrasa name"), nameInput]),
        el(
          "p",
          { class: "footer-note", style: "text-align:left;margin:6px 0 14px" },
          "Shown on generated posters in place of the default “MEELAD FEST” branding.",
        ),
        el("div", { class: "btn-row" }, [saveBtn]),
      ]),

      el("div", { class: "card" }, [
        el("h2", { style: "margin:0 0 6px;font-size:1rem" }, "Sample students"),
        el(
          "p",
          { class: "subtitle", style: "margin:0 0 8px" },
          `Adds ${SAMPLE_CLASS_COUNT * SAMPLE_PER_CLASS} students — ${SAMPLE_PER_CLASS} in each of ` +
            `Classes 1 to ${SAMPLE_CLASS_COUNT} — for trying out attendance and registration with a ` +
            `realistic roster. It only adds students; your items, judges and results are left alone.`,
        ),
        sampleStatus,
        el("div", { class: "btn-row" }, [addSampleBtn, removeSampleBtn]),
      ]),
    ]),
  );

  function renderSampleStatus() {
    const existing = students.filter(isSampleStudent).length;
    const real = students.length - existing;
    sampleStatus.textContent =
      `${students.length} student${students.length === 1 ? "" : "s"} in the fest` +
      (existing ? ` — ${existing} of them sample records` : "") +
      (existing && real ? ` and ${real} real` : "") +
      (groups.length ? "" : " · add a Group first so they can be assigned one");
    removeSampleBtn.hidden = existing === 0;
  }

  watchFestSettings(FEST_ID, (settings) => {
    nameInput.value = settings?.madrasaName || "";
  });
  watchGroups(FEST_ID, (g) => {
    groups = g;
    renderSampleStatus();
  });
  watchCategories(FEST_ID, (c) => {
    categories = c;
  });
  watchStudents(FEST_ID, null, (s) => {
    students = s;
    renderSampleStatus();
  });

  saveBtn.addEventListener("click", async () => {
    await updateFestSettings(FEST_ID, { madrasaName: nameInput.value.trim() });
    toast("Settings saved");
  });

  addSampleBtn.addEventListener("click", async () => {
    const sample = buildSampleStudents(FEST_ID, groups, categories);
    if (
      !confirm(
        `Add ${sample.length} sample students across Classes 1-${SAMPLE_CLASS_COUNT}? ` +
          `Existing students are not touched. Running this again replaces the same sample records ` +
          `rather than duplicating them.`,
      )
    ) {
      return;
    }
    addSampleBtn.disabled = true;
    addSampleBtn.textContent = "Adding…";
    try {
      await addStudentsBulk(FEST_ID, sample);
      toast(`Added ${sample.length} sample students`);
    } catch (err) {
      toast(err?.message || "Couldn't add the sample students.");
    } finally {
      addSampleBtn.disabled = false;
      addSampleBtn.textContent = "Add sample students";
    }
  });

  removeSampleBtn.addEventListener("click", async () => {
    const ids = students.filter(isSampleStudent).map((s) => s.id);
    if (ids.length === 0) return;
    if (
      !confirm(
        `Remove ${ids.length} sample student${ids.length === 1 ? "" : "s"}? ` +
          `Their registrations and any marks given to them go too. Students you added yourself are untouched.`,
      )
    ) {
      return;
    }
    removeSampleBtn.disabled = true;
    removeSampleBtn.textContent = "Removing…";
    try {
      await deleteStudentsBulk(FEST_ID, ids);
      toast(`Removed ${ids.length} sample students`);
    } catch (err) {
      toast(err?.message || "Couldn't remove the sample students.");
    } finally {
      removeSampleBtn.disabled = false;
      removeSampleBtn.textContent = "Remove sample students";
    }
  });
}
