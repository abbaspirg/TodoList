// Which servers WebRTC uses to get two phones talking to each other.
//
// STUN just tells a device what its public address looks like from the
// outside; it is a couple of tiny packets and Google runs public ones for
// free. That is enough for most connections.
//
// TURN is the fallback for the rest: when two networks refuse to let the
// devices reach each other directly (symmetric NAT, strict mobile-carrier
// firewalls, some corporate Wi-Fi), the audio has to be relayed through a
// server in the middle. Typically 10-20% of connections need it, and more
// on mobile data than on home Wi-Fi.
//
// A relay carries real traffic, so nobody gives it away unmetered — it is
// either a few dollars a month on a small VPS running coturn, or a hosted
// provider's free tier. Without one, those connections simply fail to form
// and those two players can't hear each other, while everyone else in the
// room is fine. There is no free STUN-only trick that avoids this; it is
// the one unavoidable running cost of peer-to-peer voice.
import { getBuiltInTurn } from "./app-config.js";

const STORAGE_KEY = "ludoTurnServer";

const PUBLIC_STUN = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
    ],
  },
];

/** A TURN server saved on this device from the Settings screen. Stored
 * per-device rather than in the room, so one person's paid relay is not
 * silently handed to everyone who joins their game. */
export function getSavedTurn() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveTurn({ urls, username, credential }) {
  if (!urls || !String(urls).trim()) throw new Error("Enter the TURN server URL.");
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      urls: String(urls).trim(),
      username: (username || "").trim(),
      credential: (credential || "").trim(),
    }),
  );
}

export function clearTurn() {
  localStorage.removeItem(STORAGE_KEY);
}

export function hasTurn() {
  return Boolean(getSavedTurn() || getBuiltInTurn());
}

export function getIceServers() {
  const turn = getSavedTurn() || getBuiltInTurn();
  return turn ? [...PUBLIC_STUN, turn] : [...PUBLIC_STUN];
}
