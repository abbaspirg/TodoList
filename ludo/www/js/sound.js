// Sound effects, synthesised with the Web Audio API rather than loaded from
// files.
//
// Why synthesise: sound files would mean shipping binary assets, sorting out
// licensing for each one, and a slower first load on a phone. Every effect
// here is a few oscillators and a noise burst, costs nothing to download,
// and can be tuned by changing a number instead of finding a new recording.
//
// Browsers refuse to start audio until the user has interacted with the
// page, so the context is created lazily on the first play() and resumed if
// it was suspended — by then the player has tapped something.

const MUTE_KEY = "ludoSoundMuted";

let ctx = null;
let master = null;

export function isMuted() {
  return localStorage.getItem(MUTE_KEY) === "true";
}

export function setMuted(muted) {
  localStorage.setItem(MUTE_KEY, muted ? "true" : "false");
  if (master) master.gain.value = muted ? 0 : 0.9;
  return muted;
}

export function toggleMuted() {
  return setMuted(!isMuted());
}

function audio() {
  if (ctx) {
    // Android suspends the context when the app goes to the background.
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();
  master = ctx.createGain();
  master.gain.value = isMuted() ? 0 : 0.9;
  master.connect(ctx.destination);
  return ctx;
}

/** One tone. `type` is any OscillatorNode waveform. */
function tone(at, { freq, endFreq, duration, type = "sine", gain = 0.2, attack = 0.005 }) {
  const c = audio();
  if (!c) return;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), at + duration);

  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  osc.connect(env);
  env.connect(master);
  osc.start(at);
  osc.stop(at + duration + 0.02);
}

/** A burst of filtered noise — the rattle of dice, the knock of a piece. */
function noise(at, { duration = 0.08, gain = 0.2, filter = 1800, q = 1 } = {}) {
  const c = audio();
  if (!c) return;
  const frames = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Fades across the burst so it reads as a knock rather than a click.
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const source = c.createBufferSource();
  source.buffer = buffer;

  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = filter;
  band.Q.value = q;

  const env = c.createGain();
  env.gain.setValueAtTime(gain, at);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);

  source.connect(band);
  band.connect(env);
  env.connect(master);
  source.start(at);
}

function now() {
  const c = audio();
  return c ? c.currentTime : 0;
}

export const sounds = {
  /** Dice rattling in a cup, then landing. Runs about as long as the die
   * animation so the two finish together. */
  diceRoll() {
    const t = now();
    for (let i = 0; i < 7; i++) {
      noise(t + i * 0.07, { duration: 0.05, gain: 0.16, filter: 1200 + Math.random() * 2200, q: 2 });
    }
    noise(t + 0.56, { duration: 0.13, gain: 0.3, filter: 700, q: 1 });
    tone(t + 0.56, { freq: 190, endFreq: 90, duration: 0.14, type: "triangle", gain: 0.16 });
  },

  /** One step of a token along the track. Pitch rises with each step of the
   * same move, which is what makes a six feel like a six. */
  step(index = 0) {
    tone(now(), {
      freq: 520 + index * 45,
      duration: 0.07,
      type: "triangle",
      gain: 0.15,
    });
    noise(now(), { duration: 0.035, gain: 0.08, filter: 2600, q: 3 });
  },

  /** Sending an opponent home. */
  capture() {
    const t = now();
    noise(t, { duration: 0.16, gain: 0.3, filter: 900, q: 1 });
    tone(t, { freq: 420, endFreq: 90, duration: 0.34, type: "sawtooth", gain: 0.2 });
    tone(t + 0.04, { freq: 300, endFreq: 70, duration: 0.3, type: "square", gain: 0.1 });
  },

  /** A token reaching the centre. */
  home() {
    const t = now();
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      tone(t + i * 0.075, { freq, duration: 0.2, type: "sine", gain: 0.18 });
    });
  },

  /** A token leaving the yard on a six. */
  release() {
    const t = now();
    tone(t, { freq: 330, endFreq: 660, duration: 0.17, type: "triangle", gain: 0.18 });
  },

  /** Your turn has come round. */
  yourTurn() {
    const t = now();
    tone(t, { freq: 660, duration: 0.12, type: "sine", gain: 0.16 });
    tone(t + 0.11, { freq: 880, duration: 0.16, type: "sine", gain: 0.16 });
  },

  /** Somebody threw an emoji. */
  emote() {
    const t = now();
    tone(t, { freq: 900, endFreq: 1500, duration: 0.1, type: "sine", gain: 0.14 });
    tone(t + 0.07, { freq: 1300, endFreq: 700, duration: 0.12, type: "sine", gain: 0.1 });
  },

  /** Someone finished the game. */
  win() {
    const t = now();
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((freq, i) => {
      tone(t + i * 0.1, { freq, duration: 0.3, type: "triangle", gain: 0.2 });
    });
    noise(t + 0.5, { duration: 0.4, gain: 0.12, filter: 4000, q: 0.7 });
  },

  /** A player joined the room. */
  join() {
    const t = now();
    tone(t, { freq: 500, endFreq: 750, duration: 0.14, type: "sine", gain: 0.12 });
  },
};
