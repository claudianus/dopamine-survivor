'use strict';
/* ============================================================
 * 도파민 서바이버 - 시네마틱 사운드 엔진 v2
 * - 컴프레서 마스터 체인 (대폭 볼륨 상향)
 * - 스테레오 패닝 (위치 기반 공간감)
 * - 다층 레이어 사운드 디자인
 * - 절차적 다크 앰비언트 음악 엔진 (긴장도 연동)
 * ============================================================ */

const SFX = {
  ctx: null,
  master: null,   // SFX 게인
  musicBus: null, // 음악 게인
  verb: null,     // 컨볼버 리버브 (생성 IR)
  samples: {},    // 디코딩된 샘플 캐시
  muted: lsGet('ds_mute') === '1',

  /* 샘플 매핑: 게임 사운드 → 에셋 파일 (없으면 신스 폴백) */
  SAMPLE_FILES: {
    shoot: 'shoot.ogg', zap: 'zap.ogg', thunder: 'thunder.ogg',
    boom: 'boom.ogg', blast: 'blast.ogg', levelup: 'levelup.ogg',
    evolve: 'evolve.ogg', chest: 'chest.ogg', victory: 'victory.ogg',
    dash: 'dash.ogg', gem: 'gem.ogg', hurt: 'hurt.ogg',
    clang: 'clang.ogg', click: 'click.ogg', blip: 'blip.ogg',
  },
  _lastPlay: {}, // 고빈도 사운드 스로틀

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      // 컴프레서: 크게 내도 터지지 않는 시네마틱 다이내믹
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 7;
      comp.attack.value = 0.003; comp.release.value = 0.24;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.92;
      this.master.connect(comp); comp.connect(this.ctx.destination);

      // 컨볼버 리버브 (지수 감쇠 생성 IR — 0바이트 에셋 홀 feel)
      try {
        const rate = this.ctx.sampleRate, len = Math.floor(rate * 1.7);
        const ir = this.ctx.createBuffer(2, len, rate);
        for (let ch = 0; ch < 2; ch++) {
          const d = ir.getChannelData(ch);
          for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
        }
        this.verb = this.ctx.createConvolver();
        this.verb.buffer = ir;
        this.verbGain = this.ctx.createGain();
        this.verbGain.gain.value = 0.5;
        this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
      } catch (e) { this.verb = null; }

      // 음악 버스 (살짝 낮게, SFX가 위에 뜨게) + 리버브 센드
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.55;
      this.musicBus.connect(this.master);
      if (this.verb) {
        this.musicVerb = this.ctx.createGain();
        this.musicVerb.gain.value = 0.4;
        this.musicBus.connect(this.musicVerb); this.musicVerb.connect(this.verb);
      }

      // 공간용 딜레이 버스
      this.delay = this.ctx.createDelay(1.0);
      this.delay.delayTime.value = 0.375;
      this.delayFb = this.ctx.createGain();
      this.delayFb.gain.value = 0.34;
      this.delay.connect(this.delayFb); this.delayFb.connect(this.delay);
      const delayOut = this.ctx.createGain();
      delayOut.gain.value = 0.5;
      this.delay.connect(delayOut); delayOut.connect(this.master);

      // 공용 노이즈 버퍼 선행성 생성 (햇/스네어가 첫 noise() 전에 쓰므로)
      try {
        const need = Math.max(1, (1.0 * this.ctx.sampleRate) | 0);
        this._noiseBuf = this.ctx.createBuffer(1, need, this.ctx.sampleRate);
        const dd = this._noiseBuf.getChannelData(0);
        for (let i = 0; i < need; i++) dd[i] = Math.random() * 2 - 1;
        this._noiseBufLen = need;
      } catch (e) {}

      this.loadSamples();
    } catch (e) { /* 오디오 미지원 */ }
  },

  /* 샘플 비동기 로드 — 디코드 즉시 피크 스캔으로 볼륨 정규화 계수 확정.
   * 실패해도 신스 폴백이 있으므로 게임은 항상 정상 동작 */
  loadSamples() {
    if (!this.ctx || this._samplesLoading) return;
    this._samplesLoading = true;
    for (const name in this.SAMPLE_FILES) {
      const url = 'assets/audio/' + this.SAMPLE_FILES[name];
      try {
        fetch(url).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
          .then(ab => this.ctx.decodeAudioData(ab))
          .then(buf => {
            // 피크 스캔 (매 7번째 샘플로 고속 측정)
            let peak = 0;
            const ch0 = buf.getChannelData(0);
            for (let i = 0; i < ch0.length; i += 7) {
              const v = Math.abs(ch0[i]);
              if (v > peak) peak = v;
            }
            this.samples[name] = { buf, peak: peak || 1 };
          })
          .catch(() => { /* 폴백: 신스 유지 */ });
      } catch (e) {}
    }
  },

  /* 샘플 재생 — rate 랜덤화로 기계적 반복감 제거, pan/verb 지원.
   * 저장된 피크 기준 -3dBFS 타깃 정규화로 팩 내 편차 흡수 (아트 trim은 vol). */
  playSample(name, vol = 0.5, rate = 1, panNode = null, verbAmt = 0.4) {
    const entry = this.samples[name];
    if (!entry || !this.ctx || this.muted) return false;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = entry.buf;
      src.playbackRate.value = rate * (0.96 + Math.random() * 0.08);
      const g = this.ctx.createGain();
      g.gain.value = vol * Math.min(1, 0.7 / (entry.peak || 1));
      src.connect(g); g.connect(panNode || this.master);
      if (this.verb && verbAmt > 0) {
        const s = this.ctx.createGain();
        s.gain.value = verbAmt;
        g.connect(s); s.connect(this.verb);
      }
      src.start();
      return true;
    } catch (e) { return false; }
  },

  /* 고빈도 사운드 스로틀 (머드 방지) */
  throttle(name, ms) {
    const now = performance.now();
    if (now - (this._lastPlay[name] || 0) < ms) return false;
    this._lastPlay[name] = now;
    return true;
  },

  setMuted(m) {
    this.muted = m;
    lsSet('ds_mute', m ? '1' : '0');
    if (this.master) this.master.gain.value = m ? 0 : 0.92;
  },

  /* 위치 → 패닝 (-0.8 ~ 0.8) */
  pan(x) {
    if (x === undefined || !this.ctx || !G.player) return null;
    const v = clamp((x - G.player.x) / 650, -0.85, 0.85);
    if (Math.abs(v) < 0.05) return null;
    const p = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    if (!p) return null;
    p.pan.value = v;
    p.connect(this.master);
    return p;
  },

  /* 톤 헬퍼 */
  tone(freq, dur, type = 'square', vol = 0.2, slide = 0, delay = 0, panNode = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(panNode || this.master);
    if (this.verb) { const vs = this.ctx.createGain(); vs.gain.value = 0.14; g.connect(vs); vs.connect(this.verb); }
    o.start(t0); o.stop(t0 + dur + 0.03);
  },

  /* 노이즈 버스트 — 1초 공용 버퍼 재사용으로 매 호출 Buffer 할당/GC 제거 */
  _noiseBuf: null,
  _noiseBufLen: 0,
  noise(dur = 0.3, vol = 0.25, freq = 800, delay = 0, panNode = null, type = 'lowpass') {
    if (!this.ctx || this.muted) return;
    // 과도한 동시 노이즈로 인한 CPU 폭주 방지 (최대 12개)
    this._noiseCount = (this._noiseCount || 0) + 1;
    if (this._noiseCount > 12) { this._noiseCount--; return; }
    // 카운트 해제는 실제 재생 종료 시각(delay 포함) 기준 — 일찍 풀려 재입장 폭주 방지
    setTimeout(() => { this._noiseCount = Math.max(0, (this._noiseCount || 1) - 1); }, (dur + delay) * 1000 + 60);
    const t0 = this.ctx.currentTime + delay;
    const need = Math.max(1, (1.0 * this.ctx.sampleRate) | 0);
    if (!this._noiseBuf || this._noiseBufLen !== need) {
      try {
        this._noiseBuf = this.ctx.createBuffer(1, need, this.ctx.sampleRate);
        const dd = this._noiseBuf.getChannelData(0);
        for (let i = 0; i < need; i++) dd[i] = Math.random() * 2 - 1;
        this._noiseBufLen = need;
      } catch (e) { return; }
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.9 + Math.random() * 0.2;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.12), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(panNode || this.master);
    if (this.verb) { const vs = this.ctx.createGain(); vs.gain.value = 0.2; g.connect(vs); vs.connect(this.verb); }
    src.start(t0);
  },

  play(name, x) {
    if (!this.ctx || this.muted) return;
    const P = this.pan(x);
    switch (name) {
      case 'shoot':   if (this.throttle('shoot', 45)) { if (!this.playSample('shoot', 0.32, 1, P, 0.15)) { this.tone(760, 0.09, 'sawtooth', 0.09, -420, 0, P); this.noise(0.04, 0.05, 3200, 0, P, 'highpass'); } } break;
      case 'hit':     if (!this.throttle('hit', 30)) break; this.tone(190 + Math.random() * 50, 0.07, 'sine', 0.22, -70, 0, P); this.noise(0.05, 0.12, 1400, 0, P); break;
      case 'crit':    this.tone(980, 0.1, 'sawtooth', 0.2, -540, 0, P); this.tone(1560, 0.08, 'square', 0.12, -700, 0.02, P); this.noise(0.06, 0.14, 2600, 0, P, 'highpass'); this.playSample('blast', 0.3, 1.2, P, 0.3); break;
      case 'kill':    this.tone(320 + Math.random() * 100, 0.14, 'triangle', 0.24, 340, 0, P); this.tone(75, 0.16, 'sine', 0.3, -25, 0, P); this.noise(0.12, 0.14, 900, 0, P); this.playSample('blast', 0.45, 0.9, P, 0.4); break;
      case 'gem':     if (this.throttle('gem', 35)) { if (!this.playSample('gem', 0.4, 1, P, 0.25)) { this.tone(1240 + Math.random() * 140, 0.08, 'sine', 0.2, 260, 0, P); this.tone(1860, 0.1, 'sine', 0.1, 300, 0.04, P); } } break;
      case 'heal':    this.tone(520, 0.12, 'sine', 0.28, 260); this.tone(784, 0.16, 'sine', 0.2, 260, 0.09); this.tone(1046, 0.2, 'sine', 0.14, 0, 0.18); break;
      case 'magnet':  this.tone(300, 0.3, 'sine', 0.3, 980); this.noise(0.25, 0.1, 2000, 0, null, 'highpass'); break;
      case 'hurt':    this.tone(130, 0.22, 'sawtooth', 0.42, -70); this.tone(65, 0.28, 'sine', 0.4, -20); this.noise(0.16, 0.26, 700); this.playSample('hurt', 0.6, 0.72, null, 0.4); break;
      case 'levelup':
        this.playSample('levelup', 0.55, 1, null, 0.5);
        [523, 659, 784, 1046].forEach((f, i) => { this.tone(f, 0.2, 'sawtooth', 0.14, 0, i * 0.07); this.tone(f * 2, 0.16, 'sine', 0.08, 0, i * 0.07); });
        this.tone(261, 0.5, 'sine', 0.16, 0, 0);
        break;
      case 'pick':    if (!this.playSample('click', 0.5, 1.1, null, 0.2)) this.tone(760, 0.08, 'square', 0.18, 160); break;
      case 'chest':
        this.playSample('chest', 0.5, 1, null, 0.5);
        [392, 523, 659, 784, 1046].forEach((f, i) => { this.tone(f, 0.24, 'triangle', 0.22, 0, i * 0.09); });
        this.noise(0.5, 0.1, 5000, 0, null, 'highpass');
        break;
      case 'tick':    if (this.throttle('tick', 30)) { if (!this.playSample('blip', 0.35, 1.15, null, 0.1)) this.tone(980 + Math.random() * 260, 0.04, 'square', 0.12); } break;
      case 'boom':    this.tone(58, 0.5, 'sine', 0.55, -26, 0, P); this.noise(0.55, 0.4, 750, 0, P); this.noise(0.14, 0.3, 2800, 0.02, P, 'highpass'); this.playSample('boom', 0.65, 0.9, P, 0.5); break;
      case 'thunder': this.noise(0.24, 0.4, 3400, 0, P, 'highpass'); this.tone(150, 0.2, 'sawtooth', 0.2, -90, 0.02, P); this.noise(0.4, 0.2, 500, 0.04, P); this.playSample('thunder', 0.55, 1, P, 0.5); break;
      case 'boss':
        this.tone(55, 1.2, 'sawtooth', 0.4, 24); this.tone(41, 1.4, 'square', 0.28, 14, 0.12);
        this.noise(1.1, 0.16, 300);
        this.tone(110, 0.9, 'sawtooth', 0.16, 220, 0.15);
        this.playSample('boom', 0.7, 0.5, null, 0.6); // 저피치 폭발로 포효 바디
        break;
      case 'combo':   this.tone(680, 0.1, 'square', 0.2, 360); this.tone(1020, 0.12, 'square', 0.14, 480, 0.07); this.tone(1360, 0.1, 'sine', 0.1, 0, 0.13); break;
      case 'gameover':
        [440, 349, 294, 220].forEach((f, i) => { this.tone(f, 0.42, 'triangle', 0.26, -14, i * 0.22); this.tone(f / 2, 0.44, 'sine', 0.18, -8, i * 0.22); });
        this.tone(55, 1.6, 'sine', 0.3, -12, 0.85);
        break;
      case 'victory':
        this.playSample('victory', 0.5, 1, null, 0.5);
        [523, 659, 784, 1046, 784, 1046, 1318, 1568].forEach((f, i) => { this.tone(f, 0.26, 'sawtooth', 0.16, 0, i * 0.12); this.tone(f / 2, 0.3, 'triangle', 0.12, 0, i * 0.12); });
        this.noise(0.8, 0.14, 6000, 0, null, 'highpass');
        break;
      case 'dash':    this.tone(240, 0.22, 'sawtooth', 0.26, 460, 0, P); this.noise(0.18, 0.12, 1600, 0, P); this.playSample('dash', 0.4, 1.1, P, 0.3); break;
      case 'laser':   if (this.throttle('laser', 60)) { if (!this.playSample('zap', 0.35, 1, P, 0.25)) { this.tone(1500, 0.14, 'sawtooth', 0.14, -1200, 0, P); this.tone(3000, 0.08, 'sine', 0.08, -2400, 0, P); } } break;
      case 'rush':
        // 상승 라이저 + 대형 임팩트
        this.playSample('dash', 0.35, 0.7, null, 0.4);
        this.tone(110, 0.85, 'sawtooth', 0.3, 660);
        this.tone(220, 0.85, 'square', 0.16, 1320);
        this.noise(0.8, 0.2, 400);
        this.tone(58, 0.7, 'sine', 0.5, -18, 0.82);
        this.noise(0.5, 0.34, 900, 0.82);
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.16, 0, 0.85 + i * 0.05));
        break;
      case 'rushend': this.tone(880, 0.3, 'sawtooth', 0.22, -660); this.tone(440, 0.36, 'square', 0.16, -340, 0.09); break;
      case 'crystal':
        this.noise(0.4, 0.34, 3600, 0, P);
        [1568, 2093, 2637, 3136].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.16, -420, i * 0.05, P));
        this.tone(70, 0.3, 'sine', 0.3, -20, 0, P);
        break;
      case 'crystalhit': if (this.throttle('crystalhit', 40)) { if (!this.playSample('clang', 0.35, 1.2, P, 0.3)) this.tone(1900 + Math.random() * 500, 0.05, 'sine', 0.14, -320, 0, P); } break;
      case 'evolve':
        this.playSample('evolve', 0.55, 1, null, 0.5);
        [392, 523, 659, 784, 1046, 1318, 1568].forEach((f, i) => { this.tone(f, 0.24, 'sawtooth', 0.2, 0, i * 0.09); this.tone(f * 1.5, 0.2, 'sine', 0.08, 0, i * 0.09); });
        this.tone(65, 0.9, 'sine', 0.34, -14, 0);
        this.noise(0.7, 0.18, 1800);
        break;
      case 'warn':
        this.tone(185, 0.26, 'square', 0.3, -24); this.tone(185, 0.26, 'square', 0.3, -24, 0.34);
        this.tone(93, 0.6, 'sawtooth', 0.16, -10, 0.02);
        break;
      case 'charge':  this.tone(140, 0.6, 'sawtooth', 0.2, 380, 0, P); break;
      case 'ragehit': this.tone(260, 0.09, 'sawtooth', 0.16, 560, 0, P); break;
      case 'portal':  this.tone(90, 0.4, 'sine', 0.14, 60, 0, P); this.noise(0.35, 0.1, 500, 0, P); break;
      /* ===== 🎰 카지노 도파민 패밀리 ===== */
      case 'jackpot': // 잭팟 터짐 — 상승 라이저 + 코인 캐스케이드
        this.tone(220, 0.7, 'sawtooth', 0.26, 880);
        this.tone(440, 0.7, 'square', 0.12, 1760, 0, null, 0.05);
        this.noise(0.6, 0.16, 6000, 0, null, 'highpass');
        // 코인 샤라라라 (고음 디튠 벨 연타)
        [1568, 1976, 2093, 2637, 3136, 3520, 4186].forEach((f, i) => this.tone(f, 0.14, 'sine', 0.12, 0, 0.1 + i * 0.045));
        this.tone(65, 0.9, 'sine', 0.34, -16, 0);
        break;
      case 'jackpotready': // 게이지 풀충전 예고
        this.tone(523, 0.16, 'square', 0.2, 0);
        this.tone(659, 0.16, 'square', 0.2, 0, 0.13);
        this.tone(784, 0.16, 'square', 0.2, 0, 0.26);
        this.tone(1046, 0.34, 'square', 0.22, 0, 0.39);
        this.tone(2093, 0.3, 'sine', 0.1, 0, 0.39);
        break;
      case 'bigwin': // BIG/MEGA/EPIC WIN 팡파레
        this.playSample('victory', 0.5, 1, null, 0.5);
        [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => {
          this.tone(f, 0.3, 'sawtooth', 0.16, 0, i * 0.09);
          this.tone(f * 0.5, 0.32, 'triangle', 0.1, 0, i * 0.09);
        });
        this.noise(0.9, 0.14, 5500, 0, null, 'highpass');
        this.tone(55, 1.2, 'sine', 0.3, -10, 0.1);
        break;
      case 'dice': // 리롤 — 주사위 굴림 틱
        for (let i = 0; i < 5; i++) this.tone(700 + Math.random() * 900, 0.05, 'square', 0.14, -180, i * 0.055);
        this.noise(0.3, 0.08, 2400, 0, null, 'bandpass');
        break;
      case 'banish': // 밴시시 — 낮은 퍼프 + 소멸
        this.tone(180, 0.3, 'sawtooth', 0.24, -120);
        this.tone(90, 0.4, 'sine', 0.2, -50, 0.05);
        this.noise(0.35, 0.12, 900, 0.02, null);
        break;
      case 'curseoffer': // 저주 제안 — 어두운 유혹 (디튠 2음)
        this.tone(196, 0.5, 'sawtooth', 0.2, -6);
        this.tone(207, 0.5, 'sawtooth', 0.2, -6, 0.02); // 비트 유니즌
        this.tone(98, 0.7, 'sine', 0.22, -4, 0.1);
        break;
      case 'cursesuccess': // 저주 성공 — 악랄한 승리
        this.tone(110, 0.6, 'sawtooth', 0.3, 220);
        this.tone(233, 0.6, 'square', 0.14, 466, 0.05);
        [932, 1109, 1397, 1865].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.12, 0, 0.12 + i * 0.06));
        this.noise(0.5, 0.16, 4000, 0, null, 'highpass');
        break;
      case 'cursefail': // 저주 폭발 — 찢어지는 패배
        this.tone(300, 0.5, 'sawtooth', 0.3, -260);
        this.tone(150, 0.55, 'square', 0.2, -130, 0.03);
        this.noise(0.55, 0.3, 800);
        this.tone(55, 0.8, 'sine', 0.34, -18, 0.05);
        break;
      case 'heartbeat': // 💓 러시 게이지 90%+ 심장박
        this.tone(55, 0.09, 'sine', 0.4, -8);
        this.tone(55, 0.07, 'sine', 0.28, -8, 0.16);
        break;
    }
  },
};

/* ============================================================
 * 절차적 다크 앰비언트 음악 엔진
 * 드론(두 개의 디튠 톱니) + 심장박저음 + 희미한 벨
 * intensity: 0 일반 / 1 보스·위협 / 2 도파민 러시
 * ============================================================ */

const MUSIC = {
  playing: false,
  intensity: 0,
  bpm: 92,
  step: 0,
  nextT: 0,
  timer: null,
  droneOscs: [], droneGain: null, droneFilter: null, lfo: null,
  // Am – F – C – G 다크 프로그레션 (1마디 1코드)
  CHORDS: [
    { root: 55.0,  tones: [220.0, 261.63, 329.63] },  // Am
    { root: 43.65, tones: [174.61, 220.0, 261.63] },  // F
    { root: 65.41, tones: [261.63, 329.63, 392.0] },  // C
    { root: 49.0,  tones: [196.0, 246.94, 293.66] },  // G
  ],
  PENTA: [440, 523.25, 587.33, 659.25, 783.99, 880],
  arpPat: [220, 261.6, 329.6, 440, 329.6, 261.6],
  bassPat: [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 82.4, 0, 73.4, 0], // A1 C2 G1 E2

  start() {
    if (!SFX.ctx || this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextT = SFX.ctx.currentTime + 0.15;

    // 드론 레이어
    const t = SFX.ctx.currentTime;
    this.droneGain = SFX.ctx.createGain();
    this.droneGain.gain.value = 0.0;
    this.droneGain.gain.linearRampToValueAtTime(0.11, t + 2.5);
    this.droneFilter = SFX.ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 240;
    this.droneFilter.Q.value = 2.2;
    this.droneGain.connect(this.droneFilter); this.droneFilter.connect(SFX.musicBus);
    for (const [freq, det] of [[55, -6], [82.4, 5], [110.3, -2]]) {
      const o = SFX.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(this.droneGain);
      o.start();
      this.droneOscs.push(o);
    }
    // 필터 LFO (숨쉬는 드론)
    this.lfo = SFX.ctx.createOscillator();
    this.lfo.frequency.value = 0.08;
    const lg = SFX.ctx.createGain();
    lg.gain.value = 90;
    this.lfo.connect(lg); lg.connect(this.droneFilter.frequency);
    this.lfo.start();

    this.timer = setInterval(() => this.schedule(), 90);
  },

  stop() {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    const t = SFX.ctx.currentTime;
    if (this.droneGain) this.droneGain.gain.linearRampToValueAtTime(0, t + 0.8);
    const oscs = this.droneOscs, lfo = this.lfo;
    setTimeout(() => { oscs.forEach(o => { try { o.stop(); } catch (e) {} }); try { lfo.stop(); } catch (e) {} }, 1000);
    this.droneOscs = []; this.lfo = null;
  },

  setIntensity(v) { this.intensity = v; },

  schedule() {
    if (!SFX.ctx || !this.playing) return;
    const sixteenth = 60 / this.bpm / 4;
    while (this.nextT < SFX.ctx.currentTime + 0.3) {
      this.tick(this.step, this.nextT);
      this.nextT += sixteenth;
      this.step++;
    }
  },

  tick(step, t) {
    const b = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const chord = this.CHORDS[bar];
    const sixteenth = 60 / this.bpm / 4;

    // 패드: 마디 시작에 코드 깔기 (디튠 소 + 로우패스 + 느린 어택)
    if (b === 0) this.pad(chord.tones, t, sixteenth * 16);

    // 심장박 베이스: 코드 루트 추종
    if (b === 0 || b === 3 || b === 10 || b === 12 || b === 14) this.pulse(chord.root, t, 0.16);
    if (b === 6) this.pulse(chord.root * 2, t, 0.1); // 옥타브 리프트
    // 긴장도 1: 오프비트 추가 펄스
    if (this.intensity >= 1 && (b === 6 || b === 14)) this.pulse(chord.root * 1.5, t, 0.1);
    // 킥(타임파니 느낌): 마디 첫박마다
    if (b === 0 && (bar % 2 === 0)) this.kick(t);
    if (this.intensity >= 1 && b === 8) this.kick(t, 0.6);

    // 햇: 백비트 8분 + 러시엔 16분
    if (b % 4 === 2) this.hat(t, 0.05);
    if (this.intensity >= 2 && b % 2 === 1) this.hat(t, 0.03);
    // 러시 스네어
    if (this.intensity >= 2 && (b === 4 || b === 12)) this.snare(t);

    // 희미한 벨 (2마디마다 펜타토닉 리드)
    if (b === 12 && bar % 2 === 1 && Math.random() < 0.75) {
      const scale = this.PENTA;
      this.bell(choice(scale) * (Math.random() < 0.3 ? 2 : 1), t);
    }

    // 보스: 8분 아르페지오 / 러시: 16분 아르페지오 폭발
    if (this.intensity === 1 && b % 2 === 0) {
      const tones = chord.tones;
      this.blip(tones[(step / 2 | 0) % tones.length] * 2, t);
    } else if (this.intensity >= 2) {
      const f = this.arpPat[(step | 0) % this.arpPat.length] * 2;
      this.blip(f, t);
    }
  },

  pulse(freq, t, vol) {
    const o = SFX.ctx.createOscillator();
    const o2 = SFX.ctx.createOscillator();
    const g = SFX.ctx.createGain();
    const f = SFX.ctx.createBiquadFilter();
    o.type = 'square'; o.frequency.value = freq;
    o2.type = 'sine'; o2.frequency.value = freq / 2;
    f.type = 'lowpass'; f.frequency.value = 420;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(SFX.musicBus);
    o.start(t); o2.start(t); o.stop(t + 0.3); o2.stop(t + 0.3);
  },

  kick(t, volMul = 1) {
    const o = SFX.ctx.createOscillator();
    const g = SFX.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    g.gain.setValueAtTime(0.3 * volMul, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    o.connect(g); g.connect(SFX.musicBus);
    o.start(t); o.stop(t + 0.26);
  },

  bell(freq, t) {
    const o = SFX.ctx.createOscillator();
    const g = SFX.ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
    o.connect(g); g.connect(SFX.musicBus);
    g.connect(SFX.delay); // 공간감
    o.start(t); o.stop(t + 1.7);
  },

  blip(freq, t) {
    const o = SFX.ctx.createOscillator();
    const g = SFX.ctx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(g); g.connect(SFX.musicBus);
    o.start(t); o.stop(t + 0.12);
  },

  /* 패드: 마디 코드 (디튠 쌍 + 로우패스 + 느린 어택/릴리즈) */
  pad(tones, t, dur) {
    const f = SFX.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 750; f.Q.value = 0.8;
    const g = SFX.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.4);
    g.gain.setValueAtTime(0.05, t + dur - 0.4);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.1);
    f.connect(g); g.connect(SFX.musicBus);
    for (const fq of tones) {
      for (const det of [-5, 5]) {
        const o = SFX.ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = fq; o.detune.value = det;
        o.connect(f);
        o.start(t); o.stop(t + dur + 0.15);
      }
    }
  },

  /* 햇: 짧은 고역 노이즈 틱 (스케줄 시각 t에 정확히) */
  hat(t, vol) {
    if (!SFX._noiseBuf) return;
    const src = SFX.ctx.createBufferSource();
    src.buffer = SFX._noiseBuf; src.loop = true;
    src.playbackRate.value = 1.6;
    const f = SFX.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    const g = SFX.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(f); f.connect(g); g.connect(SFX.musicBus);
    src.start(t, Math.random() * 0.5, 0.08);
  },

  /* 스네어: 밴드 노이즈 + 190Hz 바디 */
  snare(t) {
    if (SFX._noiseBuf) {
      const src = SFX.ctx.createBufferSource();
      src.buffer = SFX._noiseBuf; src.loop = true;
      const f = SFX.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.9;
      const g = SFX.ctx.createGain();
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      src.connect(f); f.connect(g); g.connect(SFX.musicBus);
      src.start(t, Math.random() * 0.5, 0.18);
    }
    const o = SFX.ctx.createOscillator();
    const g2 = SFX.ctx.createGain();
    o.type = 'triangle'; o.frequency.value = 190;
    g2.gain.setValueAtTime(0.1, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g2); g2.connect(SFX.musicBus);
    o.start(t); o.stop(t + 0.12);
  },
};
