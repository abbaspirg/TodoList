import { el, mount } from "../util.js";
import { watchJudges, watchItems } from "../data.js";
import { FEST_ID } from "../app-config.js";
import { navigate } from "../router.js";
import { signOut, currentUserId } from "../auth.js";

export async function renderJudgeQueue() {
  const listHost = el("div", {});
  mount(
    el("div", {}, [
      el("div", { class: "btn-row", style: "justify-content:space-between;align-items:center" }, [
        el("h1", { class: "page-title" }, "My Items"),
        el("button", { class: "btn secondary", onclick: signOut }, "Sign out"),
      ]),
      listHost,
    ]),
  );

  let items = [];
  let myAssignedIds = [];

  function render() {
    const myItems = items
      .filter((i) => myAssignedIds.includes(i.id))
      .sort((a, b) => (a.status === "ongoing" ? -1 : b.status === "ongoing" ? 1 : 0));

    if (myItems.length === 0) {
      listHost.replaceChildren(el("div", { class: "card empty-state" }, "No items assigned to you yet."));
      return;
    }
    listHost.replaceChildren(
      ...myItems.map((item) => {
        const ongoing = item.status === "ongoing";
        return el(
          "div",
          {
            class: "card",
            style: ongoing ? "border-color:var(--primary);cursor:pointer" : "opacity:0.6",
            onclick: ongoing ? () => navigate(`/judge/scoring/${item.id}`) : undefined,
          },
          [
            el("div", { class: "title" }, item.name),
            el("span", { class: `chip status-${item.status}` }, item.status),
          ],
        );
      }),
    );
  }

  watchItems(FEST_ID, null, (i) => {
    items = i;
    render();
  });
  watchJudges(FEST_ID, (judges) => {
    // authUid matches a real Firebase Auth uid; falling back to the
    // judge's own doc id matches Local Test Mode, where "signing in" as a
    // judge uses that judge's local id directly (see js/auth-local.js).
    const uid = currentUserId();
    const me = judges.find((j) => j.authUid === uid || j.id === uid);
    myAssignedIds = me?.assignedItemIds || [];
    render();
  });
}
