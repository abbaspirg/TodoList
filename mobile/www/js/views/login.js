import { el, mount, toast } from "../util.js";
import { signIn, signOut, continueAsAdmin, continueAsJudge } from "../auth.js";
import { isLocalMode } from "../firebase.js";
import { watchJudges } from "../data.js";
import { navigate } from "../router.js";

export async function renderLogin({ signedInWithoutRole = false } = {}) {
  if (isLocalMode()) {
    await renderLocalRolePicker();
    return;
  }

  if (signedInWithoutRole) {
    mount(
      el("div", { class: "card", style: "max-width:380px;margin:40px auto" }, [
        el("h1", { class: "page-title", style: "text-align:center" }, "No access yet"),
        el(
          "p",
          {},
          "You're signed in, but this account hasn't been given a role — or it was removed. " +
            "Ask your fest admin to add you as a judge, then sign in again.",
        ),
        el("div", { class: "btn-row" }, [
          el("button", { class: "btn secondary", onclick: signOut }, "Sign out"),
        ]),
        el("p", { style: "text-align:center;margin-top:12px" }, [
          el("a", { href: "#/public", onclick: () => navigate("/public") }, "View live results"),
        ]),
      ]),
    );
    return;
  }

  const emailInput = el("input", { type: "email", placeholder: "Email" });
  const passwordInput = el("input", { type: "password", placeholder: "Password" });
  const submitBtn = el("button", { class: "btn", type: "submit" }, "Sign in");

  const form = el(
    "form",
    {
      onsubmit: async (e) => {
        e.preventDefault();
        submitBtn.disabled = true;
        submitBtn.textContent = "Signing in…";
        try {
          await signIn(emailInput.value.trim(), passwordInput.value);
        } catch (err) {
          toast("Sign in failed — check your credentials.");
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = "Sign in";
        }
      },
    },
    [
      el("div", { class: "field" }, [el("label", {}, "Email"), emailInput]),
      el("div", { class: "field" }, [el("label", {}, "Password"), passwordInput]),
      submitBtn,
    ],
  );

  mount(
    el("div", { class: "card", style: "max-width:380px;margin:40px auto" }, [
      el("h1", { class: "page-title", style: "text-align:center" }, "🕌 Madrasa Fest Manager"),
      form,
      el("p", { style: "text-align:center;margin-top:12px" }, [
        el("a", { href: "#/public", onclick: () => navigate("/public") }, "View live results (no login)"),
      ]),
    ]),
  );
}

async function renderLocalRolePicker() {
  const judgeListHost = el("div", {}, "Loading judges…");

  mount(
    el("div", { style: "max-width:420px;margin:40px auto" }, [
      el("div", { class: "card" }, [
        el("h1", { class: "page-title", style: "text-align:center" }, "🕌 Madrasa Fest Manager"),
        el(
          "p",
          { class: "chip", style: "display:block;text-align:center;margin-bottom:16px" },
          "Local Test Mode — data stays on this device only",
        ),
        el(
          "button",
          {
            class: "btn",
            style: "width:100%",
            onclick: async () => {
              await continueAsAdmin();
            },
          },
          "Continue as Admin",
        ),
      ]),
      el("div", { class: "card" }, [
        el("h2", { style: "margin-top:0" }, "Continue as Judge"),
        judgeListHost,
      ]),
      el("p", { style: "text-align:center" }, [
        el("a", { href: "#/public", onclick: () => navigate("/public") }, "View live results (no login)"),
      ]),
    ]),
  );

  watchJudges("current", (judges) => {
    if (judges.length === 0) {
      judgeListHost.replaceChildren(
        el(
          "p",
          { class: "subtitle" },
          'No judges yet — sign in as Admin first and add one under "Judges", then come back here.',
        ),
      );
      return;
    }
    judgeListHost.replaceChildren(
      el(
        "ul",
        { class: "list" },
        judges.map((j) =>
          el("li", { class: "list-row" }, [
            el("span", { style: "flex:1" }, j.name),
            el(
              "button",
              { class: "btn secondary", onclick: async () => await continueAsJudge(j.id) },
              "Continue",
            ),
          ]),
        ),
      ),
    );
  });
}
