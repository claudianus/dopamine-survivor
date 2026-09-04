'use strict';
/* ============================================================
 * 도파민 서바이버 - 코어 유틸 (수학, RNG, 심플렉스 노이즈)
 * ============================================================ */

const G = {}; // 전역 게임 상태

const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
const ang = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
const TAU = Math.PI * 2;

function rand(a = 1, b) {
  if (b === undefined) return Math.random() * a;
  return a + Math.random() * (b - a);
}
function randi(a, b) { return Math.floor(rand(a, b + 1)); }
function choice(arr) { return arr[(Math.random() * arr.length) | 0]; }

/* localStorage 래퍼 — 사파리 프라이빗 모드 등 접근 예외 환경에서도 게임이 죽지 않게 */
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

/* 시드 기반 RNG (Mulberry32) */
function Mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* 정수 해시 (타일 색 변주용) */
function hashi(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* 2D 심플렉스 노이즈 (Gustavson) */
const GRAD3 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [-1, 1], [1, -1], [-1, -1],
];
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

class SimplexNoise {
  constructor(rng) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = (rng() * (i + 1)) | 0;
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }
  noise2D(xin, yin) {
    const { perm, permMod12 } = this;
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      const gi0 = permMod12[ii + perm[jj]];
      t0 *= t0;
      n0 = t0 * t0 * (GRAD3[gi0][0] * x0 + GRAD3[gi0][1] * y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      const gi1 = permMod12[ii + i1 + perm[jj + j1]];
      t1 *= t1;
      n1 = t1 * t1 * (GRAD3[gi1][0] * x1 + GRAD3[gi1][1] * y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      const gi2 = permMod12[ii + 1 + perm[jj + 1]];
      t2 *= t2;
      n2 = t2 * t2 * (GRAD3[gi2][0] * x2 + GRAD3[gi2][1] * y2);
    }
    return 70 * (n0 + n1 + n2); // -1 ~ 1
  }
}

/* 부드러운 카메라 흔들림 */
function shakeCam(power) {
  const cam = G.camera;
  const p = cam.shake + power;
  cam.shake = Math.min(p, 14);
}

/* 방향성 임팩트 (흔들림 대체: 화면을 특정 방향으로 툭 밀침) */
function kickCam(dx, dy, power) {
  const cam = G.camera;
  const d = Math.hypot(dx, dy) || 1;
  cam.kickX = (cam.kickX || 0) + (dx / d) * power;
  cam.kickY = (cam.kickY || 0) + (dy / d) * power;
}

/* 줌 펀치 (순간 확대 후 복귀) */
function zoomPunchCam(amount) {
  const cam = G.camera;
  cam.punch = Math.min((cam.punch || 0) + amount, 0.07);
}

/* ============================================================
 * 적응형 품질 시스템 — 기기/프레임레이트 기반 자동 스케일링
 * quality: 0=저사양(모바일 절전) / 1=균형 / 2=고품질(데스크탑)
 * ============================================================ */
const QUALITY = {
  level: 2,
  fpsEMA: 60,
  lastSwitch: 0,
  detect() {
    const ua = navigator.userAgent || '';
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    const small = Math.min(window.innerWidth, window.innerHeight) < 500;
    const cores = navigator.hardwareConcurrency || 4;
    if (mobile || small || cores <= 4) this.level = 1;
    if ((mobile && small) || cores <= 2) this.level = 0;
    // 고해상도 데스크탑은 고품질 유지
    if (!mobile && Math.min(window.innerWidth, window.innerHeight) >= 700 && cores > 4) this.level = 2;
    try {
      const saved = lsGet('ds_quality');
      if (saved === '0' || saved === '1' || saved === '2') this.level = parseInt(saved, 10);
    } catch (e) {}
    this.applyDprCap();
  },
  applyDprCap() {
    // 저사양은 DPR을 낮춰 필레이트 병목을 제거 (1.0 = CSS 픽셀 그대로)
    this.dprCap = this.level === 0 ? 1 : (this.level === 1 ? 1.6 : 2);
  },
  // 매 프레임 FPS를 추적해 자동 승/강급 (0.5초 쿨다운, 타이틀 제외)
  track(dt) {
    if (!dt || dt <= 0) return;
    const fps = 1 / Math.min(dt, 0.1);
    this.fpsEMA = this.fpsEMA * 0.95 + fps * 0.05;
    const now = performance.now();
    if (now - this.lastSwitch < 2500 || !G.state || G.state !== 'playing') return;
    if (this.fpsEMA < 38 && this.level > 0) { this.setLevel(this.level - 1); }
    else if (this.fpsEMA > 55 && this.level < 2 && now - this.lastSwitch > 12000) { this.setLevel(this.level + 1); }
  },
  setLevel(lv) {
    this.level = lv;
    this.lastSwitch = performance.now();
    this.applyDprCap();
    lsSet('ds_quality', String(lv));
    if (typeof resize === 'function') { try { resize(); } catch (e) {} }
  },
  get maxParticles() { return this.level === 0 ? 320 : (this.level === 1 ? 500 : 700); },
  get maxLights() { return this.level === 0 ? 22 : (this.level === 1 ? 34 : 46); },
  get maxEnemies() { return this.level === 0 ? 90 : (this.level === 1 ? 130 : 160); },
  get bloomOn() { return true; },
  get streakOn() { return this.level >= 1; },
  get dustOn() { return this.level >= 1; },
  get rimOn() { return this.level >= 1; },
  get grainOn() { return this.level >= 1; },
};

/* ============================================================
 * 글로우 스프라이트 캐시 — 기술 데모급 발광을 저렴하게
 * (동적 hsl 양자화 + LRU 상한으로 캐시 폭발 방지)
 * ============================================================ */
const Glow = {
  cache: new Map(),
  MAX: 96,
  // 매 프레임 변하는 hue를 12단계로 양자화해 캐시 키 폭발 방지
  key(color) {
    if (typeof color !== 'string') return '#ffffff';
    const m = /^hsla?\((\d+(?:\.\d+)?),\s*(\d+)%?,\s*(\d+)%?/.exec(color);
    if (m) {
      const h = Math.round(parseFloat(m[1]) / 30) * 30 % 360;
      return `hsl(${h},${m[2]}%,${m[3]}%)`;
    }
    if (color.length === 4 && color[0] === '#') {
      return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    }
    return color;
  },
  midColor(color) {
    // 어떤 색 형식이든 반투명 중간 색으로 변환
    if (color.startsWith('hsl(')) return color.replace('hsl(', 'hsla(').replace(')', ',0.45)');
    if (color.startsWith('hsla(') || color.startsWith('rgba(')) return color;
    if (color.startsWith('rgb(')) return color.replace('rgb(', 'rgba(').replace(')', ',0.45)');
    if (color.startsWith('#') && color.length >= 7) {
      const r = parseInt(color.slice(1, 3), 16), g2 = parseInt(color.slice(3, 5), 16), b = parseInt(color.slice(5, 7), 16);
      if (!isNaN(r) && !isNaN(g2) && !isNaN(b)) return `rgba(${r},${g2},${b},0.45)`;
    }
    return color;
  },
  get(color) {
    const k = this.key(color);
    let c = this.cache.get(k);
    if (c) { // LRU: 최근 사용을 뒤로
      this.cache.delete(k); this.cache.set(k, c);
      return c;
    }
    c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, k);
    g.addColorStop(0.35, this.midColor(k));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    this.cache.set(k, c);
    if (this.cache.size > this.MAX) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
    return c;
  },
  draw(ctx, color, x, y, radius, alpha = 1) {
    if (radius <= 0 || alpha <= 0.01) return;
    const s = this.get(color);
    const prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * alpha;
    ctx.drawImage(s, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = prev;
  },
};

/* 뷰 컬링: 화면 밖 엔티티의 드로우콜을 원천 차단 (화면상 동일, GPU 부하만 제거) */
function viewRect(m) {
  const cam = G.camera, z = G.zoom || 1;
  const vw = G.view.w / z, vh = G.view.h / z;
  return [cam.x - m, cam.y - m, cam.x + vw + m, cam.y + vh + m];
}

/* 파편(삼각형) 파티클 생성 */
function shardBurst(x, y, color, n, speed = 260, size = 5) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = rand(speed * 0.3, speed);
    G.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rand(0.35, 0.8), maxLife: 0.8, size: rand(size * 0.5, size),
      color, grav: 420, shape: 'shard', rot: Math.random() * TAU, vrot: rand(-9, 9),
    });
  }
}

/* 피격 스파크 (짧고 밝은 직선 파편) */
function sparkBurst(x, y, color, n = 6, speed = 340) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = rand(speed * 0.4, speed);
    G.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rand(0.1, 0.26), maxLife: 0.26, size: rand(1.5, 3),
      color, grav: 0, shape: 'spark', rot: a,
    });
  }
}
