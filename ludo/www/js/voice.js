// Live voice for everyone in the room — WebRTC, audio only, peer to peer.
//
// ## Why a mesh works here and wouldn't for video
//
// Every player connects directly to every other player. With seven people
// that is six connections each. For VIDEO that would be hopeless — six
// outgoing video streams would melt a phone and saturate a home upload.
// For AUDIO it is fine: Opus speech runs around 24-40 kbit/s, so six up and
// six down is well under half a megabit each way, and decoding six audio
// streams is nothing for any phone made this decade.
//
// That is the whole reason this app can have seven-way live voice with no
// media server: a server (an SFU) would cost real money every month, and
// group VIDEO would need one. Group audio does not.
//
// The audio never touches Firebase. Firestore carries only the handshake —
// an offer, an answer and a handful of ICE candidates per pair — and WebRTC
// encrypts the media itself (SRTP) between the two devices.
import {
  db,
  auth,
  collection,
  doc,
  addDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
} from "./firebase.js";
import { getIceServers } from "./ice.js";

export function createVoiceMesh(roomCode, { onPeerState } = {}) {
  const peers = new Map(); // uid -> { pc, audio }
  let localStream = null;
  let unsubscribeSignals = null;
  let muted = false;
  let active = false;

  const myUid = () => auth.currentUser.uid;

  async function ensureMic() {
    if (localStream) return localStream;
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // Everyone is in the same call on speakerphone half the time, so
        // these are not optional niceties — without them a room of seven
        // becomes a howl of feedback.
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    for (const track of localStream.getAudioTracks()) track.enabled = !muted;
    return localStream;
  }

  async function send(to, kind, payload) {
    await addDoc(collection(db, "rooms", roomCode, "signals"), {
      from: myUid(),
      to,
      kind,
      payload: JSON.stringify(payload),
      createdAt: Date.now(),
    });
  }

  function peerFor(uid) {
    if (peers.has(uid)) return peers.get(uid);

    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    const audio = new Audio();
    audio.autoplay = true;
    // playsInline keeps iOS Safari from taking the stream fullscreen.
    audio.setAttribute("playsinline", "");

    pc.onicecandidate = (event) => {
      if (event.candidate) send(uid, "candidate", event.candidate.toJSON()).catch(() => {});
    };
    pc.ontrack = (event) => {
      audio.srcObject = event.streams[0];
      // Autoplay can be refused until the user has interacted with the
      // page; they have — they tapped "Join voice" — but retry quietly
      // rather than failing silently if the browser disagrees.
      audio.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      onPeerState?.(uid, pc.connectionState);
      if (pc.connectionState === "failed") {
        // A dropped mobile connection is normal mid-game; rebuild rather
        // than leaving a dead peer that never recovers.
        dropPeer(uid);
        if (active) connectTo(uid).catch(() => {});
      }
    };

    const entry = { pc, audio };
    peers.set(uid, entry);
    return entry;
  }

  /** Only one side of a pair may create the offer, or both send one at once
   * and the negotiation collapses ("glare"). Comparing the two user ids is
   * an arbitrary but consistent tie-break that both sides compute alike. */
  function shouldInitiate(uid) {
    return myUid() < uid;
  }

  async function connectTo(uid) {
    if (!active || uid === myUid()) return;
    const stream = await ensureMic();
    const { pc } = peerFor(uid);
    if (pc.getSenders().length === 0) {
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
    }
    if (!shouldInitiate(uid)) return; // the other side will call us
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await send(uid, "offer", offer);
  }

  async function handleSignal(signal) {
    const { from, kind } = signal;
    const payload = JSON.parse(signal.payload);
    const stream = await ensureMic();
    const { pc } = peerFor(from);

    if (kind === "offer") {
      if (pc.getSenders().length === 0) {
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(payload));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await send(from, "answer", answer);
    } else if (kind === "answer") {
      if (pc.signalingState !== "stable") {
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
      }
    } else if (kind === "candidate") {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload));
      } catch {
        // A candidate arriving before the remote description is normal and
        // harmless — the connection still forms from the others.
      }
    }
  }

  function dropPeer(uid) {
    const entry = peers.get(uid);
    if (!entry) return;
    entry.pc.close();
    entry.audio.srcObject = null;
    peers.delete(uid);
    onPeerState?.(uid, "closed");
  }

  return {
    isActive: () => active,
    isMuted: () => muted,

    /** Turns the microphone on and starts connecting to everyone listed.
     * Throws if the user denies microphone access, which the caller shows
     * as a message rather than leaving the button stuck. */
    async join(peerUids) {
      await ensureMic();
      active = true;

      unsubscribeSignals = onSnapshot(
        query(collection(db, "rooms", roomCode, "signals"), where("to", "==", myUid())),
        (snap) => {
          for (const change of snap.docChanges()) {
            if (change.type !== "added") continue;
            const signal = change.doc.data();
            handleSignal(signal)
              .catch((err) => console.error("Voice signal failed:", err))
              // Signals are consumed once. Deleting them keeps the
              // subcollection from growing for the length of the game.
              .finally(() => deleteDoc(change.doc.ref).catch(() => {}));
          }
        },
      );

      await Promise.all(peerUids.filter((uid) => uid !== myUid()).map((uid) => connectTo(uid)));
    },

    /** Called whenever the room's player list changes, so someone joining
     * mid-game gets connected and someone leaving is cleaned up. */
    async sync(peerUids) {
      if (!active) return;
      const wanted = new Set(peerUids.filter((uid) => uid !== myUid()));
      for (const uid of peers.keys()) if (!wanted.has(uid)) dropPeer(uid);
      for (const uid of wanted) if (!peers.has(uid)) await connectTo(uid).catch(() => {});
    },

    setMuted(value) {
      muted = value;
      if (localStream) for (const track of localStream.getAudioTracks()) track.enabled = !value;
      return muted;
    },

    leave() {
      active = false;
      unsubscribeSignals?.();
      unsubscribeSignals = null;
      for (const uid of [...peers.keys()]) dropPeer(uid);
      if (localStream) {
        for (const track of localStream.getTracks()) track.stop();
        localStream = null;
      }
    },
  };
}
