'use strict';
/* ============================================================
 * 도파민 서바이버 - 메인 게임 루프 / 렌더링 / HUD / 입력
 * ============================================================ */

const canvas = document.getElementById('game');
const outCtx = canvas.getContext('2d');

/* 씬 분리 렌더: 모든 월드 드로잉은 scene에, 최종 합성만 화면으로 */
const sceneCanvas = document.createElement('canvas');
const ctx = sceneCanvas.getContext('2d');

/* ============================================================
 * 포스트 프로세싱 파이프라인 (셰이더급)
 * 브라이트패스 블룸 / SVG 채널분리 색수차 / 방사형 블러
 * 쇼크웨이브 왜곡 / 필름 그레인 / 시네마 그레이드 / 임팩트 프레임
 * ============================================================ */
const POST = {
  filterOK: false,
  bloomA: null, bloomB: null, grain: null,
  chroma: 0, flash: 0, letterbox: 0, shocks: [], speedLineRot: 0,

  init() {
    this.filterOK = typeof ctx.filter === 'string' && ctx.filter !== undefined;
    this.bpOK = true; // 휘도 임계값 브라이트패스 지원 여부 (최초 1회 검출)
    this.bloomA = document.createElement('canvas');
    this.bloomB = document.createElement('canvas');
    this.streak = document.createElement('canvas');
    // 필름 그레인 타일
    this.grain = document.createElement('canvas');
    this.grain.width = 160; this.grain.height = 160;
    const g = this.grain.getContext('2d');
    const img = g.createImageData(160, 160);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + Math.random() * 90;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    this.resize();
  },

  resize() {
    if (!this.bloomA) return;
    const q = 0.25;
    this.bloomA.width = Math.max(2, (G.view.w * q) | 0);
    this.bloomA.height = Math.max(2, (G.view.h * q) | 0);
    this.bloomB.width = this.bloomA.width; this.bloomB.height = this.bloomA.height;
    this.streak.width = this.bloomA.width; this.streak.height = this.bloomA.height;
  },

  triggerChroma(a) { this.chroma = Math.min(1, Math.max(this.chroma, a)); },
  triggerFlash(a) { this.flash = Math.min(0.4, Math.max(this.flash, a)); },
  triggerShock(wx, wy, power) {
    // 월드 좌표 → 화면 좌표
    const cam = G.camera;
    const zoom = G.zoom * (1 + (cam.punch || 0));
    this.shocks.push({ x: (wx - cam.x) * zoom, y: (wy - cam.y) * zoom, t: 0, power });
    if (this.shocks.length > 4) this.shocks.shift();
  },

  update(dt) {
    this.chroma = Math.max(0, this.chroma - dt * 1.4);
    this.flash = Math.max(0, this.flash - dt * 3.2);
    this.letterbox = Math.max(0, this.letterbox - dt);
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      this.shocks[i].t += dt;
      if (this.shocks[i].t > 0.45) this.shocks.splice(i, 1);
    }
    if (G.rage && G.rage.active) this.speedLineRot += dt * 1.6;
  },

  render(dt, camL, camT, zoom) {
    const W = G.view.w, H = G.view.h;
    outCtx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);

    /* 쇼크웨이브 왜곡: 세로 스트립을 방사형으로 밀어냄 */
    const shock = this.shocks[0];
    if (shock && shock.power > 0.3) {
      const radius = shock.t * 1500 * shock.power;
      const bandW = 190;
      const strips = 30;
      const sw = W / strips;
      for (let i = 0; i < strips; i++) {
        const sx = i * sw;
        const cx = sx + sw / 2;
        const d = Math.abs(cx - shock.x);
        const edge = Math.abs(d - radius);
        let off = 0;
        if (edge < bandW) {
          const f = 1 - edge / bandW;
          off = Math.sin((d - radius) * 0.04) * 26 * f * shock.power * (1 - shock.t / 0.45);
        }
        outCtx.drawImage(sceneCanvas, sx * G.dpr, 0, sw * G.dpr, sceneCanvas.height,
          sx + off, 0, sw + 0.5, H);
      }
    } else {
      outCtx.drawImage(sceneCanvas, 0, 0, W, H);
    }

    /* 물리 기반 렌즈 이펙트: 휘도 임계값 브라이트패스 → 2스케일 블러 블룸 → 아나모픽 스트릭 */
    if (this.filterOK) {
      const bw = this.bloomA.width, bh = this.bloomA.height;
      const b1 = this.bloomA.getContext('2d');
      b1.setTransform(1, 0, 0, 1, 0, 0);
      b1.clearRect(0, 0, bw, bh);
      // 오직 밝은 픽셀만 통과 (휘도 임계값 0.7) — 어두운 곳엔 블룸 없음
      b1.filter = this.bpOK ? 'url(#bp)' : 'brightness(1.5) contrast(2.3)';
      b1.drawImage(sceneCanvas, 0, 0, bw, bh);
      b1.filter = 'none';
      // 최초 1회: 임계값 필터가 실제로 먹히는지 검증 (구형 엔진 폴백)
      // — 화면 중앙(플레이어 광원이 항상 있는 곳)만 샘플: 구석 비네트는 원래 검정이므로 오탐
      if (this.bpOK && !this._bpChecked) {
        this._bpChecked = true;
        try {
          const cw = Math.min(30, bw) | 0, chh = Math.min(30, bh) | 0;
          const ox = ((bw - cw) / 2) | 0, oy = ((bh - chh) / 2) | 0;
          const d = b1.getImageData(ox, oy, cw, chh).data;
          let sum = 0;
          for (let i = 3; i < d.length; i += 4) sum += d[i];
          if (sum <= 0) this.bpOK = false;
        } catch (e) { this.bpOK = false; }
      }
      // 와이드 블룸 (부드러운 광량 확산)
      const b2 = this.bloomB.getContext('2d');
      b2.setTransform(1, 0, 0, 1, 0, 0);
      b2.clearRect(0, 0, bw, bh);
      b2.filter = 'blur(7px)';
      b2.drawImage(this.bloomA, 0, 0);
      b2.filter = 'none';
      outCtx.globalCompositeOperation = 'lighter';
      outCtx.globalAlpha = 0.5;
      outCtx.drawImage(this.bloomB, 0, 0, W, H);
      // 타이트 블룸 (광원 중심의 또렷한 글로어)
      b2.clearRect(0, 0, bw, bh);
      b2.filter = 'blur(2.5px)';
      b2.drawImage(this.bloomA, 0, 0);
      b2.filter = 'none';
      outCtx.globalAlpha = 0.55;
      outCtx.drawImage(this.bloomB, 0, 0, W, H);
      // 아나모픽 렌즈 스트릭: 브라이트패스를 수평으로 6배 늘린 빛줄기
      const sc = this.streak.getContext('2d');
      sc.setTransform(1, 0, 0, 1, 0, 0);
      sc.clearRect(0, 0, bw, bh);
      sc.filter = 'blur(1.6px)';
      sc.drawImage(this.bloomA, -bw * 2.5, 0, bw * 6, bh);
      sc.filter = 'none';
      outCtx.globalAlpha = 0.4;
      outCtx.drawImage(this.streak, 0, 0, W, H);
      outCtx.globalAlpha = 1;
      outCtx.globalCompositeOperation = 'source-over';
    }

    /* 렌즈 플레어: 밝은 광원의 고스트 체인 + 십자 스타버스트 (실제 렌즈 광학 구조) */
    if (typeof LIGHTS !== 'undefined' && LIGHTS.bloom && LIGHTS.bloom.length) {
      const cands = LIGHTS.bloom.filter(l => l.a > 0.55).slice(0, 3);
      if (cands.length) {
        outCtx.globalCompositeOperation = 'lighter';
        const cx = W / 2, cy = H / 2;
        for (const l of cands) {
          const sx = (l.x - camL) * zoom, sy = (l.y - camT) * zoom;
          if (sx < -60 || sy < -60 || sx > W + 60 || sy > H + 60) continue;
          const I = clamp(l.a * clamp(l.r / 260, 0.45, 1.3), 0.3, 1.1);
          // 스타버스트 가로 스트릭 (아나모픽)
          const sl = 70 + I * 170;
          const g1 = outCtx.createLinearGradient(sx - sl, sy, sx + sl, sy);
          g1.addColorStop(0, 'rgba(255,255,255,0)');
          g1.addColorStop(0.5, `rgba(255,255,255,${(0.42 * I).toFixed(3)})`);
          g1.addColorStop(1, 'rgba(255,255,255,0)');
          outCtx.fillStyle = g1;
          outCtx.fillRect(sx - sl, sy - 1.4 * I, sl * 2, 2.8 * I);
          // 세로 스트릭 (짧게)
          const sv = 34 + I * 66;
          const g2 = outCtx.createLinearGradient(sx, sy - sv, sx, sy + sv);
          g2.addColorStop(0, 'rgba(255,255,255,0)');
          g2.addColorStop(0.5, `rgba(255,255,255,${(0.26 * I).toFixed(3)})`);
          g2.addColorStop(1, 'rgba(255,255,255,0)');
          outCtx.fillStyle = g2;
          outCtx.fillRect(sx - I, sy - sv, 2 * I, sv * 2);
          // 코어 글로어
          Glow.draw(outCtx, l.color, sx, sy, 24 + I * 34, 0.5 * I);
          // 고스트 체인: 광원→화면중심 축을 관통해 반대편까지 이어지는 렌즈 내부 반사
          const dx = cx - sx, dy = cy - sy;
          const ghosts = [[0.35, 13], [0.75, 8], [1.15, 19], [1.6, 11]];
          for (const [k, r0] of ghosts) {
            const gx = sx + dx * k, gy = sy + dy * k;
            const gr = r0 * (0.6 + I * 0.8);
            if (gx < -40 || gy < -40 || gx > W + 40 || gy > H + 40) continue;
            outCtx.strokeStyle = `rgba(205,230,255,${(0.09 * I).toFixed(3)})`;
            outCtx.lineWidth = 1.5;
            outCtx.beginPath(); outCtx.arc(gx, gy, gr, 0, TAU); outCtx.stroke();
            Glow.draw(outCtx, l.color, gx, gy, gr * 1.6, 0.07 * I);
          }
        }
        outCtx.globalCompositeOperation = 'source-over';
      }
    }

    /* 색수차: SVG 채널 분리 필터로 R/B를 반대로 미끄러뜨림 (러시·임팩트) */
    if (this.chroma > 0.02) {
      const d = 5 * this.chroma;
      outCtx.globalCompositeOperation = 'lighter';
      outCtx.globalAlpha = Math.min(0.85, 0.4 + this.chroma * 0.5);
      if (this.filterOK) {
        outCtx.filter = 'url(#chR)';
        outCtx.drawImage(sceneCanvas, d, 0, W, H);
        outCtx.filter = 'url(#chB)';
        outCtx.drawImage(sceneCanvas, -d, 0, W, H);
        outCtx.filter = 'none';
      } else {
        outCtx.drawImage(sceneCanvas, d, 0, W, H);
        outCtx.drawImage(sceneCanvas, -d, 0, W, H);
      }
      outCtx.globalAlpha = 1;
      outCtx.globalCompositeOperation = 'source-over';
    }

    /* 도파민 러시: 방사형 블러 + 스피드라인 */
    if (G.rage && G.rage.active) {
      outCtx.globalCompositeOperation = 'lighter';
      for (let k = 1; k <= 3; k++) {
        const s = 1 + k * 0.014;
        outCtx.globalAlpha = 0.1 / k;
        outCtx.drawImage(sceneCanvas, W / 2 * (1 - s), H / 2 * (1 - s), W * s, H * s);
      }
      outCtx.globalAlpha = 1;
      // 스피드라인
      const cx = W / 2, cy = H / 2;
      outCtx.strokeStyle = 'rgba(255,120,190,0.16)';
      outCtx.lineWidth = 2;
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2 + this.speedLineRot;
        const r0 = Math.min(W, H) * (0.34 + 0.16 * Math.abs(Math.sin(i * 3.7 + G.time * 9)));
        outCtx.beginPath();
        outCtx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        outCtx.lineTo(cx + Math.cos(a) * (r0 + 130), cy + Math.sin(a) * (r0 + 130));
        outCtx.stroke();
      }
      outCtx.globalCompositeOperation = 'source-over';
    }

    /* 시네마 그레이드: 중심 웜 / 가장자리 쿨 (soft-light) */
    outCtx.globalCompositeOperation = 'soft-light';
    const grade = outCtx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75);
    grade.addColorStop(0, 'rgba(255,178,110,0.32)');
    grade.addColorStop(1, 'rgba(52,96,150,0.42)');
    outCtx.fillStyle = grade;
    outCtx.fillRect(0, 0, W, H);
    outCtx.globalCompositeOperation = 'source-over';

    /* 필름 그레인 */
    outCtx.globalCompositeOperation = 'overlay';
    outCtx.globalAlpha = 0.038;
    const gx = -Math.random() * 160, gy = -Math.random() * 160;
    for (let ty2 = gy; ty2 < H; ty2 += 160) {
      for (let tx2 = gx; tx2 < W; tx2 += 160) {
        outCtx.drawImage(this.grain, tx2, ty2);
      }
    }
    outCtx.globalAlpha = 1;
    outCtx.globalCompositeOperation = 'source-over';

    /* 밤 틴트 */
    if (G.dayTint > 0.05) {
      outCtx.fillStyle = `rgba(6,10,34,${G.dayTint * 0.3})`;
      outCtx.fillRect(0, 0, W, H);
    }
    /* 러시 발열 틴트 */
    if (G.rage && G.rage.active) {
      outCtx.fillStyle = `rgba(120,20,60,${0.07 + Math.sin(G.time * 10) * 0.03})`;
      outCtx.fillRect(0, 0, W, H);
    }
    /* 비네트 */
    if (G.vigGrad) {
      outCtx.fillStyle = G.vigGrad;
      outCtx.fillRect(0, 0, W, H);
    }
    /* 피격 비네트 */
    if (G.hurtVin > 0) {
      const g = outCtx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, 'rgba(255,0,40,0)');
      g.addColorStop(1, `rgba(255,0,40,${G.hurtVin * 0.45})`);
      outCtx.fillStyle = g;
      outCtx.fillRect(0, 0, W, H);
    }
    /* 레터박스 (보스 등장 시네마틱) */
    if (this.letterbox > 0) {
      const t = Math.min(1, Math.min(this.letterbox, 1.6 - this.letterbox) / 0.4);
      const bar = Math.max(0, t) * H * 0.07;
      outCtx.fillStyle = '#000';
      outCtx.fillRect(0, 0, W, bar);
      outCtx.fillRect(0, H - bar, W, bar);
    }
    /* 임팩트 프레임 (화이트 플래시) */
    if (this.flash > 0.005) {
      outCtx.fillStyle = `rgba(240,248,255,${this.flash})`;
      outCtx.fillRect(0, 0, W, H);
    }
  },
};

/* ============================================================
 * 다이내믹 라이팅 시스템 — 라이트맵 multiply + 컬러 블룸
 * ============================================================ */
const LIGHTS = {
  canvas: null, ctx: null, scale: 0.5,
  lavaCache: [], lastLavaT: -1,
  bloom: [],

  init() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
  },
  resize() {
    if (!this.canvas) return;
    this.canvas.width = Math.max(2, (G.view.w * this.scale) | 0);
    this.canvas.height = Math.max(2, (G.view.h * this.scale) | 0);
  },

  /* 가시 영역 용암 타일 캐시 (0.5초마다 갱신) */
  sampleLava(camL, camT, vw, vh) {
    if (G.time - this.lastLavaT < 0.5) return;
    this.lastLavaT = G.time;
    this.lavaCache = [];
    const step = TILE * 2;
    for (let wy = Math.floor(camT / step) * step; wy < camT + vh; wy += step) {
      for (let wx = Math.floor(camL / step) * step; wx < camL + vw; wx += step) {
        if (MapGen.biome(Math.floor(wx / TILE), Math.floor(wy / TILE)) === B_LAVA) {
          this.lavaCache.push({ x: wx + TILE / 2, y: wy + TILE / 2 });
          if (this.lavaCache.length > 26) return;
        }
      }
    }
  },

  /* 광원 수집 → 라이트맵 렌더 → multiply 합성 → 블룸 */
  render(camL, camT, shx, shy, kx, ky, zoom) {
    const lc = this.ctx, W = this.canvas.width, H = this.canvas.height;
    const p = G.player;
    const vw = G.view.w / zoom, vh = G.view.h / zoom;
    this.sampleLava(camL, camT, vw, vh);
    const T = G.time;
    const rushOn = G.rage && G.rage.active;
    const flicker = (x, base) => base * (0.88 + 0.12 * Math.sin(T * 11 + x * 0.013));

    // 광원 수집
    const L = [];
    // 플레이어 코어: 최대 광원
    L.push({
      x: p.x, y: p.y,
      r: rushOn ? 330 : 215,
      color: rushOn ? `hsl(${(T * 220) % 360},100%,70%)` : '#a8dcff',
      a: flicker(0, 1.0),
      bloom: 0.11,
    });
    // 폭발/충격파: 강한 플래시
    for (const ex of G.explosions) {
      const t = ex.life / ex.maxLife;
      L.push({ x: ex.x, y: ex.y, r: ex.r * 2.4, color: ex.color || '#ff9a3d', a: t, bloom: t * 0.22 });
    }
    // 도파민 결정: 색조 쉬머
    for (const c of G.crystals) {
      L.push({ x: c.x, y: c.y, r: 140, color: `hsl(${c.hue + Math.sin(c.wobble) * 14},100%,66%)`, a: flicker(c.x, 0.85), bloom: 0.09 });
    }
    // 용암: 화염광
    for (const lv of this.lavaCache) {
      L.push({ x: lv.x, y: lv.y, r: 150, color: '#ff5a1f', a: flicker(lv.x, 0.6), bloom: 0 });
    }
    // 엘리트/보스
    for (const e of G.enemies) {
      if (e.elite || e.boss) L.push({ x: e.x, y: e.y, r: e.boss ? 240 : 150, color: e.boss ? '#ff2d4e' : '#ffaa2d', a: flicker(e.x, 0.7), bloom: 0 });
    }
    // 지형 기믹 광원
    for (const v of G.volatiles || []) {
      L.push({ x: v.x, y: v.y, r: v.fuse > 0 ? 190 : 90, color: v.fuse > 0 ? '#ff3b2d' : '#ff7a2d', a: flicker(v.x, 0.6), bloom: 0 });
    }
    for (const gh of G.geysers || []) {
      if (gh.state === 'erupt') L.push({ x: gh.x, y: gh.y, r: 260, color: '#ff8a3d', a: 1, bloom: 0.1 });
      else if (gh.state === 'warn') L.push({ x: gh.x, y: gh.y, r: 90 * (1 - gh.t / 0.7), color: '#ff8a3d', a: 0.5, bloom: 0 });
    }
    for (const bn of G.bouncers || []) {
      L.push({ x: bn.x, y: bn.y, r: 110, color: '#2ee6d8', a: flicker(bn.x, 0.45), bloom: 0 });
    }
    // 마탄·레이저·유탄: 움직이는 빛
    for (const b of G.projectiles) {
      if (b.kind === 'bolt') L.push({ x: b.x, y: b.y, r: 85, color: b.pierce ? `hsl(${(T * 400) % 360},100%,70%)` : '#4de3ff', a: 0.9, bloom: 0 });
      else if (b.kind === 'lance') L.push({ x: b.x, y: b.y, r: 110, color: '#b388ff', a: 0.8, bloom: 0 });
      else if (b.kind === 'grenade') L.push({ x: b.x, y: b.y, r: 55, color: '#ff6b35', a: 0.5, bloom: 0 });
    }
    // 적 투사체
    for (const b of G.eProjectiles) {
      L.push({ x: b.x, y: b.y, r: 60, color: b.color, a: 0.7, bloom: 0 });
    }
    // 젬 (가까운 것만)
    let gemCount = 0;
    for (const pk of G.pickups) {
      if (pk.kind !== 'gem') continue;
      if (dist2(pk.x, pk.y, p.x, p.y) < 500 * 500) {
        L.push({ x: pk.x, y: pk.y, r: 42, color: pk.val >= 10 ? '#b06cff' : (pk.val >= 3 ? '#ff4d9d' : '#4de3ff'), a: 0.4, bloom: 0 });
        if (++gemCount > 10) break;
      }
    }
    // 상자
    for (const pk of G.pickups) {
      if (pk.kind === 'chest') L.push({ x: pk.x, y: pk.y, r: 110, color: '#e8b74a', a: flicker(pk.x, 0.6), bloom: 0.08 });
    }
    // 상한: 화면 중심에서 가까운 순
    if (L.length > 46) {
      L.sort((a, b) => dist2(a.x, a.y, p.x, p.y) - dist2(b.x, b.y, p.x, p.y));
      L.length = 46;
    }

    // 주변광(앰비언트): 밤이 어두워지고, 러시 시 따뜻해짐
    const day = G.dayTint || 0;
    const amb = [
      Math.round(lerp(lerp(112, 74, day), 128, rushOn ? 0.5 : 0)),
      Math.round(lerp(lerp(120, 82, day), 96, rushOn ? 0.5 : 0)),
      Math.round(lerp(lerp(152, 122, day), 118, rushOn ? 0.5 : 0)),
    ];
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    lc.fillStyle = `rgb(${amb[0]},${amb[1]},${amb[2]})`;
    lc.fillRect(0, 0, W, H);

    // 라이트맵에 광원 가산
    const s = zoom * this.scale;
    lc.globalCompositeOperation = 'lighter';
    for (const l of L) {
      Glow.draw(lc, l.color, (l.x - camL) * s, (l.y - camT) * s, l.r * s, l.a);
    }

    // 씬에 multiply 합성 (어둠 속 대비)
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.canvas, 0, 0, G.view.w, G.view.h);
    ctx.globalCompositeOperation = 'source-over';

    // 컬러 블룸: 주요 광원이 지면을 물들이게
    this.bloom.length = 0;
    for (const l of L) if (l.bloom > 0) this.bloom.push(l);
    if (this.bloom.length) {
      ctx.save();
      ctx.scale(zoom, zoom);
      ctx.translate(-camL + shx, -camT + shy);
      ctx.globalCompositeOperation = 'lighter';
      for (const l of this.bloom) {
        Glow.draw(ctx, l.color, l.x, l.y, l.r * 1.15, l.bloom);
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();
    }
  },
};

/* ---------- 초기화 ---------- */
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  outCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sceneCanvas.width = canvas.width;
  sceneCanvas.height = canvas.height;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  G.dpr = dpr;
  G.view = { w: window.innerWidth, h: window.innerHeight };
  G.baseZoom = window.innerWidth < 720 ? 0.82 : 1;
  // 비네트 그라디언트 프리캐시
  G.vigGrad = outCtx.createRadialGradient(G.view.w / 2, G.view.h / 2, Math.min(G.view.w, G.view.h) * 0.36,
                                          G.view.w / 2, G.view.h / 2, Math.max(G.view.w, G.view.h) * 0.72);
  G.vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
  G.vigGrad.addColorStop(1, 'rgba(0,0,0,0.44)');
  if (LIGHTS.canvas) LIGHTS.resize();
  POST.resize();
}
window.addEventListener('resize', resize);

function initRun(seed) {
  G.seed = seed >>> 0;
  MapGen.init(G.seed);
  G.state = 'playing';
  G.time = 0;
  G.minute = 0;
  G.hitStop = 0;
  G.enemies = [];
  G.projectiles = [];
  G.eProjectiles = [];
  G.pickups = [];
  G.particles = [];
  G.dmgTexts = [];
  G.explosions = [];
  G.crystals = [];
  G.ghosts = [];
  G.bouncers = [];
  G.volatiles = [];
  G.geysers = [];
  G.hazardT = 5;
  G.boss = null;
  G.bossSpawned = new Set();
  G.stats = { kills: 0, gems: 0, bestCombo: 0 };
  G.combo = 0; G.comboT = 0;
  G.spawnAcc = 0;
  G.rushT = 45;
  G.eliteWaveT = 150;
  G.crystalT = 10;
  G.pendingLevelUps = 0;
  G.flash = 0;
  G.hurtVin = 0;
  G.dayTint = 0;
  G.rage = { value: 0, max: 100, active: false, t: 0 };
  G.userZoom = 1;
  G.zoom = G.baseZoom || 1;
  MapGen.initFog();

  G.player = {
    x: 0, y: 0, r: 16, hp: 120, maxHp: 120,
    faceX: 1, faceY: 0, iFrames: 0,
    vel: { x: 0, y: 0 }, thornAcc: 0, ghostT: 0,
    moving: false, squash: 0, walkT: 0,
    // recomputeStats()가 채움
    speed: 255, magnetR: 95, critC: 0.05, critD: 2, xpMult: 1, regen: 0,
    level: 1, xp: 0, xpNext: xpFor(1),
  };
  initPassives();
  recomputeStats();
  initWeapons();
  G.player.cape = Array.from({ length: 6 }, () => ({ x: 0, y: 0 }));

  G.camera = { x: 0, y: 0, shake: 0 };

  document.getElementById('seedTag').textContent = '시드 ' + G.seed.toString(16).toUpperCase();
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('pauseBtn').classList.remove('hidden');
  renderHUDBars();
  updateHUD(true);
  MUSIC.start(); // 다크 앰비언트 BGM
}

function xpFor(lvl) { return Math.floor(4 + (lvl - 1) * 4.5 + Math.pow(lvl - 1, 1.65)); }

/* ---------- 피해 텍스트 / 파티클 / 콤보 ---------- */
function spawnDmgText(x, y, val, crit, isPlayer) {
  if (G.dmgTexts.length > 160) G.dmgTexts.shift();
  G.dmgTexts.push({ x, y, val, crit, isPlayer: !!isPlayer, life: 0.75, maxLife: 0.75, vy: -70 - (crit ? 30 : 0), scale: crit ? 1.5 : 1 });
}
function addCombo() {
  G.combo++;
  G.comboT = 2.5;
  if (G.combo > G.stats.bestCombo) G.stats.bestCombo = G.combo;
  if (G.combo > 0 && G.combo % 25 === 0) {
    showBanner('🔥 ' + G.combo.toLocaleString() + ' 콤보!!', '#ff9f1c');
    SFX.play('combo');
    shakeCam(3);
  }
}
function showBanner(text, color) {
  const el = document.getElementById('banner');
  el.textContent = text;
  el.style.color = color || '#fff';
  el.classList.remove('show');
  void el.offsetWidth; // 리플로우로 애니메이션 리셋
  el.classList.add('show');
}

/* ---------- 도파민 러시 ---------- */
function activateRush() {
  const r = G.rage;
  if (!r || r.active || r.value < r.max) return;
  const p = G.player;
  r.active = true;
  r.t = 6;
  SFX.play('rush');
  zoomPunchCam(0.05);
  shakeCam(6);
  POST.triggerChroma(0.65);
  POST.triggerFlash(0.18);
  POST.triggerShock(p.x, p.y, 1.0);
  showBanner('🔥 도파민 러시!! 🔥', '#ff4d9d');
  document.body.classList.add('rush');
  document.getElementById('rageBtn').classList.remove('ready');
  // 발동 폭발: 주변 적 튕겨내기 + 데미지
  if (!G.hash) buildSpatialHash();
  for (const e of queryEnemies(p.x, p.y, 220)) {
    const d = dist(e.x, e.y, p.x, p.y) || 1;
    e.x += (e.x - p.x) / d * 60;
    e.y += (e.y - p.y) / d * 60;
    damageEnemy(e, 30, true, null);
  }
  for (let i = 0; i < 50; i++) {
    const a = (i / 50) * TAU;
    G.particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * rand(200, 560), vy: Math.sin(a) * rand(200, 560), life: rand(0.4, 0.9), maxLife: 0.9, size: rand(3, 7), color: `hsl(${(i / 50) * 360},100%,60%)`, grav: 0, shape: 'spark' });
  }
  G.explosions.push({ x: p.x, y: p.y, r: 320, life: 0.45, maxLife: 0.45, color: '#ff4d9d', thin: true });
}

function updateRage(dt) {
  const r = G.rage;
  if (r.active) {
    r.t -= dt;
    r.value = Math.max(0, r.max * (r.t / 6));
    if (G.player.iFrames < 0.1) G.player.iFrames = 0.1; // 러시 중 무적
    if (r.t <= 0) {
      r.active = false;
      r.value = 0;
      document.body.classList.remove('rush');
      SFX.play('rushend');
    }
  } else if (r.value >= r.max) {
    document.getElementById('rageBtn').classList.add('ready');
  }
}

/* ---------- 플레이어 ---------- */
function hurtPlayer(dmg, srcX, srcY) {
  const p = G.player;
  if (G.rage.active) { SFX.play('ragehit'); return; } // 러시 중 무적
  p.hp -= dmg;
  G.hurtVin = 1;
  if (srcX !== undefined) kickCam(srcX - p.x, srcY - p.y, 7); // 임팩트 방향으로 밀림
  else shakeCam(3);
  POST.triggerChroma(0.3);
  SFX.play('hurt');
  spawnDmgText(p.x, p.y - 24, Math.round(dmg), false, true);
  if (p.hp <= 0) { p.hp = 0; gameOver(); }
}

function updatePlayer(dt) {
  const p = G.player;
  p.iFrames = Math.max(0, p.iFrames - dt);
  p.walkT += dt * (p.moving ? 10 : 4);

  // 이동 입력
  let mx = 0, my = 0;
  if (G.keys.has('KeyW') || G.keys.has('ArrowUp')) my -= 1;
  if (G.keys.has('KeyS') || G.keys.has('ArrowDown')) my += 1;
  if (G.keys.has('KeyA') || G.keys.has('ArrowLeft')) mx -= 1;
  if (G.keys.has('KeyD') || G.keys.has('ArrowRight')) mx += 1;
  if (G.joy.active) { mx = G.joy.dx; my = G.joy.dy; }

  const len = Math.hypot(mx, my);
  p.moving = len > 0.08;

  /* 지형 속도 물리: 지형별 가속/마찰 (빙판 드리프트!) */
  const props = MapGen.groundProps(p.x, p.y);
  const rushMul = G.rage.active ? 1.3 : 1;
  let desX = 0, desY = 0;
  if (p.moving) {
    mx /= len || 1; my /= len || 1;
    p.faceX = lerp(p.faceX, mx, 0.2);
    p.faceY = lerp(p.faceY, my, 0.2);
    desX = mx * p.speed * props.spd * rushMul;
    desY = my * p.speed * props.spd * rushMul;
  }
  const k = 1 - Math.exp(-props.accel * dt);
  p.vel.x = lerp(p.vel.x, desX, k);
  p.vel.y = lerp(p.vel.y, desY, k);

  // 심수 차단: 축 분리 시도 후 막히면 반발 + 물보라
  let nx = p.x + p.vel.x * dt, ny = p.y + p.vel.y * dt;
  if (MapGen.featureAt(nx, ny) === 'deep') {
    if (MapGen.featureAt(nx, p.y) !== 'deep') { ny = p.y; p.vel.y = 0; }
    else if (MapGen.featureAt(p.x, ny) !== 'deep') { nx = p.x; p.vel.x = 0; }
    else {
      nx = p.x; ny = p.y;
      p.vel.x *= -0.3; p.vel.y *= -0.3;
    }
    if (Math.random() < dt * 40) {
      G.particles.push({ x: p.x + rand(-10, 10), y: p.y + rand(-6, 6), vx: rand(-40, 40), vy: rand(-70, -20), life: 0.4, maxLife: 0.4, size: rand(2, 4), color: 'rgba(150,190,240,0.8)', grav: 300 });
    }
  }
  p.x = nx; p.y = ny;

  // 실제 속도 크기 (스미어 판정)
  const spdNow = Math.hypot(p.vel.x, p.vel.y);

  if (p.moving || spdNow > 40) {
    // 지형별 이동 파티클
    if (props.ice && Math.random() < dt * 26) {
      G.particles.push({ x: p.x + rand(-8, 8), y: p.y + 10, vx: -p.vel.x * 0.12, vy: -p.vel.y * 0.12, life: 0.35, maxLife: 0.35, size: rand(1.5, 3), color: 'rgba(210,240,255,0.9)', grav: 0 });
    } else if (props.mud && Math.random() < dt * 22) {
      G.particles.push({ x: p.x + rand(-8, 8), y: p.y + 10, vx: rand(-30, 30), vy: rand(-50, -10), life: 0.45, maxLife: 0.45, size: rand(3, 6), color: 'rgba(58,40,24,0.8)', grav: 260 });
    } else if (props.biome === B_WATER && Math.random() < dt * 24) {
      G.particles.push({ x: p.x + rand(-10, 10), y: p.y + rand(-4, 8), vx: rand(-24, 24), vy: rand(-16, 4), life: 0.5, maxLife: 0.5, size: rand(3, 6), color: 'rgba(140,190,240,0.5)', grav: 0, shape: 'wisp' });
    } else if (Math.random() < dt * 12) {
      G.particles.push({ x: p.x + rand(-6, 6), y: p.y + 12, vx: rand(-15, 15), vy: rand(-8, 4), life: 0.3, maxLife: 0.3, size: 3, color: 'rgba(120,200,255,0.7)', grav: 0 });
    }
  }

  // 고속 스미어: 고스트 잔상
  p.ghostT = (p.ghostT || 0) - dt;
  if (spdNow > p.speed * 1.32 && p.ghostT <= 0) {
    p.ghostT = 0.05;
    G.ghosts.push({ x: p.x, y: p.y, fx: p.faceX, fy: p.faceY, life: 0.28, maxLife: 0.28 });
    if (G.ghosts.length > 14) G.ghosts.shift();
  }

  // 가시덤불: 지속 데미지 (약한 틱)
  if (props.thorn) {
    p.thornAcc += dt;
    if (p.thornAcc > 0.6) {
      p.thornAcc = 0;
      p.hp -= 3 + G.minute * 0.6;
      G.hurtVin = 0.5;
      spawnDmgText(p.x, p.y - 26, Math.round(3 + G.minute * 0.6), false, true);
      SFX.play('hit');
      sparkBurst(p.x, p.y, '#7e2338', 5, 200);
      if (p.hp <= 0) { p.hp = 0; gameOver(); }
    }
  } else p.thornAcc = 0;

  // 용암 데미지
  if (MapGen.isLava(p.x, p.y)) {
    G.lavaTick = (G.lavaTick || 0) - dt;
    if (G.lavaTick <= 0) { G.lavaTick = 0.5; hurtPlayer(4 + G.minute); }
  }

  // 재생
  if (p.regen > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

  // 픽업 자석 & 획득
  const magR = p.magnetR;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const pk = G.pickups[i];
    pk.t += dt * 4;
    pk.x += (pk.vx || 0) * dt; pk.y += (pk.vy || 0) * dt;
    pk.vx *= 0.9; pk.vy *= 0.9;
    pk.age = (pk.age || 0) + dt;
    const d2 = dist2(pk.x, pk.y, p.x, p.y);
    // 6초 이상 남아있는 젬은 어디서든 플레이어에게 이끌린다 (반경 스트레스 제거)
    // 상자·하트·자석도 10초 후면 회수되게 (무한 맵에서 유실 방지)
    const pullAge = pk.kind === 'gem' ? 6 : 10;
    if (pk.pull || d2 < magR * magR || pk.age > pullAge) {
      pk.pull = true;
      const a = ang(pk.x, pk.y, p.x, p.y);
      const sp = 520;
      pk.x += Math.cos(a) * sp * dt;
      pk.y += Math.sin(a) * sp * dt;
    }
    if (d2 < 30 * 30) {
      G.pickups.splice(i, 1);
      switch (pk.kind) {
        case 'gem':
          gainXp(pk.val);
          G.stats.gems += pk.val;
          SFX.play('gem');
          break;
        case 'heart':
          p.hp = Math.min(p.maxHp, p.hp + pk.val);
          spawnDmgText(p.x, p.y - 30, '+' + pk.val, false);
          SFX.play('heal');
          break;
        case 'magnet': {
          for (const q of G.pickups) if (q.kind === 'gem') q.pull = true;
          showBanner('🧲 젬 자석!', '#35f0ff');
          SFX.play('magnet');
          break;
        }
        case 'chest':
          openChest(pk.val);
          break;
      }
    }
  }
}

function gainXp(v) {
  const p = G.player;
  p.xp += v * p.xpMult;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = xpFor(p.level);
    G.pendingLevelUps++;
  }
  if (G.pendingLevelUps > 0 && (G.state === 'playing')) {
    openLevelUp();
  }
}

/* ---------- 파티클/텍스트 업데이트 ---------- */
function updateFx(dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const pt = G.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) { G.particles.splice(i, 1); continue; }
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vy += (pt.grav || 0) * dt;
    pt.vx *= 0.98;
  }
  if (G.particles.length > 700) G.particles.splice(0, G.particles.length - 700);

  // 고스트 잔상
  for (let i = G.ghosts.length - 1; i >= 0; i--) {
    G.ghosts[i].life -= dt;
    if (G.ghosts[i].life <= 0) G.ghosts.splice(i, 1);
  }

  for (let i = G.dmgTexts.length - 1; i >= 0; i--) {
    const t = G.dmgTexts[i];
    t.life -= dt;
    if (t.life <= 0) { G.dmgTexts.splice(i, 1); continue; }
    t.y += t.vy * dt;
    t.vy *= 0.94;
  }
}

/* ---------- 메인 업데이트 ---------- */
function update(dt) {
  if (G.hitStop > 0) { G.hitStop -= dt; dt *= 0.12; }
  G.time += dt;
  G.minute = G.time / 60;

  updatePlayer(dt);
  updateSpawns(dt);
  updateEnemies(dt);
  updateCrystals(dt);
  updateWeapons(dt);
  updateProjectiles(dt);
  updateEProjectiles(dt);
  updateFx(dt);
  updateRage(dt);
  updateHazards(dt);
  POST.update(dt);

  // 콤보 감소
  if (G.comboT > 0) {
    G.comboT -= dt;
    if (G.comboT <= 0) G.combo = 0;
  }

  // 카메라 (부드러운 추적 + 킥 감쇠 + 줌 펀치 복귀)
  const cam = G.camera;
  cam.x = lerp(cam.x, G.player.x - G.view.w / (2 * G.zoom), 1 - Math.pow(0.001, dt));
  cam.y = lerp(cam.y, G.player.y - G.view.h / (2 * G.zoom), 1 - Math.pow(0.001, dt));
  cam.shake = Math.max(0, cam.shake - dt * 18);
  const kdec = Math.exp(-dt * 7);
  cam.kickX = (cam.kickX || 0) * kdec;
  cam.kickY = (cam.kickY || 0) * kdec;
  cam.punch = (cam.punch || 0) * Math.exp(-dt * 6);
  // 휠 줌 보간
  G.zoom = lerp(G.zoom, (G.baseZoom || 1) * (G.userZoom || 1), 1 - Math.exp(-dt * 8));

  MapGen.updateFog(dt);

  // 낮/밤 틴트 (20분 주기)
  G.dayTint = (Math.sin(G.time / 60 * TAU * 0.7 - Math.PI / 2) + 1) / 2;

  G.hurtVin = Math.max(0, G.hurtVin - dt * 2.2);

  // 음악 긴장도: 보스 1 / 러시 2
  if (MUSIC.playing) MUSIC.setIntensity(G.rage.active ? 2 : (G.boss ? 1 : 0));

  updateHUD(false);
}

/* ---------- 렌더 ---------- */
function render() {
  const cam = G.camera;
  // 흔들림은 대형 이벤트만, 킥은 방향성 임팩트
  const shx = rand(-cam.shake, cam.shake), shy = rand(-cam.shake, cam.shake);
  const kx = cam.kickX || 0, ky = cam.kickY || 0;
  const zoom = G.zoom * (1 + (cam.punch || 0));

  ctx.fillStyle = '#070910';
  ctx.fillRect(0, 0, G.view.w, G.view.h);

  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-cam.x + shx + kx, -cam.y + shy + ky);

  const vw = G.view.w / zoom, vh = G.view.h / zoom;
  MapGen.drawWorld(ctx, cam.x - shx - kx - 4, cam.y - shy - ky - 4, vw + 8, vh + 8);

  // 뒤 레이어 안개 (지형 위, 엔티티 아래)
  MapGen.drawFog(ctx, 0);

  // 픽업
  for (const pk of G.pickups) drawPickup(pk);

  // 도파민 결정
  for (const c of G.crystals) drawCrystal(ctx, c);

  // 지형 기믹 (탄력 버섯·폭발성 결정·간헐천)
  drawHazards(ctx);

  // 고스트 잔상 (고속 스미어)
  for (const gh2 of G.ghosts) {
    const ga = clamp(gh2.life / gh2.maxLife, 0, 1) * 0.4;
    ctx.save();
    ctx.translate(gh2.x, gh2.y);
    ctx.globalAlpha = ga;
    ctx.fillStyle = G.rage.active ? '#ff4d9d' : '#4de3ff';
    ctx.beginPath();
    ctx.moveTo(-11, 12); ctx.lineTo(-13, -2); ctx.lineTo(-6, -12); ctx.lineTo(6, -12);
    ctx.lineTo(13, -2); ctx.lineTo(11, 12); ctx.lineTo(0, 15);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // 적 (y 정렬)
  const sorted = G.enemies.slice().sort((a, b) => a.y - b.y);
  for (const e of sorted) drawEnemy(ctx, e);

  drawPlayer();
  drawProjectiles(ctx);

  // 파티클
  for (const pt of G.particles) {
    const a = clamp(pt.life / pt.maxLife, 0, 1);
    if (pt.shape === 'shard') {
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.rotate((pt.rot || 0) + (pt.vrot || 0) * (pt.maxLife - pt.life));
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      const s = pt.size;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, s * 0.6); ctx.lineTo(-s * 0.6, s * 0.5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (pt.shape === 'spark') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a;
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = pt.size * 0.7;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - pt.vx * 0.03, pt.y - pt.vy * 0.03);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    } else if (pt.shape === 'glow') {
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, pt.color, pt.x, pt.y, pt.size, a * 0.9);
      ctx.globalCompositeOperation = 'source-over';
    } else if (pt.shape === 'wisp') {
      ctx.globalAlpha = a * 0.5;
      Glow.draw(ctx, pt.color, pt.x, pt.y, pt.size * (1.6 - a * 0.6), a * 0.5);
      ctx.globalAlpha = 1;
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (0.5 + a * 0.5), 0, TAU); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // 앞 레이어 안개 (엔티티 위 — 깊이감)
  MapGen.drawFog(ctx, 1);

  // 피해 텍스트
  ctx.textAlign = 'center';
  for (const t of G.dmgTexts) {
    const a = clamp(t.life / t.maxLife, 0, 1);
    const pop = t.scale * (1 + (1 - a) * 0.3);
    ctx.globalAlpha = a;
    ctx.font = `900 ${Math.round(17 * pop)}px 'Segoe UI', sans-serif`;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    if (t.isPlayer) {
      ctx.fillStyle = '#ff3b5c';
      ctx.strokeText('-' + t.val, t.x, t.y);
      ctx.fillText('-' + t.val, t.x, t.y);
    } else if (t.crit) {
      ctx.fillStyle = '#ffcf3d';
      ctx.strokeText(t.val + '!', t.x, t.y);
      ctx.fillText(t.val + '!', t.x, t.y);
    } else {
      ctx.fillStyle = '#dfe6f2';
      ctx.strokeText(t.val, t.x, t.y);
      ctx.fillText(t.val, t.x, t.y);
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  /* ---------- 다이내믹 라이팅 (라이트맵 + 블룸) ---------- */
  if (G.player && LIGHTS.canvas) {
    LIGHTS.render(cam.x - shx - kx, cam.y - shy - ky, shx, shy, kx, ky, zoom);
  }

  /* ---------- 포스트 프로세싱 → 화면 합성 ---------- */
  POST.render(0, cam.x - shx - kx, cam.y - shy - ky, zoom);
}

function drawPlayer() {
  const p = G.player;
  const blink = p.iFrames > 0 && Math.floor(p.iFrames * 14) % 2 === 0;
  const rushOn = G.rage && G.rage.active;
  const bob = p.moving ? Math.abs(Math.sin(p.walkT)) * 2.4 : Math.sin(p.walkT * 0.6) * 1.4;
  const coreCol = rushOn ? '#ff4d5e' : '#4de3ff';

  // 망토 물리: 세그먼트 체인이 이동 반대 방향으로 끌림
  const cape = p.cape || (p.cape = Array.from({ length: 6 }, () => ({ x: p.x, y: p.y })));
  let ax = p.x, ay = p.y - 6;
  const drag = -p.faceX, dragY = -p.faceY + 0.5;
  for (let i = 0; i < cape.length; i++) {
    const seg = cape[i];
    const tx = p.x + drag * (i + 1) * 7 + Math.sin(G.time * 7 + i) * 2.2;
    const ty = p.y - 4 + dragY * (i + 1) * 4.4 + i * 1.6;
    seg.x = lerp(seg.x, tx, 0.35);
    seg.y = lerp(seg.y, ty, 0.35);
    ax = seg.x; ay = seg.y;
  }

  ctx.save();
  ctx.translate(p.x, p.y - bob);

  if (blink) ctx.globalAlpha = 0.35;

  // 지면 발광 + 그림자
  ctx.globalCompositeOperation = 'lighter';
  Glow.draw(ctx, coreCol, 0, 14 + bob, 34, 0.22 + (rushOn ? 0.15 : 0));
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(0, 15 + bob, 15, 5.5, 0, 0, TAU); ctx.fill();

  // 망토 (어둠의 천)
  ctx.fillStyle = '#12162a';
  ctx.beginPath();
  ctx.moveTo(-9, -8);
  for (let i = 0; i < cape.length; i++) {
    const w = 4 + i * 2.6;
    ctx.lineTo(cape[i].x - p.x - w, cape[i].y - p.y + bob);
  }
  for (let i = cape.length - 1; i >= 0; i--) {
    const w = 4 + i * 2.6;
    ctx.lineTo(cape[i].x - p.x + w, cape[i].y - p.y + bob);
  }
  ctx.lineTo(9, -8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(77,227,255,0.28)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 몸통 아머 (다크 플레이트)
  const armor = rushOn ? '#2a1420' : '#161c30';
  const armorHi = rushOn ? '#4a2030' : '#232c48';
  ctx.fillStyle = armor;
  ctx.beginPath();
  ctx.moveTo(-11, 12); ctx.lineTo(-13, -2); ctx.lineTo(-6, -12);
  ctx.lineTo(6, -12); ctx.lineTo(13, -2); ctx.lineTo(11, 12);
  ctx.lineTo(0, 15);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rushOn ? 'rgba(255,77,94,0.6)' : 'rgba(77,227,255,0.4)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // 견갑
  ctx.fillStyle = armorHi;
  ctx.beginPath();
  ctx.moveTo(-15, -4); ctx.lineTo(-7, -9); ctx.lineTo(-6, -1); ctx.lineTo(-12, 3);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(15, -4); ctx.lineTo(7, -9); ctx.lineTo(6, -1); ctx.lineTo(12, 3);
  ctx.closePath(); ctx.fill();

  // 에너지 코어
  ctx.globalCompositeOperation = 'lighter';
  const corePulse = 0.7 + Math.sin(G.time * 6) * 0.2 + (rushOn ? 0.4 : 0);
  Glow.draw(ctx, coreCol, 0, 0, 13, corePulse);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#eaf7ff';
  ctx.beginPath(); ctx.arc(0, 0, 3.2 + Math.sin(G.time * 6) * 0.5, 0, TAU); ctx.fill();

  // 투구 + 바이저
  ctx.fillStyle = rushOn ? '#301622' : '#1a2138';
  ctx.beginPath();
  ctx.moveTo(-8, -12); ctx.lineTo(-7, -20); ctx.lineTo(0, -24); ctx.lineTo(7, -20); ctx.lineTo(8, -12);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rushOn ? 'rgba(255,77,94,0.7)' : 'rgba(77,227,255,0.5)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // 바이저 슬릿 (시선 방향)
  const vx = clamp(p.faceX, -1, 1) * 2.4;
  ctx.fillStyle = coreCol;
  ctx.fillRect(-5.5 + vx, -18.5, 11, 2.6);
  ctx.globalCompositeOperation = 'lighter';
  Glow.draw(ctx, coreCol, vx, -17.2, 9, 0.5);
  ctx.globalCompositeOperation = 'source-over';

  ctx.globalAlpha = 1;
  ctx.restore();

  // 이동 잔상 캐릭터 힌트 (고속 시 외곽 발광 강화)
  if (p.moving && Math.random() < 0.3) {
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, coreCol, p.x - p.faceX * 10, p.y - bob, 16, 0.18);
    ctx.globalCompositeOperation = 'source-over';
  }

  // HP 바 (머리 위)
  if (p.hp < p.maxHp) {
    const w = 44;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    MapGen.rr(ctx, p.x - w / 2, p.y - 42, w, 6, 2); ctx.fill();
    const hr = clamp(p.hp / p.maxHp, 0, 1);
    ctx.fillStyle = hr > 0.5 ? '#2ee6a8' : (hr > 0.25 ? '#e8c14a' : '#ff3b5c');
    if (hr > 0) { MapGen.rr(ctx, p.x - w / 2 + 1, p.y - 41, (w - 2) * hr, 4, 1.5); ctx.fill(); }
  }
}

function drawPickup(pk) {
  const bob = Math.sin(pk.t) * 2;
  ctx.save();
  ctx.translate(pk.x, pk.y + bob);
  switch (pk.kind) {
    case 'gem': {
      const v = pk.val;
      const c = v >= 10 ? '#b06cff' : (v >= 3 ? '#ff4d9d' : '#4de3ff');
      const s = v >= 10 ? 9 : (v >= 3 ? 7.5 : 6);
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, c, 0, 0, s * 2.6, 0.55);
      ctx.globalCompositeOperation = 'source-over';
      ctx.rotate(pk.t * 0.6);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.68, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.68, 0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.3, -s * 0.15); ctx.lineTo(-s * 0.2, 0);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'heart': {
      // 생명의 정수 (발광 오브)
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, '#ff3b5c', 0, 0, 20 + Math.sin(pk.t * 1.4) * 3, 0.6);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ff3b5c';
      ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.arc(-2, -2.2, 2, 0, TAU); ctx.fill();
      // 궤도 링
      ctx.strokeStyle = 'rgba(255,120,140,0.7)';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 4, Math.sin(pk.t * 0.8) * 0.6, 0, TAU); ctx.stroke();
      break;
    }
    case 'magnet': {
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, '#4de3ff', 0, 0, 18, 0.5);
      ctx.globalCompositeOperation = 'source-over';
      ctx.rotate(Math.sin(pk.t * 0.4) * 0.2);
      ctx.strokeStyle = '#4de3ff'; ctx.lineWidth = 5; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.arc(0, 0, 8, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = '#dfeaf5';
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-8, 6); ctx.moveTo(8, 0); ctx.lineTo(8, 6); ctx.stroke();
      break;
    }
    case 'chest': {
      const s = 1 + Math.sin(pk.t * 0.7) * 0.05;
      ctx.scale(s, s);
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, '#e8b74a', 0, 0, 36, 0.4 + Math.sin(pk.t * 1.2) * 0.12);
      ctx.globalCompositeOperation = 'source-over';
      // 다크 서플라이 크레이트
      ctx.fillStyle = '#1d2233';
      MapGen.rr(ctx, -14, -6, 28, 16, 2); ctx.fill();
      ctx.fillStyle = '#28304a';
      MapGen.rr(ctx, -14, -12, 28, 9, 3); ctx.fill();
      ctx.strokeStyle = '#e8b74a'; ctx.lineWidth = 1.4;
      MapGen.rr(ctx, -14, -12, 28, 22, 2); ctx.stroke();
      ctx.fillStyle = '#e8b74a';
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillStyle = '#0d101c';
      ctx.fillRect(-14, -3, 28, 3);
      // 반짝이 스파크
      if (Math.random() < 0.1) sparkBurst(pk.x + rand(-12, 12), pk.y - 8, '#ffe9a8', 1, 60);
      break;
    }
  }
  ctx.restore();
}

/* ---------- HUD (DOM) ---------- */
let hudAcc = 0;
function updateHUD(force) {
  const p = G.player;
  if (!p) return;

  // XP 바 (매 프레임)
  const xpf = document.getElementById('xpfill');
  xpf.style.width = clamp(p.xp / p.xpNext, 0, 1) * 100 + '%';
  document.getElementById('lvbadge').textContent = 'LV ' + p.level;
  document.getElementById('hpfill').style.width = clamp(p.hp / p.maxHp, 0, 1) * 100 + '%';
  document.getElementById('hptext').textContent = Math.ceil(p.hp) + ' / ' + p.maxHp;

  // 도파민 러시 게이지
  const rf = document.getElementById('ragefill');
  rf.style.width = clamp(G.rage.value / G.rage.max, 0, 1) * 100 + '%';
  const rbar = document.getElementById('ragebar');
  if (G.rage.active) rbar.className = 'active';
  else if (G.rage.value >= G.rage.max) rbar.className = 'ready';
  else rbar.className = '';

  hudAcc += 1;
  if (force || hudAcc > 8) {
    hudAcc = 0;
    const mm = Math.floor(G.time / 60), ss = Math.floor(G.time % 60);
    document.getElementById('timer').textContent = String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
    document.getElementById('kills').textContent = '💀 ' + G.stats.kills.toLocaleString();
    document.getElementById('gemcount').textContent = '💎 ' + G.stats.gems.toLocaleString();

    // 콤보
    const cel = document.getElementById('combo');
    if (G.combo >= 5) {
      cel.textContent = G.combo.toLocaleString() + ' 콤보!';
      cel.classList.add('on');
    } else cel.classList.remove('on');

    // 보스 바
    const bb = document.getElementById('bossbar');
    if (G.boss && G.enemies.includes(G.boss)) {
      bb.classList.remove('hidden');
      document.getElementById('bossname').textContent = '👑 ' + G.boss.bossDef.name;
      document.getElementById('bossfill').style.width = clamp(G.boss.hp / G.boss.maxHp, 0, 1) * 100 + '%';
    } else bb.classList.add('hidden');

    // 미니맵
    const mmC = document.getElementById('minimap');
    if (mmC.width !== 132) { mmC.width = 132; mmC.height = 132; }
    MapGen.drawMinimap(mmC.getContext('2d'), 132, p.x, p.y, G.enemies, G.boss);
  }
}

function renderHUDBars() {
  // 무기 아이콘
  const wb = document.getElementById('weaponBar');
  wb.innerHTML = '';
  for (const id in G.weapons) {
    const def = WEAPON_DEFS[id];
    const w = G.weapons[id];
    const el = document.createElement('div');
    el.className = 'slot' + (w.evolved ? ' evolved' : '');
    el.title = w.evolved ? '🌟 ' + EVOLUTIONS[id].name + ' (진화)' : def.name;
    if (w.evolved) {
      el.innerHTML = `<span>${EVOLUTIONS[id].emoji}</span><b class="evo">MAX</b>`;
    } else {
      let pips = '';
      for (let i = 0; i < 5; i++) pips += `<i class="${i < w.lvl ? 'on' : ''}"></i>`;
      el.innerHTML = `<span>${def.emoji}</span><b>${pips}</b>`;
    }
    wb.appendChild(el);
  }
  // 패시브 아이콘
  const pb = document.getElementById('passiveBar');
  pb.innerHTML = '';
  for (const id in G.passives) {
    if (G.passives[id] <= 0) continue;
    const def = PASSIVE_DEFS[id];
    const el = document.createElement('div');
    el.className = 'slot passive';
    el.title = def.name;
    let pips = '';
    const lvl = Math.floor(G.passives[id]);
    for (let i = 0; i < 5; i++) pips += `<i class="${i < lvl ? 'on' : ''}"></i>`;
    el.innerHTML = `<span>${def.emoji}</span><b>${pips}</b>`;
    pb.appendChild(el);
  }
}

/* ---------- 게임 오버 / 승리 ---------- */
function endScreen(win) {
  G.state = win ? 'victory' : 'gameover';
  MUSIC.stop();
  SFX.play(win ? 'victory' : 'gameover');
  zoomPunchCam(0.04);
  shakeCam(win ? 4 : 6);

  const score = G.stats.kills * 15 + G.stats.gems * 5 + G.player.level * 200 + G.stats.bestCombo * 10 + Math.floor(G.minute) * 300 + (win ? 10000 : 0);
  const best = Math.max(score, parseInt(localStorage.getItem('ds_best') || '0', 10));
  const isRecord = score >= best && score > 0;
  localStorage.setItem('ds_best', String(best));

  document.getElementById('end-title').textContent = win ? '🏆 승리!! 도파민 마스터!' : '💀 게임 오버';
  document.getElementById('end-title').style.color = win ? '#ffd23f' : '#ff5d5d';
  document.getElementById('end-sub').textContent = isRecord ? '🎉 새 최고 기록!' : '최고 기록: ' + best.toLocaleString();
  document.getElementById('end-stats').innerHTML = `
    <div><span>생존 시간</span><b>${Math.floor(G.minute)}분 ${Math.floor(G.time % 60)}초</b></div>
    <div><span>레벨</span><b>LV ${G.player.level}</b></div>
    <div><span>처치</span><b>${G.stats.kills.toLocaleString()}</b></div>
    <div><span>수집 젬</span><b>${G.stats.gems.toLocaleString()}</b></div>
    <div><span>최고 콤보</span><b>${G.stats.bestCombo.toLocaleString()}</b></div>
    <div><span>점수</span><b class="gold">${score.toLocaleString()}</b></div>`;
  document.getElementById('overlay-end').classList.remove('hidden');
}

function gameOver() { endScreen(false); }
function victory() { endScreen(true); }

/* ---------- 입력 ---------- */
G.keys = new Set();
window.addEventListener('keydown', (e) => {
  G.keys.add(e.code);
  if (e.code === 'Space') {
    e.preventDefault();
    activateRush();
  }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (G.state === 'levelup') {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 3 && G.luChoices && G.luChoices[n - 1]) pickCard(G.luChoices[n - 1]);
  }
});
window.addEventListener('keyup', (e) => G.keys.delete(e.code));
window.addEventListener('blur', () => { if (G.state === 'playing') togglePause(); });

function togglePause() {
  if (G.state === 'playing') {
    G.state = 'paused';
    document.getElementById('overlay-pause').classList.remove('hidden');
  } else if (G.state === 'paused') {
    G.state = 'playing';
    document.getElementById('overlay-pause').classList.add('hidden');
  }
}

/* 터치 조이스틱 */
G.joy = { active: false, dx: 0, dy: 0, id: null, ox: 0, oy: 0 };
const joyEl = document.getElementById('joystick');
window.addEventListener('touchstart', (e) => {
  for (const t of e.changedTouches) {
    if (t.clientY > window.innerHeight * 0.28 && !G.joy.active) {
      G.joy.active = true; G.joy.id = t.identifier;
      G.joy.ox = t.clientX; G.joy.oy = t.clientY;
      joyEl.style.left = t.clientX + 'px';
      joyEl.style.top = t.clientY + 'px';
      joyEl.classList.add('on');
    }
  }
}, { passive: true });
window.addEventListener('touchmove', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === G.joy.id) {
      const dx = t.clientX - G.joy.ox, dy = t.clientY - G.joy.oy;
      const d = Math.hypot(dx, dy) || 1;
      const cl = Math.min(d, 55);
      G.joy.dx = (dx / d) * (cl / 55);
      G.joy.dy = (dy / d) * (cl / 55);
      const knob = joyEl.firstElementChild;
      knob.style.transform = `translate(${dx / d * cl}px, ${dy / d * cl}px)`;
    }
  }
}, { passive: true });
window.addEventListener('touchend', (e) => {
  for (const t of e.changedTouches) {
    if (t.identifier === G.joy.id) {
      G.joy.active = false; G.joy.dx = 0; G.joy.dy = 0; G.joy.id = null;
      joyEl.classList.remove('on');
      joyEl.firstElementChild.style.transform = 'translate(0,0)';
    }
  }
}, { passive: true });

/* 휠 줌 */
window.addEventListener('wheel', (e) => {
  if (G.state !== 'playing' && G.state !== 'paused' && G.state !== 'levelup') return;
  e.preventDefault();
  G.userZoom = clamp((G.userZoom || 1) * (e.deltaY < 0 ? 1.12 : 0.89), 0.55, 1.8);
}, { passive: false });

/* ---------- 루프 ---------- */
let lastT = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min((t - lastT) / 1000, 0.05);
  lastT = t;
  if (G.state === 'playing') update(dt);
  if (G.state === 'playing' || G.state === 'levelup' || G.state === 'chest' || G.state === 'paused' || G.state === 'gameover' || G.state === 'victory') {
    if (G.camera) render();
  }
  if (G.state === 'title') renderTitle(t);
}

/* 타이틀 배경: 프로시듀럴 맵 슬로우 스크롤 */
let titleInit = false;
function renderTitle(t) {
  if (!titleInit) {
    MapGen.init(1337);
    G.camera = { x: 0, y: 0, shake: 0, punch: 0, kickX: 0, kickY: 0 };
    G.view = { w: window.innerWidth, h: window.innerHeight };
    G.zoom = G.baseZoom || 1;
    MapGen.initFog();
    titleInit = true;
  }
  const cx = Math.cos(t / 20000) * 1600 - G.view.w / 2;
  const cy = Math.sin(t / 17000) * 1600 - G.view.h / 2;
  ctx.fillStyle = '#070910';
  ctx.fillRect(0, 0, G.view.w, G.view.h);
  MapGen.drawWorld(ctx, cx, cy, G.view.w + 4, G.view.h + 4);
  MapGen.drawFog(ctx, 0);
  MapGen.drawFog(ctx, 1);
  ctx.fillStyle = 'rgba(7,9,16,0.6)';
  ctx.fillRect(0, 0, G.view.w, G.view.h);
  // 타이틀도 간단 포스트 합성
  if (POST.bloomA) {
    outCtx.setTransform(G.dpr, 0, 0, G.dpr, 0, 0);
    outCtx.drawImage(sceneCanvas, 0, 0, G.view.w, G.view.h);
  }
}

/* ---------- 버튼 바인딩 ---------- */
function bindUI() {
  document.getElementById('btn-start').onclick = () => {
    SFX.init();
    document.getElementById('overlay-title').classList.add('hidden');
    const seedInput = document.getElementById('seedInput').value.trim();
    let seed;
    if (seedInput) {
      seed = 0;
      for (let i = 0; i < seedInput.length; i++) seed = (seed * 31 + seedInput.charCodeAt(i)) >>> 0;
      if (/^\d+$/.test(seedInput)) seed = parseInt(seedInput, 10) >>> 0;
    } else seed = (Math.random() * 0xFFFFFFFF) >>> 0;
    initRun(seed || 1);
  };
  document.getElementById('btn-random-seed').onclick = () => {
    document.getElementById('seedInput').value = String((Math.random() * 0xFFFFFFFF) >>> 0);
  };
  document.getElementById('btn-retry').onclick = () => {
    document.getElementById('overlay-end').classList.add('hidden');
    initRun((Math.random() * 0xFFFFFFFF) >>> 0);
  };
  document.getElementById('btn-menu').onclick = () => {
    document.getElementById('overlay-end').classList.add('hidden');
    document.getElementById('overlay-title').classList.remove('hidden');
    MUSIC.stop();
    G.state = 'title';
  };
  document.getElementById('btn-resume').onclick = togglePause;
  document.getElementById('btn-quit').onclick = () => {
    document.getElementById('overlay-pause').classList.add('hidden');
    document.getElementById('overlay-title').classList.remove('hidden');
    MUSIC.stop();
    document.body.classList.remove('rush');
    G.state = 'title';
  };
  const muteBtn = document.getElementById('muteBtn');
  const setMuteIcon = () => { muteBtn.textContent = SFX.muted ? '🔇' : '🔊'; };
  muteBtn.onclick = () => { SFX.init(); SFX.setMuted(!SFX.muted); setMuteIcon(); };
  setMuteIcon();
  document.getElementById('pauseBtn').onclick = togglePause;
  document.getElementById('rageBtn').onclick = activateRush;

  const best = localStorage.getItem('ds_best');
  if (best) document.getElementById('bestScore').textContent = '🏅 최고 기록: ' + parseInt(best, 10).toLocaleString();
}

/* ---------- 부팅 ---------- */
window.addEventListener('load', () => {
  resize();
  LIGHTS.init();
  POST.init();
  bindUI();
  G.state = 'title';
  requestAnimationFrame(loop);
});
document.addEventListener('contextmenu', (e) => { if (e.target === canvas) e.preventDefault(); });
