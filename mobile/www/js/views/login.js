import { el, mount, toast } from "../util.js";
import { signIn } from "../auth.js";
import { navigate } from "../router.js";

export async function renderLogin() {
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
