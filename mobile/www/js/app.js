import { route, notFound, navigate, startRouter } from "./router.js";
import { watchAuthState, currentRole, signOut } from "./auth.js";
import { hasFirebaseError, needsSetup, whenFirebaseReady } from "./firebase.js";
import { el, toast } from "./util.js";
import { isDark, toggleTheme } from "./theme.js";

import { renderLogin } from "./views/login.js";
import { renderNotConfigured } from "./views/not-configured.js";
import { renderSetup } from "./views/setup.js";
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
    // No project configured yet and none baked into this build — every
    // route funnels to setup until one is chosen (or Local Test Mode is).
    if (needsSetup()) {
      renderSetup();
      return;
    }
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
  if (needsSetup()) {
    renderSetup();
    return;
  }
  if (hasFirebaseError()) {
    renderNotConfigured();
    return;
  }
  if (signedIn && role) {
    navigate(role === "admin" ? "/admin" : "/judge");
    return;
  }
  // Signed in but with no role — either the account was never granted one,
  // or an admin removed this judge. Without this the login form just
  // reappears after a successful sign-in, with nothing explaining why.
  await renderLogin({ signedInWithoutRole: signedIn });
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

// --- Theme toggle --------------------------------------------------------
const themeToggleBtn = document.getElementById("themeToggleBtn");
function updateThemeToggleIcon() {
  // Icon shows the mode a tap switches *to* — a moon while light is active
  // (tap for dark), a sun while dark is active (tap for light).
  themeToggleBtn.textContent = isDark() ? "☀️" : "🌙";
  themeToggleBtn.title = isDark() ? "Switch to light mode" : "Switch to dark mode";
}
themeToggleBtn.addEventListener("click", () => {
  toggleTheme();
  updateThemeToggleIcon();
});
updateThemeToggleIcon();

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

// --- Android hardware/gesture back button -----------------------------
// The manifest's android:enableOnBackInvokedCallback="false" opts out of
// Android 13+'s predictive-back animation, but on-device testing showed
// the system gesture can still finish() the (single-)Activity outright,
// closing the app, instead of falling through to WebView history — this
// is a known inconsistency across OEM Android builds. Registering a
// listener on Capacitor's App plugin is the robust fix: Capacitor routes
// both the hardware button AND the gesture through this JS event instead
// of deciding natively, as long as a listener is attached (see
// mobile/plugins-src/capacitor-plugins.js). Only present natively —
// window.CapPlugins is undefined in a plain browser tab.
const CapApp = window.CapPlugins?.App;
if (CapApp) {
  let lastBackPressAt = 0;
  CapApp.addListener("backButton", () => {
    const path = location.hash.slice(1) || "/";
    if (!HOME_PATHS.has(path)) {
      history.back();
      return;
    }
    // On a home screen there's nowhere useful to go back to — require a
    // second press within 2s before actually exiting, the standard
    // Android "press back again to exit" pattern, instead of the single
    // swipe instantly closing the app.
    const now = Date.now();
    if (now - lastBackPressAt < 2000) {
      CapApp.exitApp();
    } else {
      lastBackPressAt = now;
      toast("Press back again to exit");
    }
  });
}

// --- Boot ---------------------------------------------------------------
async function boot() {
  await whenFirebaseReady();
  // Only watch auth when the SDK actually loaded. It won't have if no
  // project is configured (setup screen shows instead) or if init failed —
  // a blocked CDN or a device that's offline on first launch, which shows
  // views/not-configured.js. Calling watchAuthState in either case would
  // hit an undefined onAuthStateChanged and blank the whole app.
  if (!needsSetup() && !hasFirebaseError()) {
    watchAuthState(async (user) => {
      signedIn = Boolean(user);
      role = signedIn ? await currentRole() : null;
      renderNav();
      // Re-run the current route now that auth/role state is known.
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
  }
  startRouter();
  updateBackButton();
}
boot();
