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
  charger: { name: '돌진러',   biomes: [B_DESERT, B_VOLCANIC, B_ROCK], tier: 2, hp: 30, spd: 84, r: 18, dmg: 16, xp: 4, color: '#ff7b39' },
  spitter: { name: '뱉는놈',   biomes: [B_FOREST, B_SNOW, B_CRYSTAL], tier: 2, hp: 24, spd: 68, r: 16, dmg: 10, xp: 4, color: '#7ed957' },
  splitter:{ name: '분열 슬라임', biomes: [B_GRASS, B_FOREST, B_SAND], tier: 1, hp: 18, spd: 74, r: 17, dmg: 8, xp: 2, color: '#8ef0c0' },
  splitling:{ name: '꼬마 슬라임', biomes: [], tier: 1, hp: 7, spd: 98, r: 10, dmg: 5, xp: 1, color: '#b8ffd9' },
  thief:  { name: '광산 도적', biomes: [B_CRYSTAL, B_ROCK, B_GRASS, B_DESERT, B_SNOW], tier: 2, hp: 40, spd: 148, r: 15, dmg: 6, xp: 3, color: '#e8b74a', special: 'thief' },
  bomber: { name: '폭탄 박쥐', biomes: [B_VOLCANIC, B_FOREST, B_CRYSTAL], tier: 2, hp: 26, spd: 138, r: 14, dmg: 18, xp: 4, color: '#ff5a4d', special: 'bomber' },
  // ===== 티어4: 후반 압박군단 =====
  ruin:   { name: '루인 나이트', biomes: [B_ROCK, B_VOLCANIC, B_CRYSTAL, B_SNOW], tier: 4, hp: 380, spd: 96, r: 24, dmg: 30, xp: 25, color: '#c23a4e', special: 'knight' },
  stealer:{ name: '소울스틸러', biomes: [B_CRYSTAL, B_ROCK, B_VOLCANIC], tier: 4, hp: 300, spd: 160, r: 19, dmg: 16, xp: 30, color: '#9b59d0', special: 'stealer' },
  titan:  { name: '티타늄 골렘', biomes: [B_VOLCANIC, B_ROCK], tier: 4, hp: 1500, spd: 40, r: 34, dmg: 44, xp: 60, color: '#8a95a8', special: 'armor' },
};

const BOSSES = [
  { min: 5,  id: 'slimeking', name: '슬라임 킹',   color: '#2ecc71', r: 52, hp: 1400,  spd: 68, dmg: 26 },
  { min: 10, id: 'scorpking', name: '전갈 왕',     color: '#ff9f1c', r: 56, hp: 5200, spd: 80, dmg: 34 },
  { min: 15, id: 'frostgiant',name: '서리 거인',   color: '#9bd3ff', r: 62, hp: 15000, spd: 62, dmg: 42, summons: true },
  { min: 20, id: 'dopdemon',  name: '도파민 데몬', color: '#ff2d95', r: 66, hp: 34000, spd: 72, dmg: 52, final: true, summons: true },
];

/* 월드 좌표 → 그 바이옴에 맞는 적 하나 뽑기 */
function pickEnemyForBiome(b, tierWeights) {
  const pool = [];
  for (const id in ENEMY_TYPES) {
    const t = ENEMY_TYPES[id];
    if (!t.biomes.includes(b)) continue;
    if (t.special === 'thief') continue; // 도적은 전용 스포너로만
    // 가중치 0 = 이 분(티어)엔 스폰 안 함 (기본값 0은 의도치 않은 잡몹 유입 막음)
    const w = (tierWeights && tierWeights[t.tier]) || 0;
    if (w > 0) pool.push({ id, w });
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
  const hpMul = 1 + m * 0.42 + m * m * 0.16;  // 7분: ~11배 / 20분: ~74배 (티어4+보스가 후반 압박 담당)
  const dmgMul = 1 + m * 0.16;
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
    // 엘리트 특수 능력 (40% 확률)
    const abil = choice(['swift', 'regen', 'splitter']);
    e.abil = abil;
    if (abil === 'swift') e.spd *= 1.45;
    if (abil === 'splitter') e.splitOnDeath = true;
  }
  // ✨ 골든 몹 (0.3%): 예고 없이 터지는 순수 변동 보상 — 잡으면 잭팟 젬 분수
  if (!opts.elite && Math.random() < 0.003) {
    e.golden = true;
    e.hp *= 2.2; e.maxHp = e.hp;
    e.spd *= 0.8;
    e.xp *= 10;
  }
  e.spawnT = 0.5; // 스폰 포탈 연출
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
    1: Math.max(2, 10 - m * 0.9),                        // 잡몹은 점차 감소
    2: m < 1.5 ? 0 : Math.min(2 + m * 1.4, 10),
    3: m < 4 ? 0 : Math.min(1 + (m - 4) * 0.8, 9),
    4: m < 8 ? 0 : Math.min(0.8 + (m - 8) * 0.55, 5),   // 8분부터 후반 군단
  };
  const maxE = (typeof QUALITY !== 'undefined') ? QUALITY.maxEnemies : 160;
  const dep = Math.min(G.depth || 0, 10); // 심층부: 멀수록 밀도·정예율 상승
  const target = Math.min(14 + m * 13 + Math.min(dep * 2, 20), maxE);
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
      // 도파민 광산은 엘리트 확률 상승 (도파민!) + 심층부 보너스
      const eliteP = 0.012 + m * 0.004 + (b === B_CRYSTAL ? 0.05 : 0) + G.passives.luck * 0.006 + dep * 0.004;
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
    showBanner('⚠️ 몰려온다!!', '#ff5d5d');
    SFX.play('boss');
    shakeCam(6);
  }

  // 150초마다 정예 웨이브
  G.eliteWaveT = (G.eliteWaveT === undefined ? 150 : G.eliteWaveT) - dt;
  if (G.eliteWaveT <= 0) {
    G.eliteWaveT = 150;
    const cnt = 3 + Math.floor(m / 2);
    for (let i = 0; i < cnt; i++) {
      const a = (i / cnt) * TAU + rand(-0.2, 0.2);
      const d = Math.max(G.view.w, G.view.h) * 0.66 + 60;
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      const b = MapGen.biome(Math.floor(x / TILE), Math.floor(y / TILE));
      spawnEnemy(x, y, pickEnemyForBiome(b, tw), { elite: true });
    }
    showBanner('⚠️ 정예 웨이브!!', '#ffa500');
    SFX.play('warn');
  }

  // 도파민 결정 클러스터 스폰 (맵 상호작용)
  G.crystalT = (G.crystalT === undefined ? 12 : G.crystalT) - dt;  if (G.crystalT <= 0) {
    G.crystalT = rand(14, 22);
    if (G.crystals.length < 4) {
      for (let tries = 0; tries < 8; tries++) {
        const a = Math.random() * TAU;
        const d = rand(480, 900);
        const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
        const b = MapGen.biome(Math.floor(x / TILE), Math.floor(y / TILE));
        if (b !== B_WATER && b !== B_LAVA) {
          G.crystals.push({
            x, y, hp: 80 + m * 14, maxHp: 80 + m * 14, r: 26,
            hue: rand(260, 330), flash: 0, wobble: Math.random() * TAU,
            shards: Array.from({ length: 3 + randi(0, 2) }, () => ({
              ox: rand(-16, 16), oy: rand(-8, 10), s: rand(0.6, 1.25), tilt: rand(-0.3, 0.3),
            })),
          });
          break;
        }
      }
    }
  }

  // 광산 도적: 6분부터 주기적 출현 — 잡으면 젬 대량 (추격 사냥!)
  if (m > 6) {
    G.thiefT = (G.thiefT === undefined ? 30 : G.thiefT) - dt;
    if (G.thiefT <= 0) {
      G.thiefT = rand(28, 45);
      const a = Math.random() * TAU;
      const d2 = Math.max(G.view.w, G.view.h) * 0.55 + rand(40, 160);
      const th = spawnEnemy(p.x + Math.cos(a) * d2, p.y + Math.sin(a) * d2, 'thief', {});
      th.spawnT = 0.3;
      showBanner('💰 광산 도적이 나타났다! 잡아라!', '#e8b74a');
      SFX.play('pick');
    }
  }

  // 지형 위험물/기믹 유지 (탄력 버섯·폭발성 결정·간헐천)
  spawnMaintainHazards(dt);

  // 보스 스폰 (5/10/15/20분)
  for (const bd of BOSSES) {
    if (G.minute >= bd.min && !G.bossSpawned.has(bd.min)) {
      G.bossSpawned.add(bd.min);
      spawnBoss(bd);
      showBanner('👑 ' + bd.name + ' 등장!', '#ff3b3b');
      SFX.play('boss');
      shakeCam(9);
      zoomPunchCam(0.045);
      POST.letterbox = 1.6; // 시네마 레터박스
      POST.triggerShock(G.boss.x, G.boss.y, 0.6);
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
  // 조회 반경에 여유를 두어 큰 적(보스/골렘)이 중심점이 셀 밖이라고 누락되지 않게
  const pad = r + 40;
  const x0 = ((x - pad) / cell) | 0, x1 = ((x + pad) / cell) | 0;
  const y0 = ((y - pad) / cell) | 0, y1 = ((y + pad) / cell) | 0;
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

/* 적 + 결정 통합 타겟 (무기가 결정도 조준하게) */
function nearestTarget(x, y, maxR = 700, excludeSet) {
  let best = null, bd = maxR * maxR;
  for (const e of G.enemies) {
    if (excludeSet && excludeSet.has(e)) continue;
    const d = dist2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  for (const c of G.crystals) {
    if (excludeSet && excludeSet.has(c)) continue;
    const d = dist2(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
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

  // 스폰 포탈 연출 중엔 느리게, 무례하게 등장하지 않음
  e.spawnT = Math.max(0, e.spawnT - dt);

  e.flash = Math.max(0, e.flash - dt * 8);
  e.hitCd = Math.max(0, e.hitCd - dt);
  e.slow = Math.max(0, e.slow - dt);
  e.stun = Math.max(0, e.stun - dt);
  e.wobble += dt * 6;

  let sp = e.spd * (e.slow > 0 ? 0.55 : 1) * MapGen.groundSpeed(e.x, e.y) * (e.spawnT > 0 ? 0.25 : 1);
  // 엘리트 재생 능력
  if (e.abil === 'regen' && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt);
  if (G.rage.active) sp *= 0.45; // 도파민 러시 중엔 적이 느려짐
    if (G.frenzy) sp *= 1.4; // 광란의 밤

    if (e.stun > 0) { e.vx = 0; e.vy = 0; }
    else {
      let dx = p.x - e.x, dy = p.y - e.y;
      // 경비 AI: 둥지에서 플레이어가 멀면 홈으로 복귀/대기
      if (e.guard && e.home && dist2(p.x, p.y, e.home.x, e.home.y) > 360 * 360) {
        if (dist2(e.x, e.y, e.home.x, e.home.y) > 60 * 60) { dx = e.home.x - e.x; dy = e.home.y - e.y; }
      }
      const d = Math.hypot(dx, dy) || 1;

      // 돌진러: 조준 → 돌진 → 휴식 사이클
      if (e.type === 'charger' && !e.boss) {
        e.aiT = (e.aiT || 0) - dt;
        if (e.chargeState === 'telegraph') {
          e.tele -= dt;
          sp = 0;
          e.x += rand(-0.6, 0.6); e.y += rand(-0.6, 0.6); // 떨림 예고
          if (e.tele <= 0) { e.chargeState = 'dash'; e.dashT = 0.55; e.dashAng = Math.atan2(dy, dx); SFX.play('dash'); }
        } else if (e.chargeState === 'dash') {
          e.dashT -= dt;
          e.x += Math.cos(e.dashAng) * sp * 3.4 * dt;
          e.y += Math.sin(e.dashAng) * sp * 3.4 * dt;
          if (e.dashT <= 0) { e.chargeState = 'rest'; e.restT = 1.7; }
          sp = 0;
        } else {
          e.restT = (e.restT || 0) - dt;
          if (d < 300 && e.restT <= 0) { e.chargeState = 'telegraph'; e.tele = 0.7; SFX.play('charge'); }
        }
      }

      // 뱉는놈: 거리 유지 + 원거리 공격
      if (e.type === 'spitter' && !e.boss) {
        e.shootCd = (e.shootCd || rand(1, 2.4)) - dt;
        if (d < 210) sp *= -0.7;                       // 너무 가까우면 후퇴
        else if (d < 330) sp *= 0.12;                  // 적정 거리에선 거의 정지
        if (e.shootCd <= 0 && d < 560) {
          e.shootCd = 2.4;
          const a2 = ang(e.x, e.y, p.x, p.y);
          G.eProjectiles.push({ x: e.x, y: e.y, vx: Math.cos(a2) * 250, vy: Math.sin(a2) * 250, r: 8, dmg: e.dmg * 0.7, life: 3.4, color: '#a3ff5e' });
          SFX.play('shoot');
        }
      }

      // ===== 티어4 AI =====
      // 루인 나이트: 기본 추격 → 근접 시 회전 베기(광역), 거리 두면 돌진
      if (e.type === 'ruin') {
        e.aiT = (e.aiT || rand(1.5, 3)) - dt;
        if (d < 110 && (e.spinT || 0) <= 0 && e.aiT <= 0) {
          e.spinT = 0.8; e.aiT = rand(2, 3.2); // 회전 베기
          SFX.play('charge', e.x);
        }
        if (e.spinT > 0) {
          e.spinT -= dt;
          sp = 0;
          // 회전 베기 판정 (지속 근접 광역)
          if (d < 150 && p.iFrames <= 0) { hurtPlayer(e.dmg * 0.5, e.x, e.y); p.iFrames = 0.5; }
          if (Math.random() < dt * 20) {
            const a2 = Math.random() * TAU;
            G.particles.push({ x: e.x + Math.cos(a2) * 60, y: e.y + Math.sin(a2) * 60, vx: Math.cos(a2) * 160, vy: Math.sin(a2) * 160, life: 0.25, maxLife: 0.25, size: 3, color: '#c23a4e', grav: 0, shape: 'spark' });
          }
        }
      }
      // 소울스틸러: 빠르게 접근 → 젬 강탈 후 텔레포트로 도주
      if (e.type === 'stealer') {
        if (e.stealCd === undefined) e.stealCd = rand(2, 4);
        e.stealCd -= dt;
        if (e.stealCd <= 0) {
          e.stealCd = rand(3.5, 6);
          if (d < 90 && G.pickups.some(pk => pk.kind === 'gem')) {
            // 젬 강탈!
            const gems = G.pickups.filter(pk => pk.kind === 'gem');
            let stolen = 0;
            for (const gm of gems.slice(0, 4)) {
              const gi = G.pickups.indexOf(gm);
              if (gi >= 0) { stolen += gm.val; G.pickups.splice(gi, 1); }
            }
            if (stolen > 0) {
              e.hp = Math.min(e.maxHp, e.hp + stolen * 2); // 훔친 젬으로 회복
              spawnDmgText(e.x, e.y - 30, '💎 강탈!', false);
              SFX.play('hurt');
              showBanner('💎 소울스틸러가 젬을 훔쳤다!', '#9b59d0');
            }
          }
          // 텔레포트 도주 (플레이어 주변 랜덤)
          const ta = Math.random() * TAU;
          shardBurst(e.x, e.y, '#9b59d0', 10, 260, 4);
          e.x = p.x + Math.cos(ta) * rand(240, 380);
          e.y = p.y + Math.sin(ta) * rand(240, 380);
          shardBurst(e.x, e.y, '#9b59d0', 10, 260, 4);
          SFX.play('portal', e.x);
        }
      }
      // 티타늄 골렘: 아머 — 고정 피해 최소치만 통과, 매우 느리고 묵직
      // (AI는 기본 추격, 아머 판정은 damageEnemy에서 처리)

      // 광산 도적: 플레이어에게서 도망! 잡으면 젬 대량 드롭
      // (실제 방향 반전은 아래 이동 벡터 계산 후 e._flee 플래그로 처리 — TDZ 방지)
      if (e.type === 'thief') {
        sp *= 1 + Math.sin(e.wobble * 0.6) * 0.08; // 흐느적거리는 도주
        e._flee = true;
        // 도주 중 반짝이 젬 흘리기
        if (Math.random() < dt * 3) {
          G.particles.push({ x: e.x, y: e.y, vx: rand(-30, 30), vy: rand(-40, 0), life: 0.5, maxLife: 0.5, size: 2.5, color: '#ffe9a8', grav: 60, shape: 'spark' });
        }
      }

      // 폭탄 박쥐: 접근하면 점화 → 자폭 (적에게도 피해)
      if (e.type === 'bomber') {
        if (e.fuseT !== undefined) {
          e.fuseT -= dt;
          sp = 0;
          if (e.fuseT <= 0) {
            // 자폭!
            const idx2 = G.enemies.indexOf(e);
            if (idx2 >= 0) G.enemies.splice(idx2, 1);
            SFX.play('boom', e.x);
            POST.triggerShock(e.x, e.y, 0.5);
            kickCam(e.x - p.x, e.y - p.y, 6);
            G.explosions.push({ x: e.x, y: e.y, r: 130, life: 0.4, maxLife: 0.4, color: '#ff5a4d' });
            for (const o of queryEnemies(e.x, e.y, 100)) if (o !== e) damageEnemy(o, 55, true, null);
            if (dist2(e.x, e.y, p.x, p.y) < 100 * 100 && p.iFrames <= 0) { hurtPlayer(e.dmg, e.x, e.y); p.iFrames = 0.5; }
            shardBurst(e.x, e.y, '#ff5a4d', 16, 380, 5);
            G.stats.kills++; addCombo();
            continue;
          }
        } else if (d < 70) {
          e.fuseT = 0.55;
          SFX.play('charge', e.x);
        }
      }

      // 보스 패턴
      if (e.boss) {
        e.atkCd -= dt;
        if (e.dashing > 0) {
          e.dashing -= dt;
          sp *= 3.1;
        } else if (e.atkCd <= 0) {
          e.atkCd = 3.6;
          if (Math.random() < 0.5) { e.dashing = 0.62; SFX.play('dash'); }
          else if (e.bossDef.summons && Math.random() < 0.45) {
            // 소환: 부하 3~4마리
            const n = 3 + (e.bossDef.final ? 1 : 0);
            showBanner('👑 ' + e.bossDef.name + '이(가) 부하를 부른다!', e.color);
            SFX.play('portal', e.x);
            for (let k = 0; k < n; k++) {
              const a = (k / n) * TAU;
              const sx = e.x + Math.cos(a) * 90, sy = e.y + Math.sin(a) * 90;
              const b = MapGen.biome(Math.floor(sx / TILE), Math.floor(sy / TILE));
              const tierW = { 1: 0, 2: 10, 3: 6, 4: G.minute > 8 ? 2 : 0 };
              const m2 = spawnEnemy(sx, sy, pickEnemyForBiome(b, tierW), {});
              m2.spawnT = 0.4;
              shardBurst(sx, sy, e.color, 8, 200, 4);
            }
          } else {
            // 방사형 탄막
            const n = 12 + (e.bossDef.final ? 8 : 0);
            for (let k = 0; k < n; k++) {
              const a = (k / n) * TAU + Math.random() * 0.3;
              G.eProjectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, r: 9, dmg: e.dmg * 0.5, life: 3.2, color: e.color });
            }
            SFX.play('shoot');
          }
        }
      }

      // 이동 (박쥐/정령은 지그재그)
      let mvx = dx / d, mvy = dy / d;
      if (e._flee) { mvx = -mvx; mvy = -mvy; } // 도적 도망
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
      hurtPlayer(e.dmg, e.x, e.y);
      p.iFrames = 0.7;
      // 가시 갑주: 접촉한 적에게 반사 피해
      if (G.passives.thorns > 0 && !e.boss) {
        damageEnemy(e, 10 + G.passives.thorns * 9, true, null);
      }
      // 넉백 (도적은 접촉해도 밀리지 않게 — 젬 자루 사냥 난이도 보호)
      if (e.type !== 'thief') {
        const d = Math.sqrt(pd) || 1;
        e.x -= (p.x - e.x) / d * 18; e.y -= (p.y - e.y) / d * 18;
      }
      // 러시 중 접촉한 적은 타격당한 것으로 간주 (콤보 유지)
      if (G.rage.active) addCombo();
    }
  }

  // 보스 사망 체크는 killEnemy에서 처리
}

/* 적 피해 처리 */
function damageEnemy(e, dmg, canCrit = true, knockAng = null) {
  let crit = false;
  if (canCrit && Math.random() < G.player.critC) { dmg *= G.player.critD; crit = true; }
  // 티타늄 아머: 총 피해의 12%만 관통 + 최소 6 고정 — 탱커 처치엔 화력 집중 필요
  if (e.def && e.def.special === 'armor') {
    dmg = Math.max(6, dmg * 0.12);
  }
  e.hp -= dmg;
  e.flash = 1;
  spawnDmgText(e.x + rand(-8, 8), e.y - e.r - 4, Math.round(dmg), crit);
  SFX.play(crit ? 'crit' : 'hit', e.x);
  // 피격 스파크
  sparkBurst(e.x, e.y - e.r * 0.3, crit ? '#ffd76a' : e.color, crit ? 8 : 3, crit ? 420 : 300);
  if (knockAng !== null && !e.boss) {
    e.x += Math.cos(knockAng) * 7; e.y += Math.sin(knockAng) * 7;
  }
  if (e.hp <= 0) killEnemy(e);
}

/* ⏰ 최후의 60초 드랍 배율 (19~20분) */
function finalDropMult() { return (G.finalMinute && G.time < 1200) ? 3 : 1; }

function killEnemy(e) {
  const idx = G.enemies.indexOf(e);
  if (idx < 0) return;
  G.enemies.splice(idx, 1);

  // 도파민 러시 게이지 충전
  if (G.rage) {
    G.rage.value = Math.min(G.rage.max, G.rage.value + (e.boss ? 35 : e.elite ? 10 : 1.7));
  }

  // 🎰 도파민 잭팟 충전 (런 간 영구 — 상자를 열 때마다 조금씩, 엘리트/보스는 크게)
  if (typeof META !== 'undefined' && !e.golden) {
    const boost = 1 + META.buff('jackpotBoost') * 0.15;
    const gain = (e.boss ? 4.5 : e.elite ? 1.6 : 0.09) * boost;
    addJackpot(gain);
  }

  // 엘리트 분열 능력 사망
  if (e.splitOnDeath && !e.boss) {
    for (let i = 0; i < 2; i++) {
      const m2 = spawnEnemy(e.x + rand(-24, 24), e.y + rand(-24, 24), e.type, {});
      m2.hp = m2.maxHp = e.maxHp * 0.3;
      m2.dmg *= 0.7; m2.r *= 0.7; m2.xp = Math.ceil(e.xp * 0.15);
    }
  }
  // 분열 슬라임 → 꼬마 2마리 분열
  if (e.type === 'splitter') {
    for (let i = 0; i < 2; i++) {
      const m = spawnEnemy(e.x + rand(-20, 20), e.y + rand(-20, 20), 'splitling', {});
      m.hp = m.maxHp = Math.max(5, m.maxHp * 0.7);
    }
  }

  QUESTS.onKill(e);
  G.stats.kills++;
  addCombo();
  SFX.play('kill', e.x);
  if (e.elite) G.hitStop = Math.max(G.hitStop, 0.07); // 엘리트 킬 펀치

  // 🎰 킬 마일스톤 세레머니 (BIG/MEGA/EPIC WIN — 세션당 1회씩)
  if (G.stats.kills === 100 || G.stats.kills === 500 || G.stats.kills === 1000 || G.stats.kills === 2500 || G.stats.kills === 5000) {
    const k = G.stats.kills;
    if (k === 100) showBigWin('BIG WIN!', `💀 ${k.toLocaleString()} KILL`, '');
    else if (k === 500) showBigWin('MEGA WIN!', `💀 ${k.toLocaleString()} KILL`, 'tier-mega');
    else if (k === 1000) showBigWin('EPIC WIN!', `💀 ${k.toLocaleString()} KILL`, 'tier-epic');
    else if (k >= 2500) showBigWin('LEGENDARY!', `💀 ${k.toLocaleString()} KILL`, 'tier-epic');
    addJackpot(5); // 마일스톤 보너스 충전
    shakeCam(7);
    POST.triggerFlash(0.12);
    POST.triggerChroma(0.3);
    SFX.play(k >= 1000 ? 'bigwin' : 'jackpot');
  }

  // ✨ 골든 몹 사망 — 잭팟 젬 분수 + 하트 확정
  if (e.golden) {
    showBigWin('GOLDEN KILL!', '✨ 황금 몹 젬 분수!', 'tier-mega');
    SFX.play('jackpot');
    shakeCam(8);
    POST.triggerFlash(0.15);
    POST.triggerChroma(0.4);
    const n = randi(26, 34);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      G.pickups.push({ kind: 'gem', x: e.x, y: e.y, val: choice([3, 5, 5, 10]), t: Math.random() * TAU, vx: Math.cos(a) * rand(160, 420), vy: Math.sin(a) * rand(160, 420) });
    }
    G.pickups.push({ kind: 'heart', x: e.x + 24, y: e.y, val: 30, t: 0, vx: 0, vy: 0 });
    shardBurst(e.x, e.y, '#ffd23f', 30, 420, 8);
    G.explosions.push({ x: e.x, y: e.y, r: 150, life: 0.5, maxLife: 0.5, color: '#ffd23f', thin: true });
  }

  // 시네마틱 사망: 파편 파열 + 영혼 잔상 + 충격파
  shardBurst(e.x, e.y, darken(e.color, 0.75), e.boss ? 42 : (e.elite ? 22 : 9), e.boss ? 460 : 300, e.boss ? 9 : 6);
  shardBurst(e.x, e.y, '#1a1e2e', e.boss ? 20 : 8, 200, 5);
  // 영혼 잔상 (위로 떠오르는 연기)
  const wisps = e.boss ? 7 : (e.elite ? 4 : 2);
  for (let i = 0; i < wisps; i++) {
    G.particles.push({
      x: e.x + rand(-e.r / 2, e.r / 2), y: e.y + rand(-e.r / 2, 0),
      vx: rand(-16, 16), vy: rand(-90, -40),
      life: rand(0.6, 1.1), maxLife: 1.1, size: rand(5, e.boss ? 16 : 9),
      color: darken(e.color, 0.4), grav: -30, shape: 'wisp',
    });
  }
  // 발광 플래시
  G.particles.push({ x: e.x, y: e.y, vx: 0, vy: 0, life: 0.18, maxLife: 0.18, size: e.r * (e.boss ? 3.4 : 2.2), color: e.color, grav: 0, shape: 'glow' });
  // 충격파 링
  if (e.elite || e.boss) {
    G.explosions.push({ x: e.x, y: e.y, r: e.r * (e.boss ? 5 : 3), life: 0.35, maxLife: 0.35, color: e.color, thin: true });
    if (e.boss) {
      zoomPunchCam(0.05);
      POST.triggerFlash(0.24);
      POST.triggerChroma(0.55);
      POST.triggerShock(e.x, e.y, 1.0);
    } else {
      zoomPunchCam(0.018);
      POST.triggerFlash(0.09);
      POST.triggerShock(e.x, e.y, 0.35);
    }
  }

  // 젬 드롭
  const gemVal = e.boss ? 50 : e.xp;
  let gemCount = Math.round((e.boss ? 6 : 1) * finalDropMult());
  // 광산 도적: 젬 자루 터뜨리며 사망!
  if (e.type === 'thief') {
    gemCount = randi(10, 16);
    showBanner('💰 도적 사냥 성공! 젬 자루 획득!', '#ffd76a');
    SFX.play('chest');
    POST.triggerFlash(0.06);
  }
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

  // 상자 드롭 (심층부 보너스)
  const chestP = e.boss ? 1 : (e.elite ? 0.22 + luck * 0.02 + Math.min(G.depth || 0, 10) * 0.01 : 0);
  if (Math.random() < chestP) {
    G.pickups.push({ kind: 'chest', x: e.x, y: e.y - 10, val: e.boss ? 5 : 3, t: 0, vx: 0, vy: 0 });
    showBanner(e.boss ? '💎 보물 상자 등장!' : '💎 상자 드롭!', '#ffd23f');
  } else if (e.elite) {
    // 🎰 pity 시스템: 엘리트가 상자를 안 떨꾼 횟수 카운트 → 3연속 없으면 확정 (보상 바닥)
    G.pityChest = (G.pityChest || 0) + 1;
    if (G.pityChest >= 3) {
      G.pityChest = 0;
      G.pickups.push({ kind: 'chest', x: e.x, y: e.y - 10, val: 3, t: 0, vx: 0, vy: 0 });
      showBanner('🎁 보상 포인트 적립! 상자 확정 드롭', '#ffd23f');
    }
  } else if (chestP > 0) {
    G.pityChest = 0; // 드랍 성공 시 리셋
  }

  // 젬 수 상한 병합 (kind 불변: 젬은 젬끼리만 합친다 — 하트/상자 오염 방지)
  if (G.pickups.length > 380) {
    let merged = 0;
    const gems = G.pickups.filter(pk => pk.kind === 'gem');
    for (let gi = gems.length - 1; gi >= 0 && merged < 60; gi--) {
      const p = gems[gi];
      const idx = G.pickups.indexOf(p);
      if (idx < 0) continue;
      G.pickups.splice(idx, 1);
      const tgt = gems[(Math.random() * gems.length) | 0];
      if (tgt && tgt !== p && G.pickups.includes(tgt)) tgt.val += p.val;
      else G.pickups.push(p); // 대상이 이미 제거됐으면 되돌려 유실 방지
      merged++;
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
      if (p.iFrames <= 0) { hurtPlayer(b.dmg, b.x, b.y); p.iFrames = 0.4; }
      G.eProjectiles.splice(i, 1);
    }
  }
}

/* 색 보정 유틸 */
function darken(hex, f) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${(r * f) | 0},${(g * f) | 0},${(b * f) | 0})`;
}

/* 위협적인 빛나는 사안 (귀여운 눈 대체) */
function drawMenaceEyes(ctx, x, y, r, glowColor, dirX) {
  const ex = clamp(dirX * 0.2, -0.35, 0.35) * r;
  const eyeW = r * 0.3, eyeH = r * 0.1;
  // 발광
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  Glow.draw(ctx, glowColor, x - r * 0.34 + ex, y - r * 0.1, r * 0.32, 0.5);
  Glow.draw(ctx, glowColor, x + r * 0.34 + ex, y - r * 0.1, r * 0.32, 0.5);
  ctx.restore();
  // 사선 눈매
  ctx.fillStyle = glowColor;
  ctx.save();
  ctx.translate(x - r * 0.34 + ex, y - r * 0.1); ctx.rotate(0.28);
  ctx.fillRect(-eyeW / 2, -eyeH / 2, eyeW, eyeH);
  ctx.restore();
  ctx.save();
  ctx.translate(x + r * 0.34 + ex, y - r * 0.1); ctx.rotate(-0.28);
  ctx.fillRect(-eyeW / 2, -eyeH / 2, eyeW, eyeH);
  ctx.restore();
}

/* 적 발광 프리패스 — render()가 'lighter' 단일 블럭으로 일괄 호출.
 * 적마다 lighter→source-over를 왕복하던 파이프라인 플러시를 N회→1회로 제거.
 * 호출 전 컬링·가시 플래그(e._vis) 판정은 호출부에서 수행. */
function drawEnemyGlow(ctx, e) {
  if (e.spawnT > 0) {
    const t = 1 - e.spawnT / 0.5;
    Glow.draw(ctx, e.color, e.x, e.y + e.r * 0.5, e.r * 1.5 * (1 - t * 0.4), 0.35 * (1 - t));
  }
  // ✨ 골든 몹: 시선을 강제로 붙잡는 황금 광휘
  if (e.golden) {
    const pulse = 0.5 + Math.sin(e.wobble * 2) * 0.18;
    Glow.draw(ctx, '#ffd23f', e.x, e.y, e.r * 3.4, pulse);
    Glow.draw(ctx, '#fff3c4', e.x, e.y - e.r * 0.4, e.r * 1.6, pulse * 0.7);
    return;
  }
  if (e.elite || e.boss) {
    Glow.draw(ctx, e.boss ? '#ff2d4e' : '#ffaa2d', e.x, e.y, e.r * 2.1, 0.4 + Math.sin(e.wobble * 1.4) * 0.12);
  } else {
    Glow.draw(ctx, e.color, e.x, e.y, e.r * 1.7, 0.16);
  }
}

function drawEnemy(ctx, e) {
  const p = G.player;
  const dx = p.x - e.x;
  const squash = 1 + Math.sin(e.wobble) * 0.06;
  const spawning = e.spawnT > 0;
  const spawnScale = spawning ? 1 - e.spawnT * 1.6 : 1;
  const bodyCol = e.flash > 0.4 ? '#e8ecf4' : darken(e.color, e.boss ? 0.62 : 0.5);
  const glowCol = e.color;

  ctx.save();
  ctx.translate(e.x, e.y);

  // 스폰 포탈: 어둠에서 솟아오르는 연출 (발광은 프리패스에서 처리)
  if (spawning) {
    const t = 1 - e.spawnT / 0.5; // 0→1
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = glowCol;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(0, e.r * 0.7, e.r * (1.7 - t * 0.7), e.r * (0.55 - t * 0.2), 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.scale(spawnScale, spawnScale);
  }

  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  ctx.beginPath(); ctx.ellipse(0, e.r * 0.8, e.r * 0.85, e.r * 0.3, 0, 0, TAU); ctx.fill();

  // 엘리트/보스 오라 링 (발광은 프리패스에서 처리)
  if (e.elite || e.boss) {
    ctx.strokeStyle = e.boss ? 'rgba(255,45,78,0.75)' : 'rgba(255,170,45,0.8)';
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 0, e.r + 6 + Math.sin(e.wobble * 1.4) * 2, 0, TAU); ctx.stroke();
  }

  // ✨ 골든 몹: 황금 궤도 스파클 + 별표식
  if (e.golden) {
    ctx.strokeStyle = `rgba(255,210,63,${0.75 + Math.sin(e.wobble * 2.6) * 0.25})`;
    ctx.lineWidth = 2.6;
    ctx.setLineDash([6, 7]);
    ctx.lineDashOffset = -e.wobble * 30;
    ctx.beginPath(); ctx.arc(0, 0, e.r + 9 + Math.sin(e.wobble * 1.4) * 3, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, '#ffd23f', 0, -e.r - 14 + Math.sin(e.wobble) * 3, 10, 0.6);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffd23f';
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', 0, -e.r - 9 + Math.sin(e.wobble) * 3);
    ctx.textAlign = '';
  }

  ctx.scale(1 / squash, squash);
  const r = e.r;
  const body = bodyCol;

  // 몸통 림 스트로크
  ctx.strokeStyle = glowCol;
  ctx.lineWidth = e.boss ? 3 : 1.8;

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
      drawMenaceEyes(ctx, 0, -r * 0.1, r, glowCol, dx);
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
      drawMenaceEyes(ctx, 0, r * 0.15, r, glowCol, dx);
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
      drawMenaceEyes(ctx, 0, 0, r * 0.75, glowCol, dx);
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
      drawMenaceEyes(ctx, r * 0.2, 0, r * 0.7, glowCol, dx);
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
      drawMenaceEyes(ctx, 0, -r * 0.45, r * 0.85, glowCol, dx);
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
      drawMenaceEyes(ctx, r * 0.7, -r * 0.2, r * 0.45, glowCol, dx);
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
      drawMenaceEyes(ctx, 0, -r * 0.15, r * 0.8, glowCol, dx);
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
      drawMenaceEyes(ctx, 0, -r * 0.3, r * 0.6, glowCol, dx);
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
      drawMenaceEyes(ctx, 0, -r * 0.15, r * 0.75, glowCol, dx);
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
      drawMenaceEyes(ctx, 0, 0, r * 0.8, glowCol, dx);
      break;
    }
    case 'charger': {
      // 조준 중엔 빨갛게 부풀어 오름
      const tele = e.chargeState === 'telegraph';
      ctx.fillStyle = e.flash > 0.4 ? '#fff' : (tele ? '#ff2d2d' : body);
      if (tele) {
        ctx.save();
        ctx.scale(1 + Math.sin(e.wobble * 8) * 0.12, 1 + Math.cos(e.wobble * 8) * 0.12);
        ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, TAU); ctx.fill();
        ctx.restore();
        // 경고 마커
        ctx.strokeStyle = 'rgba(255,45,45,0.85)'; ctx.lineWidth = 2.4;
        ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.arc(0, 0, r + 9, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // 뿔 달린 진영형
        ctx.beginPath();
        ctx.moveTo(-r * 0.9, r * 0.5); ctx.lineTo(-r * 0.55, -r * 0.75); ctx.lineTo(0, -r * 0.95);
        ctx.lineTo(r * 0.55, -r * 0.75); ctx.lineTo(r * 0.9, r * 0.5); ctx.lineTo(0, r * 0.75);
        ctx.closePath(); ctx.fill();
        // 뿔
        ctx.fillStyle = '#ffe3b3';
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.6); ctx.lineTo(-r * 0.9, -r * 1.25); ctx.lineTo(-r * 0.15, -r * 0.8);
        ctx.moveTo(r * 0.5, -r * 0.6); ctx.lineTo(r * 0.9, -r * 1.25); ctx.lineTo(r * 0.15, -r * 0.8);
        ctx.fill();
      }
      drawMenaceEyes(ctx, 0, -r * 0.15, r * 0.85, glowCol, dx);
      break;
    }
    case 'spitter': {
      // 식물형 뱉는놈
      ctx.fillStyle = '#3a7d2c';
      ctx.fillRect(-r * 0.14, -r * 0.1, r * 0.28, r * 0.85);
      const open = e.shootCd !== undefined && e.shootCd < 0.35 ? 1 : 0;
      ctx.fillStyle = e.flash > 0.4 ? '#fff' : body;
      ctx.beginPath(); ctx.arc(0, -r * 0.35, r * 0.78, 0, TAU); ctx.fill();
      // 입 (쏘기 직전 벌어짐)
      ctx.fillStyle = '#1d4a14';
      ctx.beginPath();
      ctx.arc(0, -r * 0.35, r * (0.3 + open * 0.22), 0, TAU); ctx.fill();
      // 잎
      ctx.fillStyle = '#4f9e3a';
      ctx.beginPath(); ctx.ellipse(-r * 0.75, -r * 0.9, r * 0.3, r * 0.14, -0.7, 0, TAU); ctx.fill();
      drawMenaceEyes(ctx, 0, -r * 0.55, r * 0.78, glowCol, dx);
      break;
    }
    case 'splitter': case 'splitling': {
      // 두 동강 날 것 같은 슬라임 (중앙 접힘선)
      ctx.fillStyle = e.flash > 0.4 ? '#fff' : body;
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.62);
      ctx.quadraticCurveTo(-r * 1.05, -r * 1.05, -r * 0.12, -r * 0.98);
      ctx.lineTo(r * 0.12, -r * 0.98);
      ctx.quadraticCurveTo(r * 1.05, -r * 1.05, r, r * 0.62);
      ctx.quadraticCurveTo(0, r * 0.95, -r, r * 0.62);
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,80,50,0.55)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -r * 0.95); ctx.lineTo(0, r * 0.7); ctx.stroke();
      drawMenaceEyes(ctx, 0, -r * 0.1, r, glowCol, dx);
      break;
    }
    case 'thief': {
      // 후드 쓴 도적 + 젬 자루 (도주 자세로 기울어짐)
      const lean = clamp(-dx * 0.004, -0.3, 0.3);
      ctx.save();
      ctx.rotate(lean);
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.beginPath(); ctx.ellipse(0, e.r * 0.8, e.r * 0.8, e.r * 0.3, 0, 0, TAU); ctx.fill();
      // 몸통
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.7, e.r * 0.55); ctx.lineTo(-e.r * 0.85, -e.r * 0.4);
      ctx.lineTo(0, -e.r * 0.95); ctx.lineTo(e.r * 0.85, -e.r * 0.4); ctx.lineTo(e.r * 0.7, e.r * 0.55);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = glowCol; ctx.lineWidth = 1.6; ctx.stroke();
      // 후드
      ctx.fillStyle = darken(e.color, 0.35);
      ctx.beginPath(); ctx.arc(0, -e.r * 0.55, e.r * 0.5, Math.PI * 0.9, Math.PI * 2.1); ctx.fill();
      // 젬 자루 (등에 매고 도망)
      ctx.fillStyle = '#6e4a1e';
      MapGen.rr(ctx, e.r * 0.5, -e.r * 0.3, e.r * 0.7, e.r * 0.9, 3); ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(e.r * 0.85, e.r * 0.15, 2.2, 0, TAU); ctx.fill();
      ctx.restore();
      drawMenaceEyes(ctx, 0, -e.r * 0.5, e.r * 0.9, glowCol, dx);
      break;
    }
    case 'bomber': {
      const fused = e.fuseT !== undefined;
      const flashRate = fused ? Math.sin(G.time * 30) > 0 : false;
      const flap = Math.sin(e.wobble * 3);
      ctx.fillStyle = e.flash > 0.4 ? '#fff' : (flashRate ? '#ffffff' : body);
      // 날개
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.4, 0); ctx.lineTo(-e.r * 1.8, -flap * e.r * 0.9 - e.r * 0.2); ctx.lineTo(-e.r * 0.5, e.r * 0.4);
      ctx.moveTo(e.r * 0.4, 0); ctx.lineTo(e.r * 1.8, -flap * e.r * 0.9 - e.r * 0.2); ctx.lineTo(e.r * 0.5, e.r * 0.4);
      ctx.fill();
      // 둥근 폭탄 몸통
      ctx.beginPath(); ctx.arc(0, 0, e.r * 0.85, 0, TAU); ctx.fill();
      ctx.strokeStyle = fused ? '#ff3b2d' : glowCol;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (fused) {
        ctx.globalCompositeOperation = 'lighter';
        Glow.draw(ctx, '#ff3b2d', 0, 0, e.r * 2.4, 0.5 + flashRate * 0.3);
        ctx.globalCompositeOperation = 'source-over';
      }
      drawMenaceEyes(ctx, 0, -e.r * 0.1, e.r * 0.85, glowCol, dx);
      break;
    }
    default: {
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, TAU); ctx.fill();
      drawMenaceEyes(ctx, 0, 0, r * 0.85, glowCol, dx);
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
  ctx.fillStyle = '#6e5a20';
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
  ctx.strokeStyle = '#b3923a'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = '#ff3b3b';
  ctx.beginPath(); ctx.arc(x, y - s * 0.45, s * 0.14, 0, TAU); ctx.fill();
}

/* ============================================================
 * 지형 위험물/기믹: 탄력 버섯 · 폭발성 결정 · 간헐천
 * ============================================================ */

function queryVolatiles(x, y, r) {
  const out = [];
  for (const v of G.volatiles) {
    if (dist2(v.x, v.y, x, y) <= (r + v.r) * (r + v.r)) out.push(v);
  }
  return out;
}

function spawnMaintainHazards(dt) {
  const p = G.player;
  const m = G.minute;
  G.hazardT -= dt;
  if (G.hazardT > 0) return;
  G.hazardT = 7;

  const spot = (minDist, maxDist, biomes) => {
    for (let t = 0; t < 10; t++) {
      const a = Math.random() * TAU, d = rand(minDist, maxDist);
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      const b = MapGen.biome(Math.floor(x / TILE), Math.floor(y / TILE));
      if (biomes.includes(b) && !MapGen.featureFor(b, Math.floor(x / TILE), Math.floor(y / TILE))) return { x, y };
    }
    return null;
  };

  // 탄력 버섯: 밟으면 플레이어가 발사된다!
  if (G.bouncers.filter(b => dist2(b.x, b.y, p.x, p.y) < 1100 * 1100).length < 2) {
    const s = spot(350, 800, [B_GRASS, B_FOREST, B_SNOW]);
    if (s) G.bouncers.push({ x: s.x, y: s.y, r: 30, squash: 0, t: Math.random() * TAU });
  }
  // 폭발성 결정: 건드리면 연쇄 폭발 (무기로 터뜨릴 수 있음)
  if (G.volatiles.filter(b => dist2(b.x, b.y, p.x, p.y) < 1100 * 1100).length < 2) {
    const s = spot(350, 850, [B_VOLCANIC, B_CRYSTAL, B_ROCK, B_DESERT]);
    if (s) G.volatiles.push({ x: s.x, y: s.y, r: 26, hp: 1, fuse: 0, armed: true, t: Math.random() * TAU });
  }
  // 간헐천 (2분 이후): 주기적으로 분출하는 화염 기둥
  if (m > 2 && G.geysers.filter(b => dist2(b.x, b.y, p.x, p.y) < 1400 * 1400).length < 2) {
    const s = spot(400, 950, [B_VOLCANIC]);
    if (s) G.geysers.push({ x: s.x, y: s.y, r: 52, state: 'idle', t: rand(1.5, 3) });
  }
  // 멀어진 하자드 정리
  for (const arr of [G.bouncers, G.volatiles, G.geysers]) {
    for (let i = arr.length - 1; i >= 0; i--) {
      if (dist2(arr[i].x, arr[i].y, p.x, p.y) > 2600 * 2600) arr.splice(i, 1);
    }
  }
}

function detonateVolatile(v) {
  if (v.dead) return;
  v.dead = true;
  const idx = G.volatiles.indexOf(v);
  if (idx >= 0) G.volatiles.splice(idx, 1);

  SFX.play('boom', v.x);
  kickCam(v.x - G.player.x, v.y - G.player.y, 6);
  zoomPunchCam(0.02);
  POST.triggerChroma(0.3);
  POST.triggerFlash(0.07);
  POST.triggerShock(v.x, v.y, 0.55);

  // 광역 폭발: 적에게도 피해 (무기화!)
  G.explosions.push({ x: v.x, y: v.y, r: 240, life: 0.4, maxLife: 0.4, color: '#ff7a2d' });
  for (const e of queryEnemies(v.x, v.y, 150)) damageEnemy(e, 90, true, null);
  for (const c of queryCrystals(v.x, v.y, 150)) damageCrystal(c, 60);
  const pd = dist2(v.x, v.y, G.player.x, G.player.y);
  if (pd < 150 * 150 && G.player.iFrames <= 0) {
    hurtPlayer(22, v.x, v.y);
    G.player.iFrames = 0.6;
  }
  // 연쇄!
  for (const o of G.volatiles) {
    if (!o.dead && !o.fuse && dist2(o.x, o.y, v.x, v.y) < 290 * 290) o.fuse = 0.14;
  }
  shardBurst(v.x, v.y, '#ff7a2d', 22, 420, 6);
  shardBurst(v.x, v.y, '#8a2f1c', 12, 300, 5);
  G.particles.push({ x: v.x, y: v.y, vx: 0, vy: 0, life: 0.2, maxLife: 0.2, size: 70, color: '#ffb060', grav: 0, shape: 'glow' });
  // 소량 젬
  for (let i = 0; i < randi(3, 5); i++) {
    const a = Math.random() * TAU;
    G.pickups.push({ kind: 'gem', x: v.x, y: v.y, val: 1, t: Math.random() * TAU, vx: Math.cos(a) * rand(80, 200), vy: Math.sin(a) * rand(80, 200) });
  }
}

function launchBouncer(b) {
  const p = G.player;
  b.squash = 1;
  const a = Math.atan2(p.faceY, p.faceX) || 0;
  p.vel.x = Math.cos(a) * 980;
  p.vel.y = Math.sin(a) * 980;
  SFX.play('rush');
  SFX.play('dash');
  zoomPunchCam(0.03);
  POST.triggerChroma(0.35);
  shakeCam(3);
  showBanner('🚀 발사!', '#4de3ff');
  for (let i = 0; i < 26; i++) {
    const a2 = (i / 26) * TAU;
    G.particles.push({ x: b.x, y: b.y, vx: Math.cos(a2) * rand(120, 380), vy: Math.sin(a2) * rand(120, 380), life: rand(0.3, 0.6), maxLife: 0.6, size: rand(2, 5), color: choice(['#4de3ff', '#a8f0ff', '#ffffff']), grav: 0, shape: 'spark' });
  }
  G.explosions.push({ x: b.x, y: b.y, r: 120, life: 0.3, maxLife: 0.3, color: '#4de3ff', thin: true });
}

function updateHazards(dt) {
  const p = G.player;

  // 탄력 버섯
  for (const b of G.bouncers) {
    b.t += dt * 3;
    b.squash = Math.max(0, b.squash - dt * 2.4);
    if (dist2(b.x, b.y, p.x, p.y) < (b.r + p.r) * (b.r + p.r) && b.squash <= 0.05) {
      launchBouncer(b);
    }
  }

  // 폭발성 결정
  for (let i = G.volatiles.length - 1; i >= 0; i--) {
    const v = G.volatiles[i];
    v.t += dt * 4;
    if (v.fuse > 0) {
      v.fuse -= dt;
      if (v.fuse <= 0) detonateVolatile(v);
      continue;
    }
    if (v.armed && dist2(v.x, v.y, p.x, p.y) < (v.r + p.r) * (v.r + p.r)) {
      v.fuse = 0.1; // 접촉 → 아주 짧은 예고 후 폭발
    }
  }

  // 간헐천: 예고 → 분출
  for (const gh of G.geysers) {
    gh.t -= dt;
    if (gh.state === 'idle') {
      // 분출 예고 파티클
      if (Math.random() < dt * 8) {
        G.particles.push({ x: gh.x + rand(-14, 14), y: gh.y, vx: rand(-10, 10), vy: rand(-60, -30), life: 0.4, maxLife: 0.4, size: rand(2, 4), color: 'rgba(255,140,60,0.5)', grav: -40, shape: 'wisp' });
      }
      if (gh.t <= 0) { gh.state = 'warn'; gh.t = 0.7; SFX.play('charge', gh.x); }
    } else if (gh.state === 'warn') {
      if (Math.random() < dt * 30) {
        G.particles.push({ x: gh.x + rand(-16, 16), y: gh.y, vx: rand(-14, 14), vy: rand(-110, -60), life: 0.35, maxLife: 0.35, size: rand(2, 5), color: '#ff8a3d', grav: 0 });
      }
      if (gh.t <= 0) { gh.state = 'erupt'; gh.t = 0.85; SFX.play('boom', gh.x); kickCam(gh.x - p.x, gh.y - p.y, 5); }
    } else if (gh.state === 'erupt') {
      // 화염 기둥 파티클
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * TAU;
        G.particles.push({ x: gh.x + Math.cos(a) * rand(0, gh.r * 0.5), y: gh.y, vx: Math.cos(a) * rand(20, 60), vy: rand(-460, -260), life: rand(0.3, 0.55), maxLife: 0.55, size: rand(3, 7), color: choice(['#ff8a3d', '#ffd23f', '#ff5a1f']), grav: 320 });
      }
      // 판정
      if (dist2(gh.x, gh.y, p.x, p.y) < (gh.r + p.r) * (gh.r + p.r) && p.iFrames <= 0) {
        hurtPlayer(24 + G.minute, gh.x, gh.y);
        p.iFrames = 0.6;
      }
      if (gh.t <= 0) { gh.state = 'idle'; gh.t = rand(2.4, 3.6); }
    }
  }
}

function drawHazards(ctx) {
  const [hL, hT, hR, hB] = viewRect(0);
  // 탄력 버섯
  for (const b of G.bouncers) {
    if (b.x < hL - 60 || b.x > hR + 60 || b.y < hT - 60 || b.y > hB + 60) continue;
    const sq = 1 - b.squash * 0.45;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 12, 22, 7, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, '#2ee6d8', 0, -8, 44, 0.5 + b.squash * 0.4);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#1d4a52';
    ctx.fillRect(-6, -6, 12, 16);
    ctx.fillStyle = '#2ee6d8';
    ctx.beginPath();
    ctx.ellipse(0, -12 * sq, 24, 13 * sq, 0, Math.PI, 0);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(220,255,255,0.7)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.ellipse(-8, -16 * sq, 6, 3, -0.3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // 폭발성 결정 (위험 예고로 붉게 맥동)
  for (const v of G.volatiles) {
    if (v.x < hL - 70 || v.x > hR + 70 || v.y < hT - 70 || v.y > hB + 70) continue;
    const armed = v.fuse > 0;
    const pulse = armed ? 1 + Math.sin(v.t * 8) * 0.3 : 1 + Math.sin(v.t) * 0.1;
    ctx.save();
    ctx.translate(v.x, v.y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 10, 18, 6, 0, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, armed ? '#ff3b2d' : '#ff7a2d', 0, -6, 40 * pulse, 0.55);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = armed ? '#ff4d33' : '#c94a1d';
    ctx.beginPath();
    ctx.moveTo(0, -30 * pulse); ctx.lineTo(-13, -6); ctx.lineTo(-5, 8); ctx.lineTo(6, 8); ctx.lineTo(12, -10);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#ffb060';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,220,180,0.55)';
    ctx.beginPath(); ctx.moveTo(0, -28 * pulse); ctx.lineTo(-5, -8); ctx.lineTo(-1, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // 간헐천
  for (const gh of G.geysers) {
    if (gh.x < hL - 260 || gh.x > hR + 260 || gh.y < hT - 260 || gh.y > hB + 260) continue;
    ctx.save();
    ctx.translate(gh.x, gh.y);
    // 분출구
    ctx.fillStyle = '#1a0f0a';
    ctx.beginPath(); ctx.ellipse(0, 4, gh.r * 0.7, gh.r * 0.28, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ff7a2d';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, 4, gh.r * 0.7, gh.r * 0.28, 0, 0, TAU); ctx.stroke();
    if (gh.state === 'warn') {
      // 예고: 솟아오르는 발광
      const w = 1 - gh.t / 0.7;
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, '#ff8a3d', 0, -10, gh.r * (0.5 + w), 0.35 + w * 0.4);
      ctx.globalCompositeOperation = 'source-over';
    } else if (gh.state === 'erupt') {
      // 화염 기둥
      ctx.globalCompositeOperation = 'lighter';
      const hgt = 190 * Math.sin((1 - gh.t / 0.85) * Math.PI);
      const grad = ctx.createLinearGradient(0, 0, 0, -hgt);
      grad.addColorStop(0, 'rgba(255,230,120,0.95)');
      grad.addColorStop(0.5, 'rgba(255,120,40,0.8)');
      grad.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-gh.r * 0.55, 0);
      ctx.quadraticCurveTo(-gh.r * 0.3, -hgt * 0.6, 0, -hgt);
      ctx.quadraticCurveTo(gh.r * 0.3, -hgt * 0.6, gh.r * 0.55, 0);
      ctx.closePath(); ctx.fill();
      Glow.draw(ctx, '#ff7a2d', 0, -hgt * 0.4, gh.r * 2.2, 0.7);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }
}

/* ============================================================
 * 도파민 결정 클러스터 — 파괴하면 젬 분수!
 * ============================================================ */

function queryCrystals(x, y, r) {
  const out = [];
  const r2 = r * r;
  for (const c of G.crystals) {
    if (dist2(c.x, c.y, x, y) <= (r + c.r) * (r + c.r)) out.push(c);
  }
  return out;
}

function damageCrystal(c, dmg) {
  c.hp -= dmg;
  c.flash = 1;
  SFX.play('crystalhit');
  spawnDmgText(c.x + rand(-12, 12), c.y - 20, Math.round(dmg), false);
  if (c.hp <= 0) shatterCrystal(c);
}

function shatterCrystal(c) {
  const idx = G.crystals.indexOf(c);
  if (idx < 0) return;
  G.crystals.splice(idx, 1);
  QUESTS.onCrystal();
  SFX.play('crystal', c.x);
  kickCam(c.x - G.player.x, c.y - G.player.y, 5);
  showBanner('💠 도파민 결정 파괴!', `hsl(${c.hue},100%,70%)`);

  // 젬 분수!
  const n = randi(16, 24);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    G.pickups.push({
      kind: 'gem', x: c.x, y: c.y,
      val: choice([1, 1, 2, 3]), t: Math.random() * TAU,
      vx: Math.cos(a) * rand(120, 320), vy: Math.sin(a) * rand(120, 320),
    });
  }
  if (Math.random() < 0.25) {
    G.pickups.push({ kind: 'magnet', x: c.x, y: c.y - 6, val: 0, t: 0, vx: 0, vy: 0 });
  }
  if (Math.random() < 0.06) {
    G.pickups.push({ kind: 'chest', x: c.x, y: c.y - 10, val: 3, t: 0, vx: 0, vy: 0 });
  }
  // 유리 파편 + 발광 파열
  shardBurst(c.x, c.y, `hsl(${c.hue},80%,55%)`, 34, 430, 7);
  shardBurst(c.x, c.y, `hsl(${c.hue},60%,30%)`, 16, 260, 6);
  G.particles.push({ x: c.x, y: c.y, vx: 0, vy: 0, life: 0.22, maxLife: 0.22, size: 64, color: `hsl(${c.hue},100%,70%)`, grav: 0, shape: 'glow' });
  G.explosions.push({ x: c.x, y: c.y, r: 90, life: 0.32, maxLife: 0.32, color: `hsl(${c.hue},100%,65%)`, thin: true });
}

function updateCrystals(dt) {
  for (let i = G.crystals.length - 1; i >= 0; i--) {
    const c = G.crystals[i];
    c.flash = Math.max(0, c.flash - dt * 5);
    c.wobble += dt * 2;
    // 너무 멀면 제거
    if (dist2(c.x, c.y, G.player.x, G.player.y) > 2400 * 2400) G.crystals.splice(i, 1);
  }
}

function drawCrystal(ctx, c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  // 바닥 발광
  const pulse = 1 + Math.sin(c.wobble) * 0.12;
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 52 * pulse);
  glow.addColorStop(0, `hsla(${c.hue},100%,70%,0.5)`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, 52 * pulse, 0, TAU); ctx.fill();
  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(0, 10, 24, 8, 0, 0, TAU); ctx.fill();
  // 결정 조각들
  for (const sh of c.shards) {
    ctx.save();
    ctx.translate(sh.ox, sh.oy);
    ctx.rotate(sh.tilt + Math.sin(c.wobble + sh.ox) * 0.05);
    ctx.scale(sh.s, sh.s);
    const grad = ctx.createLinearGradient(0, -34, 0, 8);
    if (c.flash > 0.3) {
      grad.addColorStop(0, '#ffffff'); grad.addColorStop(1, '#ffffff');
    } else {
      grad.addColorStop(0, `hsl(${c.hue},100%,82%)`);
      grad.addColorStop(1, `hsl(${c.hue},90%,48%)`);
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -34); ctx.lineTo(-11, -10); ctx.lineTo(-5, 8); ctx.lineTo(6, 8); ctx.lineTo(12, -12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(-5, -10); ctx.lineTo(-1, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // 체력바
  if (c.hp < c.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    MapGen.rr(ctx, c.x - 26, c.y - 44, 52, 6, 3); ctx.fill();
    ctx.fillStyle = `hsl(${c.hue},100%,65%)`;
    MapGen.rr(ctx, c.x - 25, c.y - 43, 50 * clamp(c.hp / c.maxHp, 0, 1), 4, 2); ctx.fill();
  }
}
