'use strict';
/* ============================================================
 * 도파민 서바이버 - 프로시듀럴 무한 맵 생성기
 * 심플렉스 노이즈 3종(고도/습도/기온) → 바이옴 → 청크 캔버스 캐싱
 * ============================================================ */

const TILE = 64;          // 타일 크기(px)
const CHUNK = 8;          // 청크 = 8x8 타일
const CHUNK_PX = TILE * CHUNK; // 512px

/* 바이옴 ID */
const B_WATER = 0, B_SAND = 1, B_GRASS = 2, B_FOREST = 3, B_SNOW = 4,
      B_DESERT = 5, B_VOLCANIC = 6, B_CRYSTAL = 7, B_ROCK = 8, B_LAVA = 9;

const BIOME_INFO = {
  [B_WATER]:   { name: '심연 호수', base: [30, 96, 168],  spd: 0.55 },
  [B_SAND]:    { name: '해변',   base: [226, 180, 116], spd: 1.0 },
  [B_GRASS]:   { name: '초원',   base: [74, 172, 98],   spd: 1.0 },
  [B_FOREST]:  { name: '흑림',   base: [46, 126, 76],   spd: 0.95 },
  [B_SNOW]:    { name: '설원',   base: [210, 226, 250], spd: 1.0 },
  [B_DESERT]:  { name: '사막',   base: [214, 140, 76], spd: 1.0 },
  [B_VOLCANIC]:{ name: '화산지대', base: [78, 46, 52], spd: 1.0 },
  [B_CRYSTAL]: { name: '도파민 광산', base: [108, 64, 196], spd: 1.0 },
  [B_ROCK]:    { name: '암석지대', base: [122, 126, 142], spd: 1.0 },
  [B_LAVA]:    { name: '용암',   base: [255, 132, 46], spd: 0.85 },
};

const MapGen = {
  seed: 1,
  nE: null, nM: null, nT: null, nC: null, nD: null, nF: null,
  chunks: new Map(),
  mmCache: null, mmTime: 0,
  biomeCache: new Map(), // 타일 → 바이옴 (결정적 함수라 캐시 무해)
  propsCache: new Map(), // 타일 → 지형 속성 (이동/적 AI 매 프레임 조회)

  init(seed) {
    this.seed = seed >>> 0;
    this.nE = new SimplexNoise(Mulberry32(this.seed + 101));
    this.nM = new SimplexNoise(Mulberry32(this.seed + 202));
    this.nT = new SimplexNoise(Mulberry32(this.seed + 303));
    this.nC = new SimplexNoise(Mulberry32(this.seed + 404));
    this.nD = new SimplexNoise(Mulberry32(this.seed + 505));
    this.nF = new SimplexNoise(Mulberry32(this.seed + 606)); // 지형 피처 필드
    for (const c of this.chunks.values()) c.canvas = null;
    this.chunks.clear();
    this.mmCache = null;
    this.biomeCache.clear();
    this.propsCache.clear();
  },

  /* 좌표 → 바이옴 ID (타일 단위) — 캐시: 스폰/이동/AI에서 프레임당 수천 회 호출 */
  biome(tx, ty) {
    const key = tx * 46341 + ty;
    const hit = this.biomeCache.get(key);
    if (hit !== undefined) {
      // LRU 갱신: 상한 도달 시 오래된 항목 일괄 방출
      if (this.biomeCache.size > 20000) this.biomeCache.clear();
      return hit;
    }
    const e = this.nE.noise2D(tx / 34, ty / 34) * 0.5 + 0.5;         // 고도
    const m = this.nM.noise2D(tx / 26, ty / 26) * 0.5 + 0.5;         // 습도
    const t = this.nT.noise2D(tx / 60, ty / 60) * 0.5 + 0.5;         // 기온
    const c = this.nC.noise2D(tx / 22, ty / 22) * 0.5 + 0.5;         // 크리스탈

    let b;
    if (e < 0.26) b = B_WATER;
    else if (e < 0.31) b = B_SAND;
    // 도파민 광산: 희귀한 마법 광맥
    else if (c > 0.855 && e > 0.4 && e < 0.72) b = B_CRYSTAL;
    else if (e > 0.78) b = B_ROCK;
    else if (t < 0.30) b = B_SNOW;
    else if (t > 0.68 && e > 0.55) {
      b = (m > 0.58 && this.nD.noise2D(tx / 5, ty / 5) > 0.15) ? B_LAVA : B_VOLCANIC;
    }
    else if (t > 0.66 && m < 0.38) b = B_DESERT;
    else if (m > 0.60) b = B_FOREST;
    else b = B_GRASS;

    if (this.biomeCache.size > 20000) this.biomeCache.clear();
    this.biomeCache.set(key, b);
    return b;
  },

  /* 픽셀 좌표 → 지형 이동 속도 배율 */
  groundSpeed(x, y) {
    return this.groundProps(x, y).spd;
  },

  /* 지형 피처 판정 (결정적: 시각 = 판정 항상 일치) */
  featureFor(b, tx, ty) {
    const h = hashi(tx * 5, ty * 11, this.seed + 77);
    switch (b) {
      case B_WATER:
        // 해수면 아래 깊은 곳: 심수 (통과 불가)
        return (this.nE.noise2D(tx / 34, ty / 34) < -0.42) ? 'deep' : null;
      case B_SNOW:
        // 빙판 지대 (미끄러움)
        return (this.nF.noise2D(tx / 9, ty / 9) > 0.28) ? 'ice' : null;
      case B_FOREST:
        // 수렁 (진흙)
        return (this.nF.noise2D(tx / 9, ty / 9) > 0.3 && h < 0.45) ? 'mud' : null;
      case B_DESERT:
        return (h < 0.07) ? 'thorn' : null;
      case B_GRASS:
        return (h < 0.035) ? 'thorn' : null;
    }
    return null;
  },

  featureAt(wx, wy) {
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    return this.featureFor(this.biome(tx, ty), tx, ty);
  },

  /* 지형 물리 속성: 속도 배율 + 가속/마찰 + 특수 플래그 (타일 단위 캐시) */
  groundProps(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    const key = tx * 46341 + ty;
    const hit = this.propsCache.get(key);
    if (hit !== undefined) {
      if (this.propsCache.size > 8000) this.propsCache.clear();
      return hit;
    }
    const b = this.biome(tx, ty);
    let spd = BIOME_INFO[b].spd, accel = 12;
    let deep = false, ice = false, mud = false, thorn = false;
    const f = this.featureFor(b, tx, ty);
    if (f === 'deep') { deep = true; }
    else if (f === 'ice') { spd = Math.max(spd, 1.07); accel = 2.0; ice = true; }
    else if (f === 'mud') { spd *= 0.55; accel = 9; mud = true; }
    else if (f === 'thorn') { spd *= 0.62; thorn = true; }
    const props = { spd, accel, deep, ice, mud, thorn, biome: b };
    if (this.propsCache.size > 8000) this.propsCache.clear();
    this.propsCache.set(key, props);
    return props;
  },

  /* 지형 피처 시각화 (청크 캔버스에 베이크) */
  drawFeature(ctx, f, px, py, wtx, wty, rng) {
    const h = hashi(wtx * 3, wty * 7, this.seed + 31);
    switch (f) {
      case 'deep':
        ctx.fillStyle = 'rgba(4,10,26,0.62)';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(90,140,200,0.16)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + h * 20, py + 22); ctx.quadraticCurveTo(px + 32, py + 30, px + 54, py + 24);
        ctx.stroke();
        break;
      case 'ice':
        ctx.fillStyle = 'rgba(185,228,255,0.4)';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(px + h * 40, py + 6); ctx.lineTo(px + 20 + h * 20, py + 36); ctx.lineTo(px + 30, py + 60);
        ctx.moveTo(px + 8, py + h * 50); ctx.lineTo(px + 44, py + 20 + h * 20);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.moveTo(px + h * 30, py); ctx.lineTo(px + h * 30 + 26, py); ctx.lineTo(px + h * 30 - 12, py + TILE);
        ctx.closePath(); ctx.fill();
        break;
      case 'mud':
        ctx.fillStyle = 'rgba(44,30,18,0.55)';
        ctx.beginPath();
        ctx.ellipse(px + 20 + h * 16, py + 22, 22, 15, h * 3, 0, TAU);
        ctx.ellipse(px + 44, py + 46, 18, 12, h * 2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = 'rgba(90,64,38,0.4)';
        ctx.beginPath();
        ctx.ellipse(px + 22 + h * 14, py + 20, 12, 7, h * 3, 0, TAU);
        ctx.fill();
        break;
      case 'thorn': {
        ctx.strokeStyle = 'rgba(24,16,10,0.85)';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(px + 8, py + 56); ctx.lineTo(px + 26, py + 20);
        ctx.moveTo(px + 30, py + 58); ctx.lineTo(px + 44, py + 26);
        ctx.moveTo(px + 52, py + 56); ctx.lineTo(px + 38, py + 30);
        ctx.moveTo(px + 16, py + 40); ctx.lineTo(px + 34, py + 34);
        ctx.stroke();
        ctx.fillStyle = 'rgba(150,40,40,0.8)';
        for (let i = 0; i < 3; i++) {
          const sx = px + 14 + i * 16 + h * 8, sy = py + 24 + h * 14 - i * 6;
          ctx.beginPath();
          ctx.moveTo(sx, sy); ctx.lineTo(sx + 3.5, sy - 8); ctx.lineTo(sx + 7, sy);
          ctx.closePath(); ctx.fill();
        }
        break;
      }
    }
  },

  isLava(x, y) {
    return this.biome(Math.floor(x / TILE), Math.floor(y / TILE)) === B_LAVA;
  },

  /* 청크 생성 (오프스크린 캔버스에 지형 + 장식을 한 번만 그림) */
  getChunk(cx, cy) {
    const key = cx + ',' + cy;
    let ch = this.chunks.get(key);
    if (ch) return ch;

    const cv = document.createElement('canvas');
    cv.width = CHUNK_PX; cv.height = CHUNK_PX;
    const ctx = cv.getContext('2d');
    const rng = Mulberry32((cx * 73856093) ^ (cy * 19349663) ^ this.seed);

    const decos = [];
    for (let ty = 0; ty < CHUNK; ty++) {
      for (let tx = 0; tx < CHUNK; tx++) {
        const wtx = cx * CHUNK + tx, wty = cy * CHUNK + ty;
        const b = this.biome(wtx, wty);
        const px = tx * TILE, py = ty * TILE;

        // 타일 바탕색 (해시 기반 미세 변주)
        const v = 0.9 + hashi(wtx, wty, this.seed) * 0.18;
        const [r, g2, b2] = BIOME_INFO[b].base;
        ctx.fillStyle = `rgb(${(r * v) | 0},${(g2 * v) | 0},${(b2 * v) | 0})`;
        ctx.fillRect(px, py, TILE, TILE);

        // 타일 디테일
        this.tileDetail(ctx, b, px, py, wtx, wty, rng);

        // 지형 피처 (빙판/진흙/심수/가시 — 시각 베이크)
        const feat = this.featureFor(b, wtx, wty);
        if (feat) this.drawFeature(ctx, feat, px, py, wtx, wty, rng);

        // 장식 후보 수집
        const de = this.decoFor(b, wtx, wty, rng);
        if (de) decos.push({ ...de, x: px + 10 + rng() * (TILE - 20), y: py + 14 + rng() * (TILE - 20) });
      }
    }
    // 장식은 y 정렬 후 시각적으로 자연스럽게 그림
    decos.sort((a, b2) => a.y - b2.y);
    for (const d of decos) this.drawDeco(ctx, d, rng);

    ch = { canvas: cv, cx, cy };
    this.chunks.set(key, ch);

    // 메모리 가드: 너무 많은 청크면 오래된 것 해제
    if (this.chunks.size > 160) {
      const pcx = Math.floor((G.camera ? G.camera.x : 0) / CHUNK_PX);
      const pcy = Math.floor((G.camera ? G.camera.y : 0) / CHUNK_PX);
      for (const [k, c] of this.chunks) {
        if (Math.abs(c.cx - pcx) > 5 || Math.abs(c.cy - pcy) > 5) this.chunks.delete(k);
        if (this.chunks.size <= 110) break;
      }
    }
    return ch;
  },

  tileDetail(ctx, b, px, py, wtx, wty, rng) {
    const h = hashi(wtx * 3, wty * 7, this.seed + 9);
    ctx.globalAlpha = 0.22;
    if (b === B_GRASS || b === B_FOREST) {
      ctx.fillStyle = h > 0.5 ? '#16351f' : '#2e6344';
      ctx.fillRect(px + h * 40, py + h * 34, 14, 8);
      ctx.fillRect(px + (1 - h) * 38, py + h * 46, 10, 6);
    } else if (b === B_WATER) {
      ctx.fillStyle = '#2a4d7d';
      ctx.fillRect(px + h * 30, py + h * 40, 26, 4);
    } else if (b === B_SNOW) {
      ctx.fillStyle = '#d6e4f5';
      ctx.fillRect(px + h * 36, py + h * 30, 12, 6);
    } else if (b === B_DESERT || b === B_SAND) {
      ctx.fillStyle = '#8a5f36';
      ctx.fillRect(px + h * 40, py + h * 42, 12, 5);
    } else if (b === B_VOLCANIC) {
      ctx.fillStyle = '#1c1116';
      ctx.fillRect(px + h * 38, py + h * 38, 16, 8);
    } else if (b === B_ROCK) {
      ctx.fillStyle = '#43474f';
      ctx.fillRect(px + h * 36, py + h * 36, 14, 9);
    } else if (b === B_CRYSTAL) {
      ctx.fillStyle = '#332054';
      ctx.fillRect(px + h * 38, py + h * 38, 12, 7);
    } else if (b === B_LAVA) {
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(px + h * 30, py + h * 34, 20, 6);
    }
    ctx.globalAlpha = 1;
  },

  /* 바이옴별 장식 결정 (확률) */
  decoFor(b, wtx, wty, rng) {
    const r = rng();
    switch (b) {
      case B_GRASS:  if (r < 0.045) return { k: 'tree' }; if (r < 0.10) return { k: 'flower' }; break;
      case B_FOREST: if (r < 0.17) return { k: 'tree' }; if (r < 0.22) return { k: 'mushroom' }; break;
      case B_SNOW:   if (r < 0.08) return { k: 'pine' }; if (r < 0.11) return { k: 'rock' }; break;
      case B_DESERT: if (r < 0.04) return { k: 'cactus' }; if (r < 0.065) return { k: 'rock' }; break;
      case B_SAND:   if (r < 0.02) return { k: 'shell' }; break;
      case B_VOLCANIC: if (r < 0.07) return { k: 'lavarock' }; break;
      case B_CRYSTAL:  if (r < 0.13) return { k: 'crystal' }; break;
      case B_ROCK:   if (r < 0.2) return { k: 'rock' }; break;
    }
    return null;
  },

  /* 장식 스프라이트 그리기 (에셋 없이 캔버스로) */
  drawDeco(ctx, d, rng) {
    const s = 0.8 + rng() * 0.5;
    const x = d.x, y = d.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    switch (d.k) {
      case 'tree':
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 6, 16, 6, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a2a1c'; ctx.fillRect(-4, -14, 8, 20);
        ctx.fillStyle = '#256b3f'; ctx.beginPath(); ctx.arc(0, -26, 17, 0, TAU); ctx.fill();
        ctx.fillStyle = '#349156'; ctx.beginPath(); ctx.arc(-7, -31, 11, 0, TAU); ctx.arc(9, -29, 10, 0, TAU); ctx.fill();
        break;
      case 'pine':
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 5, 14, 5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3a2a1c'; ctx.fillRect(-3, -8, 6, 13);
        ctx.fillStyle = '#1a4a2e';
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(0, -40 + i * 12); ctx.lineTo(-13 + i * 2, -18 + i * 10); ctx.lineTo(13 - i * 2, -18 + i * 10);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = 'rgba(210,228,255,0.55)';
        ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(-6, -28); ctx.lineTo(6, -28); ctx.closePath(); ctx.fill();
        break;
      case 'cactus':
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 6, 12, 4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#20563a';
        this.rr(ctx, -5, -26, 10, 32, 5); ctx.fill();
        this.rr(ctx, -14, -18, 8, 12, 4); ctx.fill();
        this.rr(ctx, 6, -22, 8, 12, 4); ctx.fill();
        break;
      case 'rock':
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(0, 4, 13, 5, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#9aa0a8';
        ctx.beginPath(); ctx.moveTo(-12, 4); ctx.lineTo(-9, -9); ctx.lineTo(0, -13); ctx.lineTo(10, -8); ctx.lineTo(12, 4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c3c9d1'; ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(0, -13); ctx.lineTo(4, -4); ctx.lineTo(-5, -2); ctx.closePath(); ctx.fill();
        break;
      case 'lavarock':
        ctx.fillStyle = '#3a252c';
        ctx.beginPath(); ctx.moveTo(-13, 4); ctx.lineTo(-8, -10); ctx.lineTo(3, -14); ctx.lineTo(12, -6); ctx.lineTo(13, 4); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#ff5a1f'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-2, -8); ctx.lineTo(4, -3); ctx.stroke();
        break;
      case 'crystal': {
        const hue = 265 + rng() * 60;
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 5, 12, 4, 0, 0, TAU); ctx.fill();
        const grad = ctx.createLinearGradient(0, -34, 0, 6);
        grad.addColorStop(0, `hsl(${hue},100%,80%)`);
        grad.addColorStop(1, `hsl(${hue},85%,45%)`);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(-10, -10); ctx.lineTo(-4, 5); ctx.lineTo(6, 5); ctx.lineTo(11, -12); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.moveTo(0, -36); ctx.lineTo(-4, -12); ctx.lineTo(-1, 2); ctx.closePath(); ctx.fill();
        break;
      }
      case 'flower': {
        const c = ['#a83a5e', '#b08a2a', '#2a8a94'][rng() * 3 | 0];
        ctx.fillStyle = c;
        for (let i = 0; i < 4; i++) {
          const a = i / 4 * TAU;
          ctx.beginPath(); ctx.arc(Math.cos(a) * 4, -4 + Math.sin(a) * 4, 3.4, 0, TAU); ctx.fill();
        }
        ctx.fillStyle = '#c9d8e8'; ctx.beginPath(); ctx.arc(0, -4, 2.4, 0, TAU); ctx.fill();
        break;
      }
      case 'mushroom':
        ctx.fillStyle = '#8a8272'; ctx.fillRect(-2.6, -6, 5.2, 9);
        ctx.fillStyle = '#7e2338';
        ctx.beginPath(); ctx.arc(0, -7, 8, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#c9a0aa';
        ctx.beginPath(); ctx.arc(-3, -9, 2, 0, TAU); ctx.arc(3.4, -8, 1.6, 0, TAU); ctx.fill();
        break;
      case 'shell':
        ctx.fillStyle = '#f7c8d8';
        ctx.beginPath(); ctx.arc(0, 0, 7, Math.PI, 0); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#e291ac'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-4, -6); ctx.moveTo(0, 0); ctx.lineTo(0, -7); ctx.moveTo(0, 0); ctx.lineTo(4, -6); ctx.stroke();
        break;
    }
    ctx.restore();
  },

  rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  /* 카메라 뷰에 필요한 청크들 그리기 */
  drawWorld(ctx, camX, camY, vw, vh) {
    const c0x = Math.floor(camX / CHUNK_PX), c1x = Math.floor((camX + vw) / CHUNK_PX);
    const c0y = Math.floor(camY / CHUNK_PX), c1y = Math.floor((camY + vh) / CHUNK_PX);
    for (let cy = c0y; cy <= c1y; cy++) {
      for (let cx = c0x; cx <= c1x; cx++) {
        const ch = this.getChunk(cx, cy);
        ctx.drawImage(ch.canvas, cx * CHUNK_PX, cy * CHUNK_PX);
      }
    }
  },

  /* ---------- POI(관심 지점): 지역 해시 기반 결정적 배치 ----------
   * 지역 = 6x6 청크(3072px) 블록. 같은 시드면 항상 같은 곳에 같은 이벤트 존. */
  poiFor(rx, ry) {
    const h = hashi(rx * 13 + 7, ry * 7 + 3, this.seed + 99);
    if (h > 0.34) return null; // 지역의 34%가 이벤트 존
    const h2 = hashi(rx * 31 + 5, ry * 17 + 11, this.seed + 100);
    const type = h2 < 0.45 ? 'nest' : (h2 < 0.72 ? 'spring' : 'ritual');
    const ox = (hashi(rx, ry, this.seed + 101) - 0.5) * 1100;
    const oy = (hashi(ry, rx, this.seed + 102) - 0.5) * 1100;
    return { x: rx * 3072 + 1536 + ox, y: ry * 3072 + 1536 + oy, type, rx, ry };
  },
  poiNear(x, y, r) {
    const out = [];
    const rr = Math.ceil(r / 3072);
    const crx = Math.floor(x / 3072), cry = Math.floor(y / 3072);
    for (let ry = cry - rr; ry <= cry + rr; ry++) {
      for (let rx = crx - rr; rx <= crx + rr; rx++) {
        const p = this.poiFor(rx, ry);
        if (p) out.push(p);
      }
    }
    return out;
  },

  /* ---------- 시네마틱 안개 레이어 ---------- */  fog: [],
  initFog() {
    this.fog = [];
    // 품질별 안개 개수 (저사양 4개로 필레이트 절감)
    const n = (typeof QUALITY !== 'undefined' && QUALITY.level === 0) ? 4
      : (typeof QUALITY !== 'undefined' && QUALITY.level === 1) ? 6 : 8;
    for (let i = 0; i < n; i++) {
      this.fog.push({
        x: rand(-800, 800), y: rand(-800, 800),
        r: rand(280, 620), a: rand(0.035, 0.085),
        vx: rand(6, 22), vy: rand(-8, 8), layer: i % 2,
      });
    }
  },
  updateFog(dt) {
    const p = G.player;
    for (const f of this.fog) {
      f.x += f.vx * dt; f.y += f.vy * dt;
      // 화면 밖 멀리 나가면 반대편으로 재배치
      if (Math.abs(f.x - p.x) > 1900 || Math.abs(f.y - p.y) > 1400) {
        const a = Math.random() * TAU, d = rand(700, 1300);
        f.x = p.x + Math.cos(a) * d; f.y = p.y + Math.sin(a) * d;
        f.r = rand(280, 620);
      }
    }
  },
  drawFog(ctx, layer) {
    for (const f of this.fog) {
      if (f.layer !== layer) continue;
      Glow.draw(ctx, 'hsl(220,30%,62%)', f.x, f.y, f.r, f.a);
    }
  },

  /* 안개 레이어 캐싱 — r 300~600짜리 대형 글로우 8개를 매 프레임 풀해상도로
   * 그리는 대신 0.5배 오프스크린에 수 프레임마다 한 번만 렌더 후 blit.
   * 안개는 느리게 drift하므로 2~4프레임 staleness가 시각적으로 동일. */
  fogBack: null, fogFront: null,
  fogCX: 1e12, fogCY: 1e12, fogFrame: -9999, fogVW: 0, fogVH: 0,
  renderFogLayers(camX, camY, vw, vh, zoom) {
    const FQ = 0.5;
    const q = (typeof QUALITY !== 'undefined') ? QUALITY.level : 2;
    const interval = q === 0 ? 4 : (q === 1 ? 3 : 2);
    const moved = Math.abs(camX - this.fogCX) + Math.abs(camY - this.fogCY);
    const resized = !this.fogBack || !this.fogFront || Math.abs(vw - this.fogVW) > 4 || Math.abs(vh - this.fogVH) > 4;
    const fr = G.frame || 0;
    if (!resized && (fr - this.fogFrame) < interval && moved < 30) return;
    this.fogFrame = fr; this.fogCX = camX; this.fogCY = camY; this.fogVW = vw; this.fogVH = vh;
    const w = Math.max(2, Math.ceil(vw * FQ)), h = Math.max(2, Math.ceil(vh * FQ));
    for (const layer of [0, 1]) {
      let cv = layer === 0 ? this.fogBack : this.fogFront;
      if (!cv) { cv = document.createElement('canvas'); if (layer === 0) this.fogBack = cv; else this.fogFront = cv; }
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const fx = cv.getContext('2d');
      fx.setTransform(FQ * zoom, 0, 0, FQ * zoom, -camX * FQ * zoom, -camY * FQ * zoom);
      fx.clearRect(camX - 2, camY - 2, vw + 4, vh + 4);
      for (const f of this.fog) {
        if (f.layer !== layer) continue;
        Glow.draw(fx, 'hsl(220,30%,62%)', f.x, f.y, f.r, f.a);
      }
    }
  },
  blitFog(ctx, layer, camX, camY, vw, vh) {
    const cv = layer === 0 ? this.fogBack : this.fogFront;
    if (!cv || !cv.width) return;
    ctx.drawImage(cv, camX, camY, vw, vh);
  },

  /* 미니맵: 주변 바이옴 + 엔티티 점 (품질별 캐시 0.7s/1.0s/1.4s, 저사양 4px 스텝) */
  drawMinimap(mctx, W, px, py, enemies, boss) {
    const now = performance.now();
    const qLv = (typeof QUALITY !== 'undefined') ? QUALITY.level : 2;
    const cacheMs = qLv === 0 ? 1400 : (qLv === 1 ? 1000 : 700);
    const step = qLv === 0 ? 4 : 2;
    if (!this.mmCache || now - this.mmTime > cacheMs || this.mmCache.width !== W) {
      this.mmTime = now;
      if (!this.mmCache) { this.mmCache = document.createElement('canvas'); this.mmCache.width = W; this.mmCache.height = W; }
      else if (this.mmCache.width !== W) { this.mmCache.width = W; this.mmCache.height = W; }
      const cctx = this.mmCache.getContext('2d');
      const scale = 26; // 1px = 26 world px
      const ox = px / scale - W / 2, oy = py / scale - W / 2;
      for (let y = 0; y < W; y += step) {
        for (let x = 0; x < W; x += step) {
          const b = this.biome(Math.floor((ox + x) * scale / TILE), Math.floor((oy + y) * scale / TILE));
          cctx.fillStyle = `rgb(${BIOME_INFO[b].base.join(',')})`;
          cctx.fillRect(x, y, step, step);
        }
      }
    }
    mctx.clearRect(0, 0, W, W);
    mctx.drawImage(this.mmCache, 0, 0);
    const scale = 26;
    // 적 점
    mctx.fillStyle = 'rgba(255,70,70,0.9)';
    for (const e of enemies) {
      const mx = (e.x - px) / scale + W / 2, my = (e.y - py) / scale + W / 2;
      if (mx < 0 || my < 0 || mx > W || my > W) continue;
      mctx.fillStyle = e.boss ? '#ff0044' : (e.elite ? '#ffa500' : 'rgba(255,70,70,0.85)');
      const s = e.boss ? 5 : (e.elite ? 3.5 : 2);
      mctx.fillRect(mx - s / 2, my - s / 2, s, s);
    }
    if (boss) {
      const mx = (boss.x - px) / scale + W / 2, my = (boss.y - py) / scale + W / 2;
      mctx.fillStyle = '#ff0044';
      mctx.beginPath(); mctx.arc(mx, my, 5, 0, TAU); mctx.fill();
      mctx.strokeStyle = '#fff'; mctx.lineWidth = 1.6; mctx.stroke();
    }
    // POI 아이콘 (둥지/샘/의식)
    const pois = this.poiNear(px, py, 1800);
    for (const poi of pois) {
      const mx = (poi.x - px) / scale + W / 2, my = (poi.y - py) / scale + W / 2;
      if (mx < 4 || my < 4 || mx > W - 4 || my > W - 4) continue;
      const c = poi.type === 'nest' ? '#ff3b5c' : (poi.type === 'spring' ? '#ffd23f' : '#b06cff');
      const cleared = G.poisCleared && G.poisCleared.has(poi.rx + ',' + poi.ry);
      mctx.globalAlpha = cleared ? 0.35 : 1;
      mctx.fillStyle = c;
      mctx.save();
      mctx.translate(mx, my);
      mctx.rotate(Math.PI / 4);
      mctx.fillRect(-3, -3, 6, 6);
      mctx.restore();
      mctx.globalAlpha = 1;
    }
    // 퀘스트 목적지 마커
    if (G.questTarget) {
      const mx = (G.questTarget.x - px) / scale + W / 2, my = (G.questTarget.y - py) / scale + W / 2;
      const cx = clamp(mx, 5, W - 5), cy = clamp(my, 5, W - 5);
      mctx.strokeStyle = '#4de3ff';
      mctx.lineWidth = 1.8;
      mctx.beginPath(); mctx.arc(cx, cy, 5, 0, TAU); mctx.stroke();
      mctx.fillStyle = '#4de3ff';
      mctx.beginPath(); mctx.arc(cx, cy, 1.6, 0, TAU); mctx.fill();
    }
    // 황금 목적지 마커 (맥동하는 금색 다이아, 화면 밖이면 가장자리에 클램프)
    if (G.golden) {
      const now2 = performance.now();
      const mx = (G.golden.x - px) / scale + W / 2, my = (G.golden.y - py) / scale + W / 2;
      const cx = clamp(mx, 7, W - 7), cy = clamp(my, 7, W - 7);
      const s = 4.5 + Math.sin(now2 / 220) * 1.5;
      mctx.save();
      mctx.translate(cx, cy);
      mctx.rotate(Math.PI / 4);
      mctx.fillStyle = '#ffd23f';
      mctx.fillRect(-s / 2, -s / 2, s, s);
      mctx.strokeStyle = '#fff';
      mctx.lineWidth = 1.4;
      mctx.strokeRect(-s / 2, -s / 2, s, s);
      mctx.restore();
    }
    // 플레이어
    mctx.fillStyle = '#fff';
    mctx.beginPath(); mctx.arc(W / 2, W / 2, 3.4, 0, TAU); mctx.fill();
    mctx.strokeStyle = '#4de3ff'; mctx.lineWidth = 1.6; mctx.stroke();
  },
};
