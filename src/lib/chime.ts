// A short two-tone notification chime via Web Audio — no audio asset, so it
// keeps the Content-Security-Policy tight. Shared by the live signal bus and the
// cabinet chat so both alert the same way. Silently no-ops if the browser blocks
// audio before a user gesture (the accompanying toast still shows).
let audioCtx: AudioContext | null = null;

export function chime(): void {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = audioCtx || new Ctor();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const t0 = audioCtx.currentTime;
    [880, 1174.7].forEach((freq, i) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = t0 + i * 0.16;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain).connect(audioCtx!.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
  } catch { /* audio blocked (no gesture yet) — the toast still shows */ }
}
