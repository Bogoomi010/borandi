/** 절차 생성 WebAudio 효과음 — 오디오 에셋 없이 신스로만 만든다. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let lastShot = 0;
let lastKill = 0;

function ac(): AudioContext | null {
  if (typeof window === "undefined" || !("AudioContext" in window)) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function toggleMute(): boolean {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function isMuted(): boolean { return muted; }

interface ToneOpts {
  freq: number;
  freqEnd?: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  delay?: number;
}

function tone(o: ToneOpts): void {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqEnd), t0 + o.dur);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(o.vol ?? 0.15, t0 + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0008, t0 + o.dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.02);
}

function noise(dur: number, vol: number, freq = 900, delay = 0): void {
  const c = ac();
  if (!c || !master || muted) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const srcNode = c.createBufferSource();
  srcNode.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  const gain = c.createGain();
  gain.gain.value = vol;
  srcNode.connect(filter).connect(gain).connect(master);
  srcNode.start(t0);
}

export const sfx = {
  click(): void { tone({ freq: 640, freqEnd: 520, dur: 0.06, type: "triangle", vol: 0.1 }); },

  /** 발사음: 과도한 반복 방지 스로틀 */
  shot(): void {
    const now = performance.now();
    if (now - lastShot < 70) return;
    lastShot = now;
    tone({ freq: 620 + Math.random() * 160, freqEnd: 220, dur: 0.05, type: "square", vol: 0.028 });
  },

  kill(): void {
    const now = performance.now();
    if (now - lastKill < 90) return;
    lastKill = now;
    noise(0.08, 0.05, 700);
  },

  summon(): void {
    tone({ freq: 320, freqEnd: 660, dur: 0.12, type: "triangle", vol: 0.1 });
  },

  rareSummon(): void {
    tone({ freq: 523, dur: 0.1, type: "triangle", vol: 0.12 });
    tone({ freq: 784, dur: 0.14, type: "triangle", vol: 0.12, delay: 0.08 });
  },

  merge(): void {
    tone({ freq: 392, dur: 0.09, type: "triangle", vol: 0.12 });
    tone({ freq: 523, dur: 0.09, type: "triangle", vol: 0.12, delay: 0.07 });
    tone({ freq: 659, dur: 0.16, type: "triangle", vol: 0.13, delay: 0.14 });
  },

  craft(): void {
    tone({ freq: 523, dur: 0.09, type: "square", vol: 0.07 });
    tone({ freq: 659, dur: 0.09, type: "square", vol: 0.07, delay: 0.08 });
    tone({ freq: 784, dur: 0.09, type: "square", vol: 0.07, delay: 0.16 });
    tone({ freq: 1046, dur: 0.22, type: "triangle", vol: 0.14, delay: 0.24 });
  },

  sell(): void { tone({ freq: 500, freqEnd: 240, dur: 0.12, type: "sawtooth", vol: 0.06 }); },

  upgrade(): void {
    tone({ freq: 440, freqEnd: 880, dur: 0.16, type: "sawtooth", vol: 0.07 });
  },

  roundStart(): void {
    tone({ freq: 294, dur: 0.1, type: "triangle", vol: 0.12 });
    tone({ freq: 440, dur: 0.16, type: "triangle", vol: 0.12, delay: 0.1 });
  },

  bossWarn(): void {
    tone({ freq: 98, dur: 0.4, type: "sawtooth", vol: 0.16 });
    tone({ freq: 92, dur: 0.5, type: "sawtooth", vol: 0.16, delay: 0.35 });
    noise(0.3, 0.05, 240, 0.1);
  },

  bossKill(): void {
    tone({ freq: 523, dur: 0.12, type: "triangle", vol: 0.15 });
    tone({ freq: 659, dur: 0.12, type: "triangle", vol: 0.15, delay: 0.1 });
    tone({ freq: 784, dur: 0.12, type: "triangle", vol: 0.15, delay: 0.2 });
    tone({ freq: 1046, dur: 0.3, type: "triangle", vol: 0.17, delay: 0.3 });
    noise(0.25, 0.06, 500, 0.3);
  },

  victory(): void {
    const notes = [523, 659, 784, 1046, 784, 1046];
    notes.forEach((f, i) => tone({ freq: f, dur: 0.18, type: "triangle", vol: 0.15, delay: i * 0.13 }));
  },

  defeat(): void {
    const notes = [392, 349, 311, 262];
    notes.forEach((f, i) => tone({ freq: f, dur: 0.3, type: "sawtooth", vol: 0.09, delay: i * 0.18 }));
  },

  warn(): void { tone({ freq: 740, dur: 0.09, type: "square", vol: 0.06 }); },
};
