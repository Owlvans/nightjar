// Sound from nothing: a handful of Web Audio blips, synthesised on the spot. There are no audio
// files in the game. The context is created lazily on the first user gesture (browsers refuse
// sound before that) and every call is a no-op until then, and while muted.

export function createAudio() {
  let ctx = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freqFrom, freqTo, seconds, type, volume, delay = 0) {
    if (muted || !ensure()) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  return {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    pickup() {
      tone(880, 1320, 0.12, 'sine', 0.16);
      tone(1320, 1760, 0.1, 'sine', 0.1, 0.05);
    },
    coin() {
      tone(1560, 1560, 0.07, 'square', 0.08);
      tone(2090, 2090, 0.12, 'square', 0.07, 0.07);
    },
    spotted() {
      tone(220, 110, 0.28, 'sawtooth', 0.14);
      tone(233, 116, 0.28, 'sawtooth', 0.1, 0.02);
    },
    caught() {
      tone(392, 98, 0.6, 'triangle', 0.2);
      tone(196, 49, 0.7, 'sine', 0.16, 0.08);
    },
    clear() {
      tone(523, 523, 0.11, 'sine', 0.14);
      tone(659, 659, 0.11, 'sine', 0.14, 0.1);
      tone(784, 784, 0.11, 'sine', 0.14, 0.2);
      tone(1046, 1046, 0.22, 'sine', 0.16, 0.3);
    },
    locked() {
      tone(160, 140, 0.09, 'square', 0.1);
    },
  };
}
