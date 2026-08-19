import { el, mount, toast } from "../util.js";
import { watchFestSettings, updateFestSettings } from "../data.js";
import { FEST_ID } from "../app-config.js";

export async function renderAdminSettings() {
  const nameInput = el("input", { type: "text", placeholder: "e.g. Darul Uloom Islamic Academy" });
  const saveBtn = el("button", { class: "btn" }, "Save");

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
    ]),
  );

  watchFestSettings(FEST_ID, (settings) => {
    nameInput.value = settings?.madrasaName || "";
  });

  saveBtn.addEventListener("click", async () => {
    await updateFestSettings(FEST_ID, { madrasaName: nameInput.value.trim() });
    toast("Settings saved");
  });
}
