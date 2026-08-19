import { el, mount } from "../util.js";
import { watchJudge, watchItems } from "../data.js";
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

  // currentUserId() is the judges/{judgeId} document id in both backends —
  // js/auth.js resolves it from roles/{uid}.judgeId against Firebase, and
  // it's the judge's local id in Local Test Mode.
  const judgeId = currentUserId();
  if (!judgeId) {
    listHost.replaceChildren(
      el("div", { class: "card empty-state" }, "Couldn't tell which judge you are — sign out and back in."),
    );
    return;
  }

  watchItems(FEST_ID, null, (i) => {
    items = i;
    render();
  });
  // Reads this judge's own record, not the whole collection: the rules let
  // a judge read only their own, and Firestore rejects a collection query
  // that isn't provably within what the rules allow rather than filtering
  // it — which showed up as an empty "no items assigned" list.
  watchJudge(FEST_ID, judgeId, (me) => {
    myAssignedIds = me?.assignedItemIds || [];
    render();
  });
}
