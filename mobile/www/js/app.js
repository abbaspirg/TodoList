import { route, notFound, navigate, startRouter } from "./router.js";
import { watchAuthState, currentRole, signOut } from "./auth.js";
import { hasFirebaseError, whenFirebaseReady } from "./firebase.js";
import { el } from "./util.js";

import { renderLogin } from "./views/login.js";
import { renderNotConfigured } from "./views/not-configured.js";
import { renderAdminDashboard } from "./views/admin-dashboard.js";
import { renderAdminStudents } from "./views/admin-students.js";
import { renderAdminGroups } from "./views/admin-groups.js";
import { renderAdminCategories } from "./views/admin-categories.js";
import { renderAdminItems } from "./views/admin-items.js";
import { renderAdminRegistrations } from "./views/admin-registrations.js";
import { renderAdminJudges } from "./views/admin-judges.js";
import { renderAdminResults } from "./views/admin-results.js";
import { renderAdminSettings } from "./views/admin-settings.js";
import { renderJudgeQueue } from "./views/judge-queue.js";
import { renderJudgeScoring } from "./views/judge-scoring.js";
import { renderPublicLeaderboard } from "./views/public-leaderboard.js";
import { renderPublicResults } from "./views/public-results.js";
import { renderPoster } from "./views/poster.js";

// --- Role-based route guards, mirroring docs/UI_UX_WORKFLOW.md §1 -----------
let signedIn = false;
let role = null;

// A route only ever blocks on a *real* Firebase misconfiguration — Local
// Test Mode (js/firebase.js isLocalMode()) runs every route normally
// against js/data-local.js, no gate needed for that case.
function page(requiredRole, renderFn) {
  return async (params) => {
    if (hasFirebaseError()) {
      renderNotConfigured();
      return;
    }
    if (requiredRole && (!signedIn || role !== requiredRole)) {
      navigate("/login");
      return;
    }
    await renderFn(params);
  };
}

route("/login", async () => {
  if (hasFirebaseError()) {
    renderNotConfigured();
    return;
  }
  if (signedIn && role) {
    navigate(role === "admin" ? "/admin" : "/judge");
    return;
  }
  await renderLogin();
});

route("/admin", page("admin", renderAdminDashboard));
route("/admin/students", page("admin", renderAdminStudents));
route("/admin/groups", page("admin", renderAdminGroups));
route("/admin/categories", page("admin", renderAdminCategories));
route("/admin/items", page("admin", renderAdminItems));
route("/admin/registrations", page("admin", renderAdminRegistrations));
route("/admin/judges", page("admin", renderAdminJudges));
route("/admin/results", page("admin", renderAdminResults));
route("/admin/settings", page("admin", renderAdminSettings));

route("/judge", page("judge", renderJudgeQueue));
route("/judge/scoring/:itemId", page("judge", renderJudgeScoring));

route("/public", page(null, renderPublicLeaderboard));
route("/public/results", page(null, renderPublicResults));
route("/poster", page(null, renderPoster));

notFound(async () => navigate(signedIn ? (role === "admin" ? "/admin" : "/judge") : "/login"));

// --- Header nav + sign-out button -------------------------------------------
function renderNav() {
  const navHost = document.getElementById("navLinks");
  const signOutBtn = document.getElementById("signOutBtn");
  navHost.replaceChildren();

  if (signedIn && role === "admin") {
    navHost.append(el("a", { href: "#/admin" }, "Dashboard"));
  } else if (signedIn && role === "judge") {
    navHost.append(el("a", { href: "#/judge" }, "My Items"));
  } else {
    navHost.append(
      el("a", { href: "#/public" }, "Leaderboard"),
      el("a", { href: "#/public/results" }, "Results"),
    );
  }
  signOutBtn.hidden = !signedIn;
}
document.getElementById("signOutBtn").addEventListener("click", signOut);

// --- Back button --------------------------------------------------------
// /login is the app's one true entry point with nowhere to go back to;
// /admin and /judge are each role's home once signed in, where Sign Out is
// the correct "leave" action, not back. Every other route — including
// /public, reached from /login's "View live results" link — gets a
// visible back button that steps back through the hash-router's history.
const HOME_PATHS = new Set(["/", "/login", "/admin", "/judge"]);
function updateBackButton() {
  const path = location.hash.slice(1) || "/";
  document.getElementById("backBtn").hidden = HOME_PATHS.has(path);
}
document.getElementById("backBtn").addEventListener("click", () => history.back());
window.addEventListener("hashchange", updateBackButton);

// --- Boot ---------------------------------------------------------------
async function boot() {
  await whenFirebaseReady();
  watchAuthState(async (user) => {
    signedIn = Boolean(user);
    role = signedIn ? await currentRole() : null;
    renderNav();
    // Re-run the current route now that auth/role state is known.
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  startRouter();
  updateBackButton();
}
boot();
