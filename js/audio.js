'use strict';
/* ============================================================
 * 도파민 서바이버 - 절차적 사운드 엔진 (WebAudio, 에셋 없음)
 * ============================================================ */

const SFX = {
  ctx: null,
  master: null,
  muted: localStorage.getItem('ds_mute') === '1',

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch (e) { /* 오디오 미지원 */ }
  },

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('ds_mute', m ? '1' : '0');
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  },

  /* 기본 톤 헬퍼 */
  tone(freq, dur, type = 'square', vol = 0.2, slide = 0, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  },

  /* 노이즈 버스트 (폭발/타격) */
  noise(dur = 0.3, vol = 0.25, freq = 800, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, (dur * this.ctx.sampleRate) | 0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq, t0);
    f.frequency.exponentialRampToValueAtTime(80, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  },

  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'shoot':   this.tone(620, 0.08, 'square', 0.06, -300); break;
      case 'hit':     this.tone(200 + Math.random() * 60, 0.06, 'square', 0.1, -80); break;
      case 'crit':    this.tone(880, 0.09, 'sawtooth', 0.12, -400); this.tone(1320, 0.07, 'square', 0.08, -500, 0.02); break;
      case 'kill':    this.tone(300 + Math.random() * 120, 0.12, 'triangle', 0.16, 320); break;
      case 'gem':     this.tone(1180 + Math.random() * 120, 0.07, 'sine', 0.14, 220); break;
      case 'heal':    this.tone(520, 0.1, 'sine', 0.2, 260); this.tone(780, 0.12, 'sine', 0.16, 260, 0.08); break;
      case 'magnet':  this.tone(300, 0.25, 'sine', 0.2, 900); break;
      case 'hurt':    this.tone(140, 0.18, 'sawtooth', 0.26, -60); this.noise(0.12, 0.14, 500); break;
      case 'levelup':
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.16, 'square', 0.16, 0, i * 0.07));
        break;
      case 'pick':    this.tone(700, 0.07, 'square', 0.14, 140); break;
      case 'chest':
        [392, 523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.2, 0, i * 0.09));
        break;
      case 'tick':    this.tone(900 + Math.random() * 200, 0.03, 'square', 0.08); break;
      case 'boom':    this.noise(0.5, 0.35, 700); this.tone(70, 0.4, 'sine', 0.3, -30); break;
      case 'thunder': this.noise(0.22, 0.3, 2400); this.tone(160, 0.18, 'sawtooth', 0.14, -100); break;
      case 'boss':    this.tone(80, 0.9, 'sawtooth', 0.3, 40); this.tone(55, 1.1, 'square', 0.2, 18, 0.1); break;
      case 'combo':   this.tone(660, 0.09, 'square', 0.15, 330); this.tone(990, 0.1, 'square', 0.1, 440, 0.06); break;
      case 'gameover':
        [440, 349, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.2, -20, i * 0.18));
        break;
      case 'victory':
        [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.22, 'square', 0.18, 0, i * 0.11));
        break;
      case 'dash':    this.tone(220, 0.2, 'sawtooth', 0.2, 400); break;
      case 'laser':   this.tone(1400, 0.12, 'sawtooth', 0.1, -1100); break;
      case 'rush':
        [131, 262, 392, 523, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.14, 'square', 0.2, 0, i * 0.05));
        this.noise(0.6, 0.2, 2000);
        break;
      case 'rushend': this.tone(880, 0.25, 'sawtooth', 0.16, -600); this.tone(440, 0.3, 'square', 0.12, -300, 0.08); break;
      case 'crystal':
        this.noise(0.35, 0.3, 3200);
        [1568, 2093, 2637].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.14, -300, i * 0.05));
        break;
      case 'crystalhit': this.tone(1800 + Math.random() * 400, 0.05, 'sine', 0.1, -200); break;
      case 'evolve':
        [392, 523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.2, 'sawtooth', 0.16, 0, i * 0.09));
        this.noise(0.5, 0.15, 1500);
        break;
      case 'warn':
        this.tone(196, 0.22, 'square', 0.22, -30);
        this.tone(196, 0.22, 'square', 0.22, -30, 0.3);
        break;
      case 'charge':  this.tone(150, 0.55, 'sawtooth', 0.14, 320); break;
      case 'ragehit': this.tone(240, 0.08, 'sawtooth', 0.12, 500); break;
    }
  },
};
