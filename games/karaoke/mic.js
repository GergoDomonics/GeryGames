// Microphone -> {vol 0..1, hz} per call to read(). Nothing is recorded or sent; only these two numbers leave this file.
import { detectPitch } from './logic.js';

export async function createMic() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  await ctx.resume();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  ctx.createMediaStreamSource(stream).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  let vol = 0;
  return {
    read() {
      analyser.getFloatTimeDomainData(buf);
      const { rms, hz } = detectPitch(buf, ctx.sampleRate);
      vol += (Math.min(1, Math.max(0, (rms - 0.012) * 9)) - vol) * 0.5; // smoothed so the mouth does not flicker
      return { vol, hz };
    },
    stop() { stream.getTracks().forEach(t => t.stop()); ctx.close(); },
  };
}
