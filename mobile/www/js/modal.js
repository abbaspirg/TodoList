// Shared overlay dialog for the admin forms.
//
// These forms used to be appended to a host <div> placed *below* the list
// they belonged to. With a handful of records that was fine; with a real
// roster of a hundred students, tapping "Add Student" appeared to do
// nothing — the form had opened several screens further down, and tapping
// a row to edit it did the same. A modal puts the form where the tap was,
// regardless of how long the list is.
//
// Deliberately not <dialog>/showModal(): Android WebView support for it
// varies by system-WebView version on the older phones these madrasas
// actually use, and the whole app is built to degrade rather than break.
// A plain overlay behaves identically everywhere.

import { el } from "./util.js";

// A stack rather than a single reference, so an "are you sure?" dialog
// opened from inside a form closes before the form underneath it.
const openStack = [];

export function isModalOpen() {
  return openStack.length > 0;
}

/** Closes the topmost dialog and reports whether there was one. The back
 * button uses the return value to decide between closing a dialog and
 * navigating away — see js/app.js. */
export function closeTopModal() {
  const top = openStack[openStack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

export function closeAllModals() {
  while (openStack.length) openStack[openStack.length - 1].close();
}

/**
 * Opens a dialog over the current screen.
 *
 * @param {string} title    Heading shown in the dialog's header bar.
 * @param {Node|Node[]} content  Body content — usually a <form>.
 * @param {Function} [onClose]   Called once, whenever the dialog closes.
 * @returns {{ close: Function, card: HTMLElement }}
 */
export function openModal({ title = "", content = [], onClose } = {}) {
  const card = el("div", {
    class: "modal-card",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": title,
  });
  const backdrop = el("div", { class: "modal-backdrop" }, [card]);

  const handle = {
    card,
    close() {
      const index = openStack.indexOf(handle);
      if (index === -1) return; // already closed — closing twice is harmless
      openStack.splice(index, 1);
      backdrop.remove();
      if (openStack.length === 0) document.body.classList.remove("modal-open");
      onClose?.();
    },
  };

  card.append(
    el("div", { class: "modal-head" }, [
      el("h2", { class: "modal-title" }, title),
      el(
        "button",
        {
          class: "icon-btn",
          type: "button",
          "aria-label": "Close",
          onclick: () => handle.close(),
        },
        "✕",
      ),
    ]),
    el("div", { class: "modal-body" }, [].concat(content)),
  );

  // mousedown (not click) on the backdrop itself: a click fires even when
  // the press started inside the card and the finger drifted out, which
  // would throw away a half-filled form on a stray swipe.
  backdrop.addEventListener("mousedown", (e) => {
    if (e.target === backdrop) handle.close();
  });

  document.body.append(backdrop);
  document.body.classList.add("modal-open");
  openStack.push(handle);

  // Focus the first thing worth typing into so a keyboard/desktop user can
  // start straight away. File and checkbox inputs are skipped — focusing a
  // file picker puts the caret nowhere useful. preventScroll keeps the page
  // behind from jumping.
  requestAnimationFrame(() => {
    const first = card.querySelector(
      'input:not([type="file"]):not([type="checkbox"]):not([type="radio"]), select, textarea',
    );
    first?.focus({ preventScroll: true });
  });

  return handle;
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isModalOpen()) {
    e.preventDefault();
    closeTopModal();
  }
});

// A route change replaces the view underneath; a dialog belonging to the
// old screen must not survive it. Note js/app.js re-dispatches hashchange
// when auth state settles, which closes anything open then too — correct,
// since a sign-out mid-edit shouldn't leave the form on screen.
window.addEventListener("hashchange", closeAllModals);
