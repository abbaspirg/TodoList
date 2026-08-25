import { el, mount, genId, toast } from "../util.js";
import { watchJudges, watchItems, addJudge, assignJudgeToItems, setUserRole, deleteJudge } from "../data.js";
import { FEST_ID } from "../app-config.js";
import { isLocalMode } from "../firebase.js";
import { createJudgeAccount } from "../auth.js";
import { openModal } from "../modal.js";

function friendlyAuthError(err) {
  const code = err?.code || "";
  if (code.includes("email-already-in-use")) return "That email already has an account.";
  if (code.includes("invalid-email")) return "That email address doesn't look right.";
  if (code.includes("weak-password")) return "Password must be at least 6 characters.";
  if (code.includes("operation-not-allowed")) {
    return "Enable Email/Password sign-in in the Firebase console first.";
  }
  if (code.includes("permission-denied")) return "Only an admin can add judges.";
  return err?.message || "Couldn't add that judge — please try again.";
}

export async function renderAdminJudges() {
  let items = [];
  const listHost = el("div", {});

  mount(
    el("div", {}, [
      el("h1", { class: "page-title" }, "Judges"),
      listHost,
      el("button", { class: "btn fab", onclick: () => openForm() }, "+ Add Judge"),
    ]),
  );

  function openForm() {
    const nameInput = el("input", { type: "text", required: true });
    const emailInput = el("input", { type: "email", required: !isLocalMode() || undefined });
    const passwordInput = el("input", { type: "text", minlength: "6", placeholder: "at least 6 characters" });
    const saveBtn = el("button", { class: "btn", type: "submit" }, "Save");

    let dialog = null;
    const form = el(
      "form",
      {
        onsubmit: async (e) => {
          e.preventDefault();
          const name = nameInput.value.trim();
          const email = emailInput.value.trim();
          const password = passwordInput.value;
          if (!name) return;

          saveBtn.disabled = true;
          saveBtn.textContent = "Saving…";
          try {
            const judgeId = genId();
            // In Local Test Mode there are no accounts — a judge picks
            // their name on the login screen — so the sign-in account is
            // only created against a real Firebase project.
            let authUid = null;
            if (!isLocalMode()) {
              if (!email || password.length < 6) {
                throw new Error("A judge needs an email and a password of at least 6 characters to sign in.");
              }
              authUid = await createJudgeAccount(email, password);
              // Grants the account its role. Written after the account
              // exists, before the judge doc, so a judge record never
              // exists that can't be signed into.
              await setUserRole(authUid, { role: "judge", judgeId });
            }
            await addJudge(FEST_ID, { id: judgeId, festId: FEST_ID, name, email, authUid });
            toast(isLocalMode() ? "Judge added" : `${name} can now sign in with ${email}`);
            dialog?.close();
          } catch (err) {
            toast(friendlyAuthError(err));
          } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save";
          }
        },
      },
      [
        el("div", { class: "field" }, [el("label", {}, "Name"), nameInput]),
        el("div", { class: "field" }, [el("label", {}, "Email"), emailInput]),
        !isLocalMode()
          ? el("div", { class: "field" }, [el("label", {}, "Password"), passwordInput])
          : null,
        !isLocalMode()
          ? el(
              "p",
              { class: "subtitle" },
              "Creates their sign-in account. Give them this email and password — they enter it " +
                "on their own phone after installing the app.",
            )
          : null,
        el("div", { class: "btn-row" }, [
          saveBtn,
          el("button", { class: "btn secondary", type: "button", onclick: () => dialog?.close() }, "Cancel"),
        ]),
      ],
    );

    dialog = openModal({ title: "Add Judge", content: form });
  }

  function renderJudges(judges) {
    if (judges.length === 0) {
      listHost.replaceChildren(el("div", { class: "card empty-state" }, "No judges added yet."));
      return;
    }
    listHost.replaceChildren(
      ...judges.map((judge) => {
        const assigned = new Set(judge.assignedItemIds || []);
        return el("div", { class: "card" }, [
          el("div", { class: "btn-row", style: "justify-content:space-between;align-items:flex-start" }, [
            el("div", {}, [
              el("div", { class: "title" }, judge.name),
              el("div", { class: "subtitle" }, judge.email || ""),
            ]),
            el(
              "button",
              {
                class: "btn danger",
                style: "font-size:0.75rem;padding:6px 10px",
                onclick: async () => {
                  if (
                    !confirm(
                      `Remove ${judge.name}? They'll be signed out and can no longer score. ` +
                        `Marks they already submitted are kept.`,
                    )
                  ) {
                    return;
                  }
                  try {
                    await deleteJudge(FEST_ID, judge.id, judge.authUid || null);
                    toast(`${judge.name} removed`);
                  } catch (err) {
                    toast(friendlyAuthError(err));
                  }
                },
              },
              "Delete",
            ),
          ]),
          el("div", { style: "height:8px" }),
          ...items.map((item) =>
            el("label", { class: "list-row" }, [
              el("input", {
                type: "checkbox",
                checked: assigned.has(item.id) || undefined,
                onchange: (e) => {
                  const updated = new Set(assigned);
                  e.target.checked ? updated.add(item.id) : updated.delete(item.id);
                  assignJudgeToItems(FEST_ID, judge.id, [...updated]).catch((err) => {
                    e.target.checked = !e.target.checked; // revert the box; the write didn't land
                    toast(friendlyAuthError(err));
                  });
                },
              }),
              item.name,
            ]),
          ),
        ]);
      }),
    );
  }

  watchItems(FEST_ID, null, (i) => {
    items = i;
  });
  watchJudges(FEST_ID, renderJudges);
}
