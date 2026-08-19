// Emoji throwing.
//
// A thrown emoji is a document in rooms/{code}/emotes that every player is
// listening to. It flies across the receiving screen and is then deleted by
// whoever sent it — so the subcollection stays a handful of documents
// rather than growing for the length of a game.
//
// Anything older than LIFETIME_MS is ignored on arrival, which is what
// stops a player who joins late from being pelted with the whole game's
// backlog at once.
import { db, auth, collection, doc, addDoc, deleteDoc, onSnapshot } from "./firebase.js";

export const EMOJI_TRAY = ["😂", "😮", "😍", "😭", "😡", "👏", "🎉", "🔥", "💩", "👎", "🤝", "🙏"];

const LIFETIME_MS = 8000;

export async function throwEmote(roomCode, emoji, fromName) {
  const ref = await addDoc(collection(db, "rooms", roomCode, "emotes"), {
    from: auth.currentUser.uid,
    fromName,
    emoji,
    at: Date.now(),
  });
  // Clear it up after everyone has had time to see it. Best effort: if this
  // device goes offline first, the stale document is ignored on arrival
  // anyway.
  setTimeout(() => deleteDoc(ref).catch(() => {}), LIFETIME_MS);
}

/** Calls back once per newly thrown emoji. */
export function watchEmotes(roomCode, cb) {
  const seen = new Set();
  return onSnapshot(collection(db, "rooms", roomCode, "emotes"), (snap) => {
    for (const change of snap.docChanges()) {
      if (change.type !== "added") continue;
      const emote = change.doc.data();
      if (seen.has(change.doc.id)) continue;
      seen.add(change.doc.id);
      // Skip the backlog: only things thrown while we were watching.
      if (Date.now() - (emote.at ?? 0) > LIFETIME_MS) continue;
      cb(emote);
    }
  });
}

/** Launches one emoji across the screen. Pure DOM — it draws over the
 * board rather than into it, so it costs the canvas nothing. */
export function flyEmote(emoji, fromName, { host = document.body } = {}) {
  const node = document.createElement("div");
  node.className = "emote-fly";
  node.textContent = emoji;

  // A random arc each time, so two of the same emoji don't overlap exactly.
  const fromLeft = Math.random() < 0.5;
  const drift = 20 + Math.random() * 55;
  node.style.setProperty("--from-x", fromLeft ? "-25vw" : "125vw");
  node.style.setProperty("--to-x", fromLeft ? "115vw" : "-15vw");
  node.style.setProperty("--peak-y", `${-drift}px`);
  node.style.setProperty("--spin", `${fromLeft ? 1 : -1}turn`);
  node.style.top = `${28 + Math.random() * 34}%`;

  if (fromName) {
    const label = document.createElement("span");
    label.className = "emote-who";
    label.textContent = fromName;
    node.append(label);
  }

  host.append(node);
  node.addEventListener("animationend", () => node.remove());
  // Belt and braces: if the animation event never fires (a backgrounded
  // tab), don't leave the node on screen forever.
  setTimeout(() => node.remove(), 4000);
}
