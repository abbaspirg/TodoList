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
  skipTurn,
  playAgain,
  leaveRoom,
} from "./rooms.js";
import { createVoiceMesh } from "./voice.js";
import { renderSetup } from "./views/setup.js";
import { renderHome } from "./views/home.js";
import { renderLobby } from "./views/lobby.js";
import { renderSettings } from "./views/settings.js";
import { renderGame, announceTurnChange, maybeAnimateDie, resetPlayView, showEmote } from "./views/play.js";
import { throwEmote, watchEmotes } from "./emotes.js";
import { sounds } from "./sound.js";
import {
  startLocalGame,
  resumeLocalGame,
  watchLocalRoom,
  localRoll,
  localMove,
  localSkip,
  localPlayAgain,
  endLocalGame,
  currentLocalUid,
} from "./local-game.js";

let room = null;
let roomCode = null;
let presence = [];
let voice = null;
let unsubRoom = null;
let unsubPresence = null;
let unsubEmotes = null;
let knownPlayerCount = 0;
let previousTurn = null;
let screen = "loading";
// Pass-and-play: the whole game lives on this device, so there is no room
// subscription, no voice and no emoji throwing — everyone is in the room
// already.
let localMode = false;

// --- Screen plumbing -------------------------------------------------------

function show(name) {
  screen = name;
  showScreen(name);
  document.getElementById("backBtn").hidden = name === "home" || name === "setup" || name === "loading";
}

function goHome() {
  renderHome({
    onCreate: handleCreate,
    onJoin: handleJoin,
    onStartLocal: handleStartLocal,
    onResumeLocal: handleResumeLocal,
    // Playing on separate phones is the only thing that needs a project;
    // pass-and-play works on a fresh install with nothing configured.
    online: {
      ready: !needsSetup() && !hasFirebaseError(),
      reason: hasFirebaseError() ? "error" : "setup",
    },
    onSettings: () => {
      renderSettings({ onBack: goHome, onSetUpProject: () => { renderSetup(); show("setup"); } });
      show("settings");
    },
  });
  show("home");
}

// --- Pass-and-play ---------------------------------------------------------

function handleStartLocal({ seats, names }) {
  startLocalGame(seats, names);
  enterLocalRoom();
}

function handleResumeLocal() {
  if (!resumeLocalGame()) return toast("That game is no longer saved.");
  enterLocalRoom();
}

function enterLocalRoom() {
  localMode = true;
  previousTurn = null;
  resetPlayView();
  unsubRoom?.();
  unsubRoom = watchLocalRoom((data) => {
    if (!data) {
      exitRoom();
      return;
    }
    room = data;
    rerender();
  });
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
  knownPlayerCount = 0;
  resetPlayView();
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

  unsubEmotes?.();
  unsubEmotes = watchEmotes(code, (emote) => {
    // Your own throw is shown immediately on tap, so don't show it twice
    // when it comes back around through Firestore.
    if (emote.from === currentUid()) return;
    showEmote(emote.emoji, emote.fromName);
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
  unsubEmotes?.();
  unsubRoom = unsubPresence = unsubEmotes = null;
  localMode = false;
  resetPlayView();
  voice?.leave();
  voice = null;
  room = null;
  roomCode = null;
  presence = [];
  goHome();
}

async function handleLeave() {
  if (localMode) {
    // The game is saved, so leaving is not losing it — say so, or nobody
    // will risk tapping it mid-game.
    if (!confirm("Back to the menu? This game is saved and you can resume it.")) return;
    exitRoom();
    return;
  }
  if (!confirm("Leave this room?")) return;
  const code = roomCode;
  exitRoom();
  await leaveRoom(code).catch(() => {});
}

// --- Voice -----------------------------------------------------------------

async function handleToggleVoice() {
  if (!room || localMode) return;

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
  // In pass-and-play the phone belongs to whoever is on turn, so that seat
  // is "me" — which is what lets every player act on the one device
  // without the game screen needing to know it is a different mode.
  const myUid = localMode ? currentLocalUid() : currentUid();
  const shared = {
    room,
    myUid,
    presence,
    voice: localMode ? null : voice,
    passAndPlay: localMode,
    onToggleVoice: handleToggleVoice,
    onLeave: handleLeave,
  };

  if (room.status === "lobby") {
    // A small chime when somebody new arrives, so the host doesn't have to
    // watch the list to know the room is filling up.
    if (room.players.length > knownPlayerCount && knownPlayerCount > 0) sounds.join();
    knownPlayerCount = room.players.length;
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
    onThrowEmote: handleThrowEmote,
    onSkipTurn: handleSkipTurn,
  });
  maybeAnimateDie(room.game);
  announceTurnChange(room, myUid, previousTurn, localMode);
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
  if (localMode) return localRoll();
  try {
    await rollForTurn(roomCode);
  } catch (err) {
    toast(err?.message || "Couldn't roll — check your connection.");
  }
}

async function handleMove(tokenIndex) {
  if (localMode) return localMove(tokenIndex);
  try {
    await moveToken(roomCode, tokenIndex);
  } catch (err) {
    toast(err?.message || "Couldn't make that move.");
  }
}

async function handleThrowEmote(emoji) {
  if (localMode) return; // everyone is already looking at the same screen
  // Shown locally first so it feels instant, then broadcast.
  showEmote(emoji, null);
  try {
    await throwEmote(roomCode, emoji, nameOfMe());
  } catch {
    // A failed throw is not worth interrupting a game over.
  }
}

async function handleSkipTurn() {
  if (localMode) return localSkip();
  try {
    await skipTurn(roomCode);
  } catch (err) {
    toast(
      err?.code === "permission-denied"
        ? "Only the host can skip a turn this soon — try again in a moment."
        : err?.message || "Couldn't skip that turn.",
    );
  }
}

async function handlePlayAgain() {
  if (localMode) return localPlayAgain();
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
  // The app no longer opens on a setup screen. Pass-and-play needs no
  // project at all, so a fresh install is playable immediately and the
  // setup is offered only where it is actually required.
  if (!needsSetup() && !hasFirebaseError()) {
    try {
      await ensureSignedIn();
    } catch (err) {
      toast(friendlyAuthError(err));
    }
  }
  goHome();
}

boot();
