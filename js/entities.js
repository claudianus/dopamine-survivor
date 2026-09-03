'use strict';
/* ============================================================
 * 도파민 서바이버 - 적 / 엘리트 / 보스
 * ============================================================ */

const ENEMY_TYPES = {
  slime:   { name: '슬라임',   biomes: [B_GRASS, B_FOREST], tier: 1, hp: 10,  spd: 72,  r: 15, dmg: 8,  xp: 1, color: '#57d977' },
  mushroom:{ name: '독버섯',   biomes: [B_FOREST],          tier: 1, hp: 14,  spd: 58,  r: 15, dmg: 9,  xp: 1, color: '#e0455f' },
  bat:     { name: '박쥐',     biomes: [B_FOREST, B_CRYSTAL], tier: 1, hp: 8, spd: 118, r: 12, dmg: 7,  xp: 1, color: '#9b6df0' },
  islime:  { name: '얼음 슬라임', biomes: [B_SNOW],         tier: 1, hp: 13,  spd: 66,  r: 15, dmg: 8,  xp: 1, color: '#6fd7ff' },
  scorpion:{ name: '전갈',     biomes: [B_DESERT, B_SAND],  tier: 2, hp: 26,  spd: 92,  r: 17, dmg: 12, xp: 3, color: '#e08a3c' },
  mummy:   { name: '미라',     biomes: [B_DESERT],          tier: 2, hp: 40,  spd: 52,  r: 18, dmg: 14, xp: 3, color: '#d8cfae' },
  wolf:    { name: '눈늑대',   biomes: [B_SNOW, B_FOREST],  tier: 2, hp: 22,  spd: 132, r: 16, dmg: 11, xp: 3, color: '#aebfd4' },
  imp:     { name: '임프',     biomes: [B_VOLCANIC, B_CRYSTAL], tier: 2, hp: 20, spd: 122, r: 14, dmg: 10, xp: 3, color: '#ff5a4d' },
  yeti:    { name: '설인',     biomes: [B_SNOW],            tier: 3, hp: 90,  spd: 54,  r: 24, dmg: 18, xp: 8, color: '#eef6ff' },
  golem:   { name: '마그마 골렘', biomes: [B_VOLCANIC],     tier: 3, hp: 120, spd: 44,  r: 26, dmg: 20, xp: 8, color: '#c93b1d' },
  cguard:  { name: '크리스탈 수호자', biomes: [B_CRYSTAL],  tier: 3, hp: 75,  spd: 76,  r: 20, dmg: 16, xp: 8, color: '#c77dff' },
  wisp:    { name: '도파민 정령', biomes: [B_CRYSTAL, B_ROCK], tier: 2, hp: 18, spd: 104, r: 13, dmg: 9, xp: 4, color: '#ff8fd8' },
};

const BOSSES = [
  { min: 5,  id: 'slimeking', name: '슬라임 킹',   color: '#2ecc71', r: 52, hp: 900,  spd: 62, dmg: 22 },
  { min: 10, id: 'scorpking', name: '전갈 왕',     color: '#ff9f1c', r: 56, hp: 3200, spd: 74, dmg: 28 },
  { min: 15, id: 'frostgiant',name: '서리 거인',   color: '#9bd3ff', r: 62, hp: 9000, spd: 58, dmg: 34 },
  { min: 20, id: 'dopdemon',  name: '도파민 데몬', color: '#ff2d95', r: 66, hp: 22000, spd: 66, dmg: 42, final: true },
];

/* 월드 좌표 → 그 바이옴에 맞는 적 하나 뽑기 */
function pickEnemyForBiome(b, tierWeights) {
  const pool = [];
  for (const id in ENEMY_TYPES) {
    const t = ENEMY_TYPES[id];
    if (!t.biomes.includes(b)) continue;
    pool.push({ id, w: tierWeights[t.tier] || 0.05 });
  }
  if (!pool.length) pool.push({ id: 'slime', w: 1 });
  let sum = 0; for (const p of pool) sum += p.w;
  let r = Math.random() * sum;
  for (const p of pool) { r -= p.w; if (r <= 0) return p.id; }
  return pool[pool.length - 1].id;
}

function spawnEnemy(x, y, typeId, opts = {}) {
  const def = ENEMY_TYPES[typeId];
  const m = G.minute; // 경과 분
  const hpMul = 1 + m * 0.45 + m * m * 0.13;
  const dmgMul = 1 + m * 0.11;
  const e = {
    type: typeId, def,
    x, y, vx: 0, vy: 0,
    r: def.r,
    hp: def.hp * hpMul, maxHp: def.hp * hpMul,
    spd: def.spd * (0.92 + Math.random() * 0.16),
    dmg: def.dmg * dmgMul,
    xp: def.xp,
    color: def.color,
    elite: !!opts.elite, boss: false,
    flash: 0, hitCd: 0, wobble: Math.random() * TAU,
    slow: 0, stun: 0,
    hitBy: new Map(), // 무기별 히트 쿨다운 (오라/궤도용)
  };
  if (opts.elite) {
    e.r *= 1.45; e.hp *= 7; e.maxHp = e.hp; e.dmg *= 1.4; e.xp *= 5; e.spd *= 0.92;
  }
  G.enemies.push(e);
  return e;
}

function spawnBoss(bd) {
  const a = Math.random() * TAU;
  const d = Math.max(G.view.w, G.view.h) * 0.5 + 160;
  const e = {
    type: bd.id, def: { name: bd.name, tier: 3 },
    bossDef: bd, boss: true, elite: false,
    x: G.player.x + Math.cos(a) * d, y: G.player.y + Math.sin(a) * d,
    vx: 0, vy: 0, r: bd.r,
    hp: bd.hp, maxHp: bd.hp,
    spd: bd.spd, dmg: bd.dmg, xp: 100,
    color: bd.color,
    flash: 0, hitCd: 0, wobble: 0,
    slow: 0, stun: 0, atkCd: 3.0, dashT: 0, dashing: 0,
    hitBy: new Map(),
  };
  G.enemies.push(e);
  G.boss = e;
  return e;
}

/* 스폰 관리: 시간에 따라 목표 수치 유지 */
function updateSpawns(dt) {
  const p = G.player;
  const m = G.minute;
  // 분당 티어 가중치 변화
  const tw = {
    1: 10,
    2: m < 1.5 ? 0 : Math.min(2 + m * 1.4, 10),
    3: m < 4 ? 0 : Math.min(1 + (m - 4) * 0.8, 8),
  };
  const target = Math.min(14 + m * 11, 110);
  G.spawnAcc += dt;
  const interval = 0.22;
  while (G.spawnAcc > interval) {
    G.spawnAcc -= interval;
    if (G.enemies.length >= target) break;
    const n = 1 + (Math.random() * (1 + m / 4) | 0);
    for (let i = 0; i < n && G.enemies.length < target + 8; i++) {
      const a = Math.random() * TAU;
      const d = Math.max(G.view.w, G.view.h) * 0.62 + rand(60, 320);
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      const b = MapGen.biome(Math.floor(x / TILE), Math.floor(y / TILE));
      // 도파민 광산은 엘리트 확률 상승 (도파민!)
      const eliteP = 0.012 + m * 0.004 + (b === B_CRYSTAL ? 0.05 : 0) + G.passives.luck * 0.006;
      spawnEnemy(x, y, pickEnemyForBiome(b, tw), { elite: Math.random() < eliteP });
    }
  }

  // 45초마다 러시 웨이브
  G.rushT -= dt;
  if (G.rushT <= 0) {
    G.rushT = 45;
    const cnt = 14 + Math.floor(m * 3);
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * TAU;
      const d = Math.max(G.view.w, G.view.h) * 0.7 + 80;
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      const b = MapGen.biome(Math.floor(x / TILE), Math.floor(y / TILE));
      spawnEnemy(x, y, pickEnemyForBiome(b, tw), {});
    }
    showBanner(' 몰려온다!!', '#ff5d5d');
    SFX.play('boss');
    shakeCam(6);
  }

  // 보스 스폰 (5/10/15/20분)
  for (const bd of BOSSES) {
    if (G.minute >= bd.min && !G.bossSpawned.has(bd.min)) {
      G.bossSpawned.add(bd.min);
      spawnBoss(bd);
      showBanner('👑 ' + bd.name + ' 등장!', '#ffd23f');
      SFX.play('boss');
      shakeCam(14);
    }
  }
}

/* 공간 해시 (적 충돌/근접 검색) */
function buildSpatialHash() {
  G.hash = new Map();
  const cell = 110;
  for (const e of G.enemies) {
    const k = ((e.x / cell) | 0) + ',' + ((e.y / cell) | 0);
    let arr = G.hash.get(k);
    if (!arr) { arr = []; G.hash.set(k, arr); }
    arr.push(e);
  }
}
function queryEnemies(x, y, r) {
  const cell = 110;
  const out = [];
  const x0 = ((x - r) / cell) | 0, x1 = ((x + r) / cell) | 0;
  const y0 = ((y - r) / cell) | 0, y1 = ((y + r) / cell) | 0;
  const r2 = r * r;
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const arr = G.hash.get(cx + ',' + cy);
      if (!arr) continue;
      for (const e of arr) {
        const dx = e.x - x, dy = e.y - y;
        if (dx * dx + dy * dy <= (r + e.r) * (r + e.r)) out.push(e);
      }
    }
  }
  return out;
}
function nearestEnemy(x, y, maxR = 700, excludeSet) {
  let best = null, bd = maxR * maxR;
  for (const e of G.enemies) {
    if (excludeSet && excludeSet.has(e)) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

/* 적 업데이트 */
function updateEnemies(dt) {
  const p = G.player;
  buildSpatialHash();

  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];

    // 너무 멀면 제거 (리스폰됨)
    if (dist2(e.x, e.y, p.x, p.y) > 2600 * 2600) { G.enemies.splice(i, 1); continue; }

    e.flash = Math.max(0, e.flash - dt * 8);
    e.hitCd = Math.max(0, e.hitCd - dt);
    e.slow = Math.max(0, e.slow - dt);
    e.stun = Math.max(0, e.stun - dt);
    e.wobble += dt * 6;

    let sp = e.spd * (e.slow > 0 ? 0.55 : 1) * MapGen.groundSpeed(e.x, e.y);

    if (e.stun > 0) { e.vx = 0; e.vy = 0; }
    else {
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;

      // 보스 패턴
      if (e.boss) {
        e.atkCd -= dt;
        if (e.dashing > 0) {
          e.dashing -= dt;
          sp *= 3.1;
        } else if (e.atkCd <= 0) {
          e.atkCd = 3.6;
          if (Math.random() < 0.5) { e.dashing = 0.62; SFX.play('dash'); }
          else {
            // 방사형 탄막
            const n = 10 + (e.bossDef.final ? 6 : 0);
            for (let k = 0; k < n; k++) {
              const a = (k / n) * TAU + Math.random() * 0.3;
              G.eProjectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, r: 9, dmg: e.dmg * 0.5, life: 3.2, color: e.color });
            }
            SFX.play('shoot');
          }
        }
      }

      // 이동 (박쥐/정령은 지그재그)
      let mvx = dx / d, mvy = dy / d;
      if (e.type === 'bat' || e.type === 'wisp') {
        const wob = Math.sin(e.wobble * 1.7) * 0.8;
        const px2 = -mvy, py2 = mvx;
        mvx += px2 * wob; mvy += py2 * wob;
        const l = Math.hypot(mvx, mvy) || 1; mvx /= l; mvy /= l;
      }

      // 간단한 분리(밀어내기) — 같은 셀 내 최대 4마리만 검사
      const arr = G.hash.get(((e.x / 110) | 0) + ',' + ((e.y / 110) | 0));
      if (arr) {
        let cnt = 0;
        for (const o of arr) {
          if (o === e || cnt++ > 4) break;
          const ddx = e.x - o.x, ddy = e.y - o.y;
          const dd = ddx * ddx + ddy * ddy;
          const min = (e.r + o.r) * 0.8;
          if (dd > 0.01 && dd < min * min) {
            const dl = Math.sqrt(dd);
            mvx += (ddx / dl) * 0.6; mvy += (ddy / dl) * 0.6;
          }
        }
      }

      e.x += mvx * sp * dt;
      e.y += mvy * sp * dt;
    }

    // 플레이어 접촉 피해
    const pd = dist2(e.x, e.y, p.x, p.y);
    if (pd < (e.r + p.r) * (e.r + p.r) && p.iFrames <= 0) {
      hurtPlayer(e.dmg);
      p.iFrames = 0.7;
      // 넉백
      const d = Math.sqrt(pd) || 1;
      e.x -= (p.x - e.x) / d * 18; e.y -= (p.y - e.y) / d * 18;
    }
  }

  // 보스 사망 체크는 killEnemy에서 처리
}

/* 적 피해 처리 */
function damageEnemy(e, dmg, canCrit = true, knockAng = null) {
  let crit = false;
  if (canCrit && Math.random() < G.player.critC) { dmg *= G.player.critD; crit = true; }
  e.hp -= dmg;
  e.flash = 1;
  spawnDmgText(e.x + rand(-8, 8), e.y - e.r - 4, Math.round(dmg), crit);
  SFX.play(crit ? 'crit' : 'hit');
  if (knockAng !== null && !e.boss) {
    e.x += Math.cos(knockAng) * 6; e.y += Math.sin(knockAng) * 6;
  }
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  const idx = G.enemies.indexOf(e);
  if (idx < 0) return;
  G.enemies.splice(idx, 1);

  G.stats.kills++;
  addCombo();
  SFX.play('kill');
  shakeCam(e.boss ? 20 : (e.elite ? 5 : 1.4));

  // 파티클 폭발
  const n = e.boss ? 60 : (e.elite ? 26 : 12);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, s = rand(60, e.boss ? 420 : 240);
    G.particles.push({
      x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rand(0.3, 0.8), maxLife: 0.8, size: rand(2, e.boss ? 9 : 5),
      color: e.color, grav: 260,
    });
  }

  // 젬 드롭
  const gemVal = e.boss ? 50 : e.xp;
  const gemCount = e.boss ? 6 : 1;
  for (let i = 0; i < gemCount; i++) {
    G.pickups.push({
      kind: 'gem', x: e.x + rand(-e.r, e.r), y: e.y + rand(-e.r, e.r),
      val: gemVal, t: Math.random() * TAU, vx: rand(-60, 60), vy: rand(-60, 60),
    });
  }

  // 하트 / 자석 드롭
  const luck = G.passives.luck;
  if (Math.random() < 0.02 + luck * 0.008) {
    G.pickups.push({ kind: 'heart', x: e.x, y: e.y, val: 25, t: 0, vx: 0, vy: 0 });
  } else if (Math.random() < 0.004 + luck * 0.003) {
    G.pickups.push({ kind: 'magnet', x: e.x, y: e.y, val: 0, t: 0, vx: 0, vy: 0 });
  }

  // 상자 드롭
  const chestP = e.boss ? 1 : (e.elite ? 0.22 + luck * 0.02 : 0);
  if (Math.random() < chestP) {
    G.pickups.push({ kind: 'chest', x: e.x, y: e.y - 10, val: e.boss ? 5 : 3, t: 0, vx: 0, vy: 0 });
    showBanner(e.boss ? '💎 보물 상자 등장!' : '💎 상자 드롭!', '#ffd23f');
  }

  // 젬 수 상한 병합
  if (G.pickups.length > 380) {
    let merged = 0;
    for (let i = 0; i < G.pickups.length && merged < 60; i++) {
      const p = G.pickups[i];
      if (p.kind === 'gem') { G.pickups.splice(i, 1); G.pickups[randi(0, G.pickups.length - 1)].val += p.val; merged++; i--; }
    }
  }

  // 보스 처치
  if (e.boss) {
    G.boss = null;
    showBanner('🏆 ' + e.bossDef.name + ' 격파!', '#7dffa0');
    SFX.play('boom');
    G.hitStop = 0.35;
    if (e.bossDef.final) victory();
  }
}

/* 적 투사체 */
function updateEProjectiles(dt) {
  const p = G.player;
  for (let i = G.eProjectiles.length - 1; i >= 0; i--) {
    const b = G.eProjectiles[i];
    b.life -= dt;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.life <= 0) { G.eProjectiles.splice(i, 1); continue; }
    if (dist2(b.x, b.y, p.x, p.y) < (b.r + p.r) * (b.r + p.r)) {
      if (p.iFrames <= 0) { hurtPlayer(b.dmg); p.iFrames = 0.4; }
      G.eProjectiles.splice(i, 1);
    }
  }
}

/* 적 그리기 (에셋 없이 캔버스 도형 + 귀여운 눈) */
function drawEyes(ctx, x, y, r, dirX, sleepy) {
  const ex = clamp(dirX * 0.25, -0.4, 0.4) * r;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x - r * 0.32 + ex, y - r * 0.12, r * 0.24, 0, TAU);
  ctx.arc(x + r * 0.32 + ex, y - r * 0.12, r * 0.24, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1a1a2e';
  ctx.beginPath();
  ctx.arc(x - r * 0.32 + ex * 1.4, y - r * 0.1, r * 0.11, 0, TAU);
  ctx.arc(x + r * 0.32 + ex * 1.4, y - r * 0.1, r * 0.11, 0, TAU);
  ctx.fill();
}

function drawEnemy(ctx, e) {
  const p = G.player;
  const dx = p.x - e.x;
  const squash = 1 + Math.sin(e.wobble) * 0.06;
  ctx.save();
  ctx.translate(e.x, e.y);

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, e.r * 0.8, e.r * 0.85, e.r * 0.32, 0, 0, TAU); ctx.fill();

  // 엘리트/보스 오라
  if (e.elite || e.boss) {
    ctx.strokeStyle = e.boss ? 'rgba(255,45,149,0.8)' : 'rgba(255,210,63,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, e.r + 7 + Math.sin(e.wobble * 1.4) * 2, 0, TAU); ctx.stroke();
  }

  ctx.scale(1 / squash, squash);
  const r = e.r;
  const body = e.flash > 0.4 ? '#ffffff' : e.color;

  switch (e.type) {
    case 'slime': case 'islime': case 'slimeking': {
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.62);
      ctx.quadraticCurveTo(-r, -r * 1.1, 0, -r * 1.05);
      ctx.quadraticCurveTo(r, -r * 1.1, r, r * 0.62);
      ctx.quadraticCurveTo(0, r * 0.95, -r, r * 0.62);
      ctx.fill();
      // 하이라이트
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.45, r * 0.25, r * 0.15, -0.5, 0, TAU); ctx.fill();
      drawEyes(ctx, 0, -r * 0.1, r, dx, false);
      // 왕관
      if (e.boss) drawCrown(ctx, 0, -r * 1.1, r * 0.5);
      break;
    }
    case 'mushroom': {
      ctx.fillStyle = '#e8e0d0';
      ctx.fillRect(-r * 0.35, -r * 0.2, r * 0.7, r * 0.9);
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, -r * 0.3, r * 0.95, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.55, r * 0.18, 0, TAU); ctx.arc(r * 0.3, -r * 0.5, r * 0.14, 0, TAU); ctx.fill();
      drawEyes(ctx, 0, r * 0.15, r, dx, true);
      break;
    }
    case 'bat': case 'wisp': {
      const flap = Math.sin(e.wobble * 2.6);
      ctx.fillStyle = body;
      // 날개
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, 0); ctx.lineTo(-r * 1.7, -flap * r * 0.8 - r * 0.2); ctx.lineTo(-r * 0.5, r * 0.4);
      ctx.moveTo(r * 0.4, 0); ctx.lineTo(r * 1.7, -flap * r * 0.8 - r * 0.2); ctx.lineTo(r * 0.5, r * 0.4);
      ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, TAU); ctx.fill();
      drawEyes(ctx, 0, 0, r * 0.75, dx, false);
      break;
    }
    case 'scorpion': case 'scorpking': {
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.85, r * 0.6, 0, 0, TAU); ctx.fill();
      // 꼬리
      ctx.strokeStyle = body; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round';
      const ts = Math.sin(e.wobble * 2) * 0.2;
      ctx.beginPath(); ctx.moveTo(-r * 0.6, 0);
      ctx.quadraticCurveTo(-r * 1.4, -r * (0.5 + ts), -r * 0.9, -r * (1.15 + ts)); ctx.stroke();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(-r * 0.9, -r * (1.15 + ts), r * 0.14, 0, TAU); ctx.fill();
      // 집게
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(r * 0.95, -r * 0.3, r * 0.28, 0, TAU); ctx.arc(r * 0.95, r * 0.3, r * 0.28, 0, TAU); ctx.fill();
      drawEyes(ctx, r * 0.2, 0, r * 0.7, dx, false);
      if (e.boss) drawCrown(ctx, 0, -r * 0.6, r * 0.45);
      break;
    }
    case 'mummy': {
      ctx.fillStyle = body;
      MapGen.rr(ctx, -r * 0.6, -r * 0.85, r * 1.2, r * 1.7, r * 0.35); ctx.fill();
      ctx.strokeStyle = '#b5a882'; ctx.lineWidth = r * 0.12;
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, -r * 0.3); ctx.lineTo(r * 0.55, -r * 0.45);
      ctx.moveTo(-r * 0.55, r * 0.2); ctx.lineTo(r * 0.55, r * 0.05);
      ctx.moveTo(-r * 0.55, r * 0.65); ctx.lineTo(r * 0.55, r * 0.5);
      ctx.stroke();
      drawEyes(ctx, 0, -r * 0.45, r * 0.85, dx, false);
      break;
    }
    case 'wolf': {
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 0.6, 0, 0, TAU); ctx.fill();
      // 머리
      ctx.beginPath(); ctx.arc(r * 0.75, -r * 0.15, r * 0.45, 0, TAU); ctx.fill();
      // 귀
      ctx.beginPath();
      ctx.moveTo(r * 0.55, -r * 0.5); ctx.lineTo(r * 0.7, -r * 1.05); ctx.lineTo(r * 0.95, -r * 0.45);
      ctx.fill();
      // 꼬리
      ctx.beginPath(); ctx.ellipse(-r * 0.95, -r * 0.25, r * 0.4, r * 0.18, -0.5, 0, TAU); ctx.fill();
      drawEyes(ctx, r * 0.7, -r * 0.2, r * 0.45, dx, false);
      break;
    }
    case 'imp': case 'dopdemon': {
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, TAU); ctx.fill();
      // 뿔
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, -r * 0.6); ctx.lineTo(-r * 0.75, -r * 1.2); ctx.lineTo(-r * 0.15, -r * 0.75);
      ctx.moveTo(r * 0.45, -r * 0.6); ctx.lineTo(r * 0.75, -r * 1.2); ctx.lineTo(r * 0.15, -r * 0.75);
      ctx.fill();
      // 입
      ctx.strokeStyle = '#2a0a10'; ctx.lineWidth = r * 0.1;
      ctx.beginPath(); ctx.arc(0, r * 0.25, r * 0.3, 0.2, Math.PI - 0.2); ctx.stroke();
      drawEyes(ctx, 0, -r * 0.15, r * 0.8, dx, false);
      if (e.boss) drawCrown(ctx, 0, -r * 0.9, r * 0.5);
      break;
    }
    case 'yeti': case 'frostgiant': {
      ctx.fillStyle = body;
      MapGen.rr(ctx, -r * 0.7, -r * 0.8, r * 1.4, r * 1.6, r * 0.5); ctx.fill();
      // 팔
      ctx.beginPath(); ctx.arc(-r * 0.85, 0, r * 0.32, 0, TAU); ctx.arc(r * 0.85, 0, r * 0.32, 0, TAU); ctx.fill();
      // 얼굴 패치
      ctx.fillStyle = '#bcd8f0';
      MapGen.rr(ctx, -r * 0.4, -r * 0.5, r * 0.8, r * 0.6, r * 0.25); ctx.fill();
      drawEyes(ctx, 0, -r * 0.3, r * 0.6, dx, false);
      if (e.boss) drawCrown(ctx, 0, -r * 0.8, r * 0.55);
      break;
    }
    case 'golem': {
      ctx.fillStyle = body;
      MapGen.rr(ctx, -r * 0.75, -r * 0.75, r * 1.5, r * 1.5, r * 0.3); ctx.fill();
      ctx.fillStyle = e.flash > 0.4 ? '#fff' : '#8a2413';
      MapGen.rr(ctx, -r * 0.45, -r * 0.45, r * 0.9, r * 0.9, r * 0.2); ctx.fill();
      // 균열 + 용암 발광
      ctx.strokeStyle = '#ffb020'; ctx.lineWidth = r * 0.1;
      ctx.beginPath(); ctx.moveTo(-r * 0.6, r * 0.3); ctx.lineTo(-r * 0.1, -r * 0.05); ctx.lineTo(r * 0.4, r * 0.35); ctx.stroke();
      drawEyes(ctx, 0, -r * 0.15, r * 0.75, dx, false);
      break;
    }
    case 'cguard': {
      const grad = ctx.createLinearGradient(0, -r, 0, r);
      grad.addColorStop(0, '#e3b8ff'); grad.addColorStop(1, '#9b5de5');
      ctx.fillStyle = e.flash > 0.4 ? '#fff' : grad;
      ctx.beginPath();
      ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, -r * 0.2); ctx.lineTo(r * 0.55, r * 0.85);
      ctx.lineTo(-r * 0.55, r * 0.85); ctx.lineTo(-r * 0.8, -r * 0.2);
      ctx.closePath(); ctx.fill();
      drawEyes(ctx, 0, 0, r * 0.8, dx, false);
      break;
    }
    default: {
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, TAU); ctx.fill();
      drawEyes(ctx, 0, 0, r * 0.85, dx, false);
    }
  }
  ctx.restore();

  // 엘리트/보스 체력바
  if ((e.elite || e.boss) && e.hp < e.maxHp && !e.bossShowTopBar) {
    const w = e.r * 2.2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(e.x - w / 2, e.y - e.r - 14, w, 5);
    ctx.fillStyle = e.boss ? '#ff2d95' : '#ffd23f';
    ctx.fillRect(e.x - w / 2, e.y - e.r - 14, w * clamp(e.hp / e.maxHp, 0, 1), 5);
  }
}

function drawCrown(ctx, x, y, s) {
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.lineTo(x - s, y - s * 0.9);
  ctx.lineTo(x - s * 0.45, y - s * 0.35);
  ctx.lineTo(x, y - s * 1.05);
  ctx.lineTo(x + s * 0.45, y - s * 0.35);
  ctx.lineTo(x + s, y - s * 0.9);
  ctx.lineTo(x + s, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff5d8f';
  ctx.beginPath(); ctx.arc(x, y - s * 0.45, s * 0.14, 0, TAU); ctx.fill();
}
