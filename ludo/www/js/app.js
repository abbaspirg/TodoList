// App controller: owns the room subscription, the voice mesh and which
// screen is showing. The views are dumb — they render what they are given
// and call back.
import { showScreen, toast } from "./util.js";
import { whenFirebaseReady, needsSetup, hasFirebaseError } from "./firebase.js";
import { ensureSignedIn, currentUid, getSavedName, friendlyAuthError } from "./auth.js";
import { isDark, toggleTheme } from "./theme.js";
import {
  createRoom,
  joinRoom,
  watchRoom,
  watchPresence,
  setPresence,
  startGame,
  rollForTurn,
  moveToken,
  playAgain,
  leaveRoom,
} from "./rooms.js";
import { createVoiceMesh } from "./voice.js";
import { renderSetup, renderNotConfigured } from "./views/setup.js";
import { renderHome } from "./views/home.js";
import { renderLobby } from "./views/lobby.js";
import { renderSettings } from "./views/settings.js";
import { renderGame, announceTurnChange } from "./views/play.js";

let room = null;
let roomCode = null;
let presence = [];
let voice = null;
let unsubRoom = null;
let unsubPresence = null;
let previousTurn = null;
let screen = "loading";

// --- Screen plumbing -------------------------------------------------------

function show(name) {
  screen = name;
  showScreen(name);
  document.getElementById("backBtn").hidden = name === "home" || name === "setup" || name === "loading";
}

function goHome() {
  renderHome({ onCreate: handleCreate, onJoin: handleJoin, onSettings: () => {
    renderSettings({ onBack: goHome });
    show("settings");
  } });
  show("home");
}

// --- Room lifecycle --------------------------------------------------------

async function handleCreate({ seats, name }) {
  const code = await createRoom({ seats, name });
  await enterRoom(code, name);
}

async function handleJoin({ code, name }) {
  const result = await joinRoom(code, name);
  await enterRoom(result.code, name);
}

async function enterRoom(code, name) {
  roomCode = code;
  previousTurn = null;
  await setPresence(code, { name, voiceOn: false }).catch(() => {});

  unsubPresence?.();
  unsubPresence = watchPresence(code, (list) => {
    presence = list;
    // Presence, not the player list, is what drives the voice mesh: there
    // is no point dialling someone who hasn't turned their microphone on,
    // and it would leave an unanswered offer sitting in Firestore.
    voice?.sync(voicePeerUids());
    rerender();
  });

  unsubRoom?.();
  unsubRoom = watchRoom(
    code,
    (data) => {
      if (!data) {
        // The host left and took the room with them.
        toast("That room has closed.");
        exitRoom();
        return;
      }
      room = data;
      rerender();
    },
    (err) => {
      toast(
        err?.code === "permission-denied"
          ? "Permission denied — publish ludo/firestore.rules in the Firebase console."
          : "Lost connection to the room.",
      );
    },
  );
}

function exitRoom() {
  unsubRoom?.();
  unsubPresence?.();
  unsubRoom = unsubPresence = null;
  voice?.leave();
  voice = null;
  room = null;
  roomCode = null;
  presence = [];
  goHome();
}

async function handleLeave() {
  if (!confirm("Leave this room?")) return;
  const code = roomCode;
  exitRoom();
  await leaveRoom(code).catch(() => {});
}

// --- Voice -----------------------------------------------------------------

async function handleToggleVoice() {
  if (!room) return;

  if (!voice) {
    voice = createVoiceMesh(roomCode, { onPeerState: () => rerender() });
    try {
      await voice.join(voicePeerUids());
      await setPresence(roomCode, { name: nameOfMe(), voiceOn: true });
      toast("Voice on — everyone in the room can hear you");
    } catch (err) {
      voice = null;
      toast(
        err?.name === "NotAllowedError"
          ? "Microphone permission was denied — allow it in your browser or phone settings."
          : "Couldn't start voice on this device.",
      );
    }
    rerender();
    return;
  }

  // Already connected: this toggles the microphone rather than dropping the
  // connections, which is what you want mid-game.
  const nowMuted = voice.setMuted(!voice.isMuted());
  await setPresence(roomCode, { name: nameOfMe(), voiceOn: !nowMuted }).catch(() => {});
  toast(nowMuted ? "Microphone muted" : "Microphone on");
  rerender();
}

/** Everyone in the room who currently has voice on, excluding me. */
function voicePeerUids() {
  const me = currentUid();
  return presence.filter((p) => p.voiceOn && p.uid !== me).map((p) => p.uid);
}

function nameOfMe() {
  return room?.players.find((p) => p.uid === currentUid())?.name || getSavedName() || "Player";
}

// --- Rendering -------------------------------------------------------------

function rerender() {
  if (!room) return;
  const myUid = currentUid();
  const shared = { room, myUid, presence, voice, onToggleVoice: handleToggleVoice, onLeave: handleLeave };

  if (room.status === "lobby") {
    show("lobby");
    renderLobby({ ...shared, onStart: handleStart });
    return;
  }

  // The screen is shown BEFORE rendering, not after: the board is a canvas
  // sized from its own clientWidth, and a hidden section measures zero — so
  // drawing first left the board blank until the next redraw.
  show("game");
  renderGame({
    ...shared,
    onRoll: handleRoll,
    onMove: handleMove,
    onPlayAgain: handlePlayAgain,
  });
  announceTurnChange(room, myUid, previousTurn);
  previousTurn = room.game?.turn ?? null;
}

async function handleStart() {
  try {
    await startGame(roomCode);
  } catch (err) {
    toast(err?.message || "Couldn't start the game.");
  }
}

async function handleRoll() {
  try {
    await rollForTurn(roomCode);
  } catch (err) {
    toast(err?.message || "Couldn't roll — check your connection.");
  }
}

async function handleMove(tokenIndex) {
  try {
    await moveToken(roomCode, tokenIndex);
  } catch (err) {
    toast(err?.message || "Couldn't make that move.");
  }
}

async function handlePlayAgain() {
  try {
    await playAgain(roomCode);
  } catch (err) {
    toast(err?.message || "Only the host can start a new round.");
  }
}

// --- Chrome ----------------------------------------------------------------

const themeToggleBtn = document.getElementById("themeToggleBtn");
function updateThemeIcon() {
  themeToggleBtn.textContent = isDark() ? "☀️" : "🌙";
}
themeToggleBtn.addEventListener("click", () => {
  toggleTheme();
  updateThemeIcon();
  rerender(); // the board is canvas-drawn, so it has to be repainted by hand
});
updateThemeIcon();

document.getElementById("backBtn").addEventListener("click", () => {
  if (screen === "settings") return goHome();
  if (room) return handleLeave();
  goHome();
});

// The board is redrawn on resize because a canvas does not reflow: without
// this, rotating the phone leaves the board drawn at the old size.
let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(rerender, 120);
});

// Android's back gesture/button, when running inside Capacitor.
const CapApp = window.CapPlugins?.App;
if (CapApp) {
  let lastBackAt = 0;
  CapApp.addListener("backButton", () => {
    if (screen === "settings") return goHome();
    if (room) return handleLeave();
    const now = Date.now();
    if (now - lastBackAt < 2000) CapApp.exitApp();
    else {
      lastBackAt = now;
      toast("Press back again to exit");
    }
  });
}

// --- Boot ------------------------------------------------------------------

async function boot() {
  await whenFirebaseReady();
  if (needsSetup()) {
    renderSetup();
    show("setup");
    return;
  }
  if (hasFirebaseError()) {
    renderNotConfigured();
    show("setup");
    return;
  }
  try {
    await ensureSignedIn();
  } catch (err) {
    toast(friendlyAuthError(err));
  }
  goHome();
}

boot();
