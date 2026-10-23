// 효과음(기획서 6장). 지금은 소리 파일 없이 브라우저에서 합성한다(음악·음원은 나중에 정함, 기획서 4.4 'TODO(교사 결정)').
// 첫 클릭(램프 켜기) 전에는 소리를 내지 않는다. 소리를 끄면 아무것도 내지 않는다.
import type { Rel } from '../types';

let ctx: AudioContext | null = null;
let enabled = false;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

// 사용자 클릭 안에서 불러야 한다(브라우저의 소리 허락 규칙)
export function unlockAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ctx && Ctor) ctx = new Ctor();
    void ctx?.resume();
  } catch {
    ctx = null;
  }
}

function tone(freq: number, dur: number, { type = 'sine' as OscillatorType, gain = 0.18, delay = 0, slideTo = 0 } = {}) {
  if (!enabled || !ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur: number, { gain = 0.12, delay = 0, low = 400, high = 4000 } = {}) {
  if (!enabled || !ctx) return;
  const t0 = ctx.currentTime + delay;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = Math.sqrt(low * high);
  band.Q.value = 0.7;
  const amp = ctx.createGain();
  amp.gain.value = gain;
  src.connect(band).connect(amp).connect(ctx.destination);
  src.start(t0);
}

// 실 '팅': 관계마다 음 높이가 조금 다르다
const TING: Record<Rel, number> = { ALLY: 784, COLD: 659, WAR: 587, TALK: 880, NORMAL: 988, OCCUPY: 523 };

export const sfx = {
  ting: (rel: Rel) => {
    tone(TING[rel], 0.7, { gain: 0.16 });
    tone(TING[rel] * 2, 0.4, { gain: 0.05 });
  },
  wrong: () => {
    tone(196, 0.18, { type: 'triangle', gain: 0.14 });
    tone(165, 0.25, { type: 'triangle', gain: 0.14, delay: 0.16 });
  },
  highlight: () => noise(0.22, { gain: 0.07, low: 2000, high: 7000 }),
  paper: () => noise(0.16, { gain: 0.09, low: 600, high: 3000 }),
  stamp: () => {
    tone(110, 0.22, { gain: 0.3, slideTo: 60 });
    noise(0.08, { gain: 0.1, low: 200, high: 1200 });
  },
  tick: () => tone(1800, 0.03, { type: 'square', gain: 0.04 }),
  telegram: () => [0, 0.12, 0.24].forEach((d) => tone(1240, 0.07, { type: 'square', gain: 0.05, delay: d })),
  print: () => [0, 0.18, 0.36, 0.54].forEach((d) => noise(0.12, { gain: 0.08, delay: d, low: 300, high: 2000 })),
  lamp: () => {
    noise(0.04, { gain: 0.15, low: 1000, high: 5000 });
    tone(80, 0.12, { gain: 0.12 });
  },
  chime: () => [0, 0.15].forEach((d, i) => tone(i ? 1175 : 880, 0.6, { gain: 0.1, delay: d })),
};
