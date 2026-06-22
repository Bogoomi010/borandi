// WebAudio 절차 합성 사운드 — 외부 에셋 없이 효과음과 앰비언트 BGM을 만든다.
// 브라우저 정책상 첫 사용자 입력 후에만 AudioContext를 생성/재개할 수 있다.

import type { Settings } from "./settings";

export type SfxName =
  | "click" | "deny" | "summon" | "summonRare" | "merge" | "craft" | "sell"
  | "upgrade" | "waveStart" | "bossWarn" | "bossDown" | "leak"
  | "mission" | "selector" | "victory" | "defeat" | "skill";

export class GameAudio {
  private ctx: AudioContext | null = null;
  private settings: Settings;
  private musicTimer: number | null = null;
  private musicGain: GainNode | null = null;

  constructor(settings: Settings) {
    this.settings = settings;
  }

  updateSettings(s: Settings) {
    this.settings = s;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVol(), this.ctx.currentTime, 0.2);
    }
    if (this.musicVol() <= 0.001) this.stopMusic();
    else if (this.musicTimer === null && this.ctx) this.startMusic();
  }

  /** 사용자 제스처 안에서 호출해 컨텍스트를 활성화한다 */
  unlock() {
    const ac = this.ac();
    if (ac && ac.state === "suspended") void ac.resume();
    if (this.musicTimer === null && this.musicVol() > 0.001) this.startMusic();
  }

  private ac(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private sfxVol(): number { return this.settings.master * this.settings.sfx; }
  private musicVol(): number { return this.settings.master * this.settings.music * 0.25; }

  // ---------- 합성 프리미티브 ----------

  private tone(
    freq: number, dur: number, type: OscillatorType, vol: number,
    delay = 0, slideTo?: number,
  ) {
    const ac = this.ac();
    if (!ac || vol <= 0.001) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private thump(dur: number, vol: number, delay = 0) {
    const ac = this.ac();
    if (!ac || vol <= 0.001) return;
    const t0 = ac.currentTime + delay;
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    const filter = ac.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 320;
    const gain = ac.createGain();
    gain.gain.value = vol;
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(t0);
  }

  // ---------- 효과음 ----------

  sfx(name: SfxName) {
    const v = this.sfxVol();
    if (v <= 0.001) return;
    switch (name) {
      case "click": this.tone(740, 0.06, "square", v * 0.12); break;
      case "deny": this.tone(180, 0.12, "square", v * 0.18, 0, 120); break;
      case "summon": this.tone(330, 0.14, "triangle", v * 0.25, 0, 560); break;
      case "summonRare":
        this.tone(330, 0.12, "triangle", v * 0.25, 0, 660);
        this.tone(880, 0.25, "sine", v * 0.22, 0.08, 1320);
        this.tone(1320, 0.3, "sine", v * 0.15, 0.16);
        break;
      case "merge":
        this.tone(523, 0.1, "triangle", v * 0.22);
        this.tone(659, 0.1, "triangle", v * 0.22, 0.06);
        this.tone(784, 0.18, "triangle", v * 0.25, 0.12);
        break;
      case "craft":
        this.tone(392, 0.1, "sawtooth", v * 0.12);
        this.tone(523, 0.1, "sawtooth", v * 0.12, 0.07);
        this.tone(784, 0.22, "triangle", v * 0.25, 0.14);
        this.thump(0.12, v * 0.3, 0.14);
        break;
      case "sell": this.tone(620, 0.08, "square", v * 0.14, 0, 420); break;
      case "upgrade":
        this.tone(440, 0.09, "square", v * 0.15);
        this.tone(660, 0.14, "square", v * 0.15, 0.07);
        break;
      case "waveStart":
        this.thump(0.3, v * 0.6);
        this.tone(110, 0.3, "sine", v * 0.4, 0, 55);
        break;
      case "bossWarn":
        this.tone(82, 0.5, "sawtooth", v * 0.3, 0, 70);
        this.tone(82, 0.5, "sawtooth", v * 0.3, 0.55, 70);
        this.thump(0.4, v * 0.5, 0.05);
        break;
      case "bossDown":
        this.thump(0.5, v * 0.7);
        this.tone(523, 0.15, "triangle", v * 0.3, 0.1);
        this.tone(659, 0.15, "triangle", v * 0.3, 0.25);
        this.tone(1046, 0.4, "triangle", v * 0.35, 0.4);
        break;
      case "leak": this.tone(420, 0.22, "sawtooth", v * 0.25, 0, 140); break;
      case "mission":
        this.tone(1318, 0.3, "sine", v * 0.25);
        this.tone(1760, 0.45, "sine", v * 0.2, 0.12);
        break;
      case "selector":
        this.tone(880, 0.12, "triangle", v * 0.2);
        this.tone(1108, 0.2, "triangle", v * 0.22, 0.09);
        break;
      case "victory":
        for (const [i, f] of [523, 659, 784, 1046, 1318].entries()) {
          this.tone(f, 0.35, "triangle", v * 0.3, i * 0.13);
        }
        this.thump(0.5, v * 0.4, 0.5);
        break;
      case "defeat":
        for (const [i, f] of [392, 330, 262, 196].entries()) {
          this.tone(f, 0.5, "sawtooth", v * 0.16, i * 0.22);
        }
        break;
      case "skill":
        // 스킬 발동: 짧은 상승 광휘음
        this.tone(740, 0.08, "triangle", v * 0.16);
        this.tone(1180, 0.16, "sine", v * 0.16, 0.05, 1480);
        break;
    }
  }

  // ---------- 앰비언트 BGM (저음 패드 코드 순환) ----------

  startMusic() {
    const ac = this.ac();
    if (!ac || this.musicTimer !== null || this.musicVol() <= 0.001) return;
    this.musicGain = ac.createGain();
    this.musicGain.gain.value = this.musicVol();
    this.musicGain.connect(ac.destination);

    const chords: number[][] = [
      [110.0, 130.81, 164.81],  // Am
      [87.31, 110.0, 130.81],   // F
      [130.81, 164.81, 196.0],  // C
      [98.0, 123.47, 146.83],   // G
    ];
    let idx = 0;
    const playChord = () => {
      if (!this.ctx || !this.musicGain) return;
      const t0 = this.ctx.currentTime;
      for (const f of chords[idx % chords.length]) {
        for (const detune of [-3, 3]) {
          const osc = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          const filter = this.ctx.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.value = 420;
          osc.type = "sawtooth";
          osc.frequency.value = f;
          osc.detune.value = detune;
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(0.06, t0 + 1.6);
          g.gain.setValueAtTime(0.06, t0 + 3.4);
          g.gain.linearRampToValueAtTime(0, t0 + 5.2);
          osc.connect(filter).connect(g).connect(this.musicGain);
          osc.start(t0);
          osc.stop(t0 + 5.4);
        }
      }
      idx++;
    };
    playChord();
    this.musicTimer = window.setInterval(playChord, 4800);
  }

  stopMusic() {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    this.musicGain?.disconnect();
    this.musicGain = null;
  }
}
