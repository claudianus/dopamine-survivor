'use strict';
/* ============================================================
 * 도파민 서바이버 - 무기 시스템 (7종, 각 5레벨)
 * ============================================================ */

const WEAPON_DEFS = {
  bolt: {
    name: '매직 볼트', emoji: '✨', color: '#35f0ff',
    desc: lv => `가장 가까운 적에게 유도 마탄 ${WLV.bolt.lvls[lv - 1].count}발 · 공격력 ${WLV.bolt.lvls[lv - 1].dmg}`,
    lvls: [
      { count: 2, dmg: 13, cd: 0.80 },
      { count: 3, dmg: 13, cd: 0.80 },
      { count: 3, dmg: 18, cd: 0.75 },
      { count: 4, dmg: 18, cd: 0.75 },
      { count: 5, dmg: 25, cd: 0.65 },
    ],
  },
  orbit: {
    name: '궤도 검', emoji: '🗡️', color: '#c9d1d9',
    desc: lv => `주위를 도는 검 ${WLV.orbit.lvls[lv - 1].count}자루 · 공격력 ${WLV.orbit.lvls[lv - 1].dmg}`,
    lvls: [
      { count: 1, dmg: 11, r: 88,  spd: 2.7 },
      { count: 2, dmg: 11, r: 92,  spd: 2.7 },
      { count: 2, dmg: 18, r: 100, spd: 3.2 },
      { count: 3, dmg: 18, r: 108, spd: 3.2 },
      { count: 4, dmg: 27, r: 118, spd: 3.8 },
    ],
  },
  lightning: {
    name: '번개', emoji: '⚡', color: '#ffe14d',
    desc: lv => `적 ${WLV.lightning.lvls[lv - 1].count}곳에 낙뢰 · 공격력 ${WLV.lightning.lvls[lv - 1].dmg}`,
    lvls: [
      { count: 1, dmg: 18, cd: 2.2, aoe: 55 },
      { count: 2, dmg: 18, cd: 2.2, aoe: 55 },
      { count: 2, dmg: 28, cd: 2.0, aoe: 70 },
      { count: 3, dmg: 28, cd: 1.8, aoe: 70 },
      { count: 4, dmg: 40, cd: 1.55, aoe: 85 },
    ],
  },
  aura: {
    name: '도파민 오라', emoji: '💫', color: '#ff5d8f',
    desc: lv => `주변 반경 지속 피해 · 공격력 ${WLV.aura.lvls[lv - 1].dmg}/틱 · 반경 ${WLV.aura.lvls[lv - 1].r}`,
    lvls: [
      { r: 100, dmg: 5,  tick: 0.45 },
      { r: 122, dmg: 7,  tick: 0.45 },
      { r: 146, dmg: 10, tick: 0.42 },
      { r: 170, dmg: 14, tick: 0.38 },
      { r: 198, dmg: 19, tick: 0.34 },
    ],
  },
  boomerang: {
    name: '부메랑', emoji: '🪃', color: '#ff9f1c',
    desc: lv => `관통 부메랑 ${WLV.boomerang.lvls[lv - 1].count}개 · 공격력 ${WLV.boomerang.lvls[lv - 1].dmg}`,
    lvls: [
      { count: 1, dmg: 13, cd: 1.8, range: 250, spd: 470 },
      { count: 2, dmg: 13, cd: 1.8, range: 250, spd: 470 },
      { count: 2, dmg: 21, cd: 1.7, range: 310, spd: 520 },
      { count: 3, dmg: 21, cd: 1.6, range: 310, spd: 560 },
      { count: 3, dmg: 32, cd: 1.4, range: 360, spd: 640 },
    ],
  },
  grenade: {
    name: '유탄 포', emoji: '💣', color: '#ff6b35',
    desc: lv => `폭발하는 유탄 ${WLV.grenade.lvls[lv - 1].count}개 · 공격력 ${WLV.grenade.lvls[lv - 1].dmg} (범위 ${WLV.grenade.lvls[lv - 1].aoe})`,
    lvls: [
      { count: 1, dmg: 28, cd: 3.0, aoe: 85 },
      { count: 1, dmg: 38, cd: 2.8, aoe: 95 },
      { count: 2, dmg: 38, cd: 2.8, aoe: 105 },
      { count: 2, dmg: 52, cd: 2.4, aoe: 120 },
      { count: 3, dmg: 66, cd: 2.2, aoe: 135 },
    ],
  },
  lance: {
    name: '레이저 창', emoji: '🔮', color: '#b388ff',
    desc: lv => `이동 방향 관통 레이저 · 공격력 ${WLV.lance.lvls[lv - 1].dmg}`,
    lvls: [
      { count: 1, dmg: 22, cd: 1.6, w: 24 },
      { count: 1, dmg: 32, cd: 1.5, w: 24 },
      { count: 1, dmg: 42, cd: 1.4, w: 34 },
      { count: 2, dmg: 42, cd: 1.4, w: 34 },
      { count: 2, dmg: 62, cd: 1.2, w: 44 },
    ],
  },
};
const WLV = WEAPON_DEFS; // desc 내부 참조용

/* 무기 진화: 만렙(5) 무기가 보물 상자에서 슈퍼 무기로! */
const EVOLUTIONS = {
  bolt: { name: '플루토늄 스타', emoji: '🌟', desc: '관통 + 폭발하는 무지개 마탄',
    mods: { count: 5, dmg: 42, cd: 0.62, pierce: 2, explode: 46 } },
  orbit: { name: '심연의 회전문', emoji: '⚔️', desc: '적을 빨아들이는 황금 검풍',
    mods: { count: 7, dmg: 46, r: 150, spd: 4.4, vacuum: true } },
  lightning: { name: '천벌', emoji: '🌩️', desc: '연쇄하는 심판의 뇌격',
    mods: { count: 6, dmg: 60, cd: 1.2, aoe: 110, chain: 3 } },
  aura: { name: '도파민 폭풍', emoji: '🌸', desc: '적을 밀어내는 무지개 성역',
    mods: { r: 250, dmg: 34, tick: 0.3, knock: true } },
  boomerang: { name: '차원 부메랑', emoji: '🌀', desc: '돌아올 때 잔영으로 분열',
    mods: { count: 4, dmg: 56, cd: 1.1, range: 430, spd: 760, split: true } },
  grenade: { name: '미니엄 포', emoji: '☄️', desc: '산탄 폭발하는 초대형 유탄',
    mods: { count: 4, dmg: 110, cd: 1.9, aoe: 165, cluster: 4 } },
  lance: { name: '프리즘 레이저', emoji: '🌈', desc: '8방위로 쏟아지는 관통 광선',
    mods: { count: 8, dmg: 92, cd: 1.15, w: 52, omni: true } },
};

/* 무기 실제 스탯 (진화 반영) */
function wstats(id, w) {
  const st = Object.assign({}, WEAPON_DEFS[id].lvls[w.lvl - 1]);
  if (w.evolved) Object.assign(st, EVOLUTIONS[id].mods);
  return st;
}

/* 무기 상태 초기화 (플레이어 시작 무기: 매직 볼트) */
function initWeapons() {
  G.weapons = { bolt: { lvl: 1, cd: 0 } };
  G.orbitAngle = 0;
  G.auraTick = 0;
  G.fx = { bolts: [] }; // 번개 시각 효과
}

function weaponDmgMult() { return (1 + G.passives.power * 0.12) * (G.rage && G.rage.active ? 2 : 1); }
function cooldownMult() { return Math.pow(0.93, G.passives.haste); }

function updateWeapons(dt) {
  const p = G.player;
  const dmgM = weaponDmgMult();
  const cdM = cooldownMult();
  G.orbitAngle += dt * 3;

  for (const id in G.weapons) {
    const w = G.weapons[id];
    const lv = wstats(id, w);
    w.cd -= dt;

    if (id === 'orbit' || id === 'aura') continue; // 상시 무기

    if (w.cd <= 0) {
      w.cd = (lv.cd || 1) * cdM;
      fireWeapon(id, lv, dmgM);
    }
  }

  /* 궤도 검: 상시 회전 + 접촉 피해 (+진화 시 흡인) */
  if (G.weapons.orbit) {
    const lv = wstats('orbit', G.weapons.orbit);
    // 진화: 적 흡인
    if (lv.vacuum) {
      for (const e of G.enemies) {
        const d = dist(e.x, e.y, p.x, p.y);
        if (d < lv.r + 60 && d > 20) {
          e.x += (p.x - e.x) / d * 95 * dt;
          e.y += (p.y - e.y) / d * 95 * dt;
        }
      }
    }
    for (let i = 0; i < lv.count; i++) {
      const a = G.orbitAngle * lv.spd / 3 + (i / lv.count) * TAU;
      const ox = p.x + Math.cos(a) * lv.r, oy = p.y + Math.sin(a) * lv.r;
      for (const e of queryEnemies(ox, oy, 24)) {
        const last = e.hitBy.get('orbit') || 0;
        if (G.time - last > 0.42) {
          e.hitBy.set('orbit', G.time);
          damageEnemy(e, lv.dmg * dmgM, true, a);
        }
      }
      for (const c of queryCrystals(ox, oy, 24)) {
        const last = c.hitOrbit || 0;
        if (G.time - last > 0.4) { c.hitOrbit = G.time; damageCrystal(c, lv.dmg * dmgM); }
      }
    }
  }

  /* 오라: 반경 내 틱 피해 */
  if (G.weapons.aura) {
    const lv = wstats('aura', G.weapons.aura);
    G.auraTick -= dt;
    if (G.auraTick <= 0) {
      G.auraTick = lv.tick;
      const targets = queryEnemies(p.x, p.y, lv.r);
      let hitAny = false;
      for (const e of targets) {
        damageEnemy(e, lv.dmg * dmgM, true, null);
        if (lv.knock) { // 진화: 밀어내기
          const d = dist(e.x, e.y, p.x, p.y) || 1;
          e.x += (e.x - p.x) / d * 16;
          e.y += (e.y - p.y) / d * 16;
          e.stun = Math.max(e.stun, 0.12);
        }
        hitAny = true;
      }
      for (const c of queryCrystals(p.x, p.y, lv.r)) {
        damageCrystal(c, lv.dmg * dmgM);
        hitAny = true;
      }
      if (hitAny) G.auraPulse = 1;
    }
  }
  G.auraPulse = Math.max(0, (G.auraPulse || 0) - dt * 2.4);
}

function fireWeapon(id, lv, dmgM) {
  const p = G.player;
  switch (id) {
    case 'bolt': {
      const used = new Set();
      for (let i = 0; i < lv.count; i++) {
        const t = nearestTarget(p.x, p.y, 650, used);
        if (!t) break;
        used.add(t);
        const a = ang(p.x, p.y, t.x, t.y) + rand(-0.06, 0.06);
        G.projectiles.push({
          kind: 'bolt', x: p.x, y: p.y,
          vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
          r: lv.explode ? 10 : 7, dmg: lv.dmg * dmgM, life: 1.6,
          target: t, color: WEAPON_DEFS.bolt.color,
          trail: [], pierce: lv.pierce || 0, explode: lv.explode || 0,
          hitSet: new Map(),
        });
      }
      if (used.size) SFX.play('shoot');
      break;
    }
    case 'lightning': {
      // 결정도 후보에 포함 (번개는 결정도 친다!)
      const cands = G.enemies.filter(e => dist2(e.x, e.y, p.x, p.y) < 380 * 380)
        .concat(G.crystals.filter(c => dist2(c.x, c.y, p.x, p.y) < 380 * 380).map(c => ({ crystal: c, x: c.x, y: c.y })));
      if (!cands.length) return;
      const chained = new Set();
      for (let i = 0; i < lv.count; i++) {
        const pick = cands[(Math.random() * cands.length) | 0];
        if (!pick) break;
        strikeLightning(pick.x, pick.y, lv, dmgM, chained);
      }
      break;
    }
    case 'boomerang': {
      for (let i = 0; i < lv.count; i++) {
        const t = nearestTarget(p.x, p.y, 700);
        const a = t ? ang(p.x, p.y, t.x, t.y) : Math.random() * TAU;
        G.projectiles.push({
          kind: 'boomerang', x: p.x, y: p.y,
          vx: Math.cos(a) * lv.spd, vy: Math.sin(a) * lv.spd,
          r: lv.split ? 17 : 14, dmg: lv.dmg * dmgM, life: 5,
          phase: 'out', dist: 0, range: lv.range, spd: lv.spd,
          spin: 0, hitSet: new Map(), color: WEAPON_DEFS.boomerang.color,
          split: lv.split || false, isMini: false,
        });
      }
      SFX.play('shoot');
      break;
    }
    case 'grenade': {
      const cands = G.enemies.filter(e => dist2(e.x, e.y, p.x, p.y) < 500 * 500);
      for (let i = 0; i < lv.count; i++) {
        let tx, ty;
        if (cands.length) {
          const t = cands[(Math.random() * cands.length) | 0];
          tx = t.x + rand(-30, 30); ty = t.y + rand(-30, 30);
        } else { const a = Math.random() * TAU; tx = p.x + Math.cos(a) * 200; ty = p.y + Math.sin(a) * 200; }
        const dur = 0.55;
        G.projectiles.push({
          kind: 'grenade', x: p.x, y: p.y,
          sx: p.x, sy: p.y, tx, ty, t: 0, dur,
          r: 10, dmg: lv.dmg * dmgM, life: dur + 0.05,
          aoe: lv.aoe, color: WEAPON_DEFS.grenade.color,
          cluster: lv.cluster || 0,
        });
      }
      break;
    }
    case 'lance': {
      const dirA = Math.atan2(p.faceY, p.faceX) || 0;
      const n = lv.count;
      for (let i = 0; i < n; i++) {
        // 진화(omni): 8방위 / 일반: 이동 방향 + 병렬
        const a = lv.omni ? (i / n) * TAU
          : dirA + (n > 1 ? (i === 0 ? 0 : (i === 1 ? 0.02 : -0.02)) : 0);
        const off = lv.omni ? 0 : (n > 1 ? (i === 0 ? -26 : 26) : 0);
        const px2 = lv.omni ? 0 : -Math.sin(dirA) * off;
        const py2 = lv.omni ? 0 : Math.cos(dirA) * off;
        G.projectiles.push({
          kind: 'lance', x: p.x + px2, y: p.y + py2,
          vx: Math.cos(a) * 950, vy: Math.sin(a) * 950,
          r: lv.w / 2, dmg: lv.dmg * dmgM, life: 0.62,
          w: lv.w, hitSet: new Map(), color: WEAPON_DEFS.lance.color,
        });
      }
      SFX.play('laser');
      break;
    }
  }
}

/* 번개 1회 낙하 (+진화 시 연쇄) */
function strikeLightning(x, y, lv, dmgM, chained) {
  G.fx.bolts.push({ x, y, life: 0.28, maxLife: 0.28 });
  SFX.play('thunder', x);
  kickCam(x - G.player.x, y - G.player.y, 3);
  sparkBurst(x, y, '#fff3b0', 8, 380);
  let hitSomething = false;
  for (const e of queryEnemies(x, y, lv.aoe)) {
    damageEnemy(e, lv.dmg * dmgM, true, null);
    e.stun = Math.max(e.stun, 0.25);
    hitSomething = true;
  }
  for (const c of queryCrystals(x, y, lv.aoe)) {
    damageCrystal(c, lv.dmg * dmgM);
    hitSomething = true;
  }
  if (hitSomething) {
    for (let k = 0; k < 8; k++) {
      const a2 = Math.random() * TAU;
      G.particles.push({ x, y, vx: Math.cos(a2) * rand(80, 220), vy: Math.sin(a2) * rand(80, 220) - 60, life: 0.35, maxLife: 0.35, size: 3, color: '#ffe14d', grav: 300 });
    }
  }
  // 진화: 연쇄 뇌격
  if (lv.chain && chained.size < lv.chain) {
    const next = nearestEnemy(x, y, 220, chained);
    if (next) {
      chained.add(next);
      G.fx.bolts.push({ x: next.x, y: next.y, life: 0.24, maxLife: 0.24 });
      damageEnemy(next, lv.dmg * 0.6 * dmgM, true, null);
    }
  }
}

/* 투사체 업데이트 */
function updateProjectiles(dt) {
  const p = G.player;
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const b = G.projectiles[i];
    b.life -= dt;

    if (b.kind === 'bolt') {
      // 경미한 유도 (적·결정 모두 추적)
      if (b.target && (G.enemies.includes(b.target) || G.crystals.includes(b.target))) {
        const cur = Math.atan2(b.vy, b.vx);
        const want = ang(b.x, b.y, b.target.x, b.target.y);
        let dA = want - cur;
        while (dA > Math.PI) dA -= TAU;
        while (dA < -Math.PI) dA += TAU;
        const na = cur + clamp(dA, -6 * dt, 6 * dt);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
      }
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > 6) b.trail.shift();
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.remaining === undefined) b.remaining = b.pierce || 0;
      let dead = false;
      for (const e of queryEnemies(b.x, b.y, b.r)) {
        const last = b.hitSet.get(e);
        if (last && G.time - last < 0.3) continue;
        b.hitSet.set(e, G.time);
        damageEnemy(e, b.dmg, true, Math.atan2(b.vy, b.vx));
        if (b.remaining-- <= 0) { dead = true; break; }
      }
      if (!dead) {
        for (const c of queryCrystals(b.x, b.y, b.r)) {
          damageCrystal(c, b.dmg);
          if (b.remaining-- <= 0) dead = true;
          break;
        }
      }
      if (dead || b.life <= 0) {
        G.projectiles.splice(i, 1);
        // 진화: 착탄 폭발
        if (b.explode && dead) {
          G.explosions.push({ x: b.x, y: b.y, r: b.explode * 1.4, life: 0.3, maxLife: 0.3, color: '#a5f3ff' });
          for (const e of queryEnemies(b.x, b.y, b.explode)) damageEnemy(e, b.dmg * 0.6, true, null);
          for (const c of queryCrystals(b.x, b.y, b.explode)) damageCrystal(c, b.dmg * 0.6);
          SFX.play('boom', b.x);
          sparkBurst(b.x, b.y, '#a5f3ff', 10, 420);
        }
        for (let k = 0; k < 4; k++) {
          const a = Math.random() * TAU;
          G.particles.push({ x: b.x, y: b.y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0.25, maxLife: 0.25, size: 2.5, color: b.color, grav: 0 });
        }
      }
    }
    else if (b.kind === 'boomerang') {
      b.spin += dt * 14;
      if (b.phase === 'out') {
        b.x += b.vx * dt; b.y += b.vy * dt;
        b.dist += b.spd * dt;
        if (b.dist >= b.range) {
          b.phase = 'back';
          // 진화: 돌아올 때 잔영 분열
          if (b.split && !b.isMini) {
            for (let k = 0; k < 2; k++) {
              const a = Math.random() * TAU;
              G.projectiles.push({
                kind: 'boomerang', x: b.x, y: b.y,
                vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
                r: 11, dmg: b.dmg * 0.5, life: 1.1,
                phase: 'out', dist: 0, range: 170, spd: 520,
                spin: 0, hitSet: new Map(), color: '#ffb0e0',
                isMini: true,
              });
            }
          }
        }
      } else {
        const a = ang(b.x, b.y, p.x, p.y);
        b.x += Math.cos(a) * b.spd * 1.15 * dt;
        b.y += Math.sin(a) * b.spd * 1.15 * dt;
        if (dist2(b.x, b.y, p.x, p.y) < 24 * 24) { G.projectiles.splice(i, 1); continue; }
      }
      const hits = queryEnemies(b.x, b.y, b.r);
      for (const e of hits) {
        if (b.hitSet.has(e) && G.time - b.hitSet.get(e) < 0.5) continue;
        b.hitSet.set(e, G.time);
        damageEnemy(e, b.dmg, true, Math.atan2(b.vy, b.vx));
      }
      for (const c of queryCrystals(b.x, b.y, b.r)) {
        if (b.hitCry === c && G.time - (b.hitCryT || 0) < 0.5) continue;
        b.hitCry = c; b.hitCryT = G.time;
        damageCrystal(c, b.dmg);
      }
      if (b.life <= 0) G.projectiles.splice(i, 1);
    }
    else if (b.kind === 'grenade') {
      b.t += dt;
      const t = clamp(b.t / b.dur, 0, 1);
      b.x = lerp(b.sx, b.tx, t);
      b.y = lerp(b.sy, b.ty, t) - Math.sin(t * Math.PI) * 90;
      if (t >= 1) {
        // 폭발!
        G.projectiles.splice(i, 1);
        SFX.play('boom', b.x);
        kickCam(b.x - p.x, b.y - p.y, 4);
        zoomPunchCam(0.015);
        shakeCam(3);
        G.explosions.push({ x: b.x, y: b.y, r: b.aoe * 1.4, life: 0.4, maxLife: 0.4, color: '#ff9a3d' });
        // 연기 기둥
        for (let k = 0; k < 5; k++) {
          G.particles.push({ x: b.x + rand(-14, 14), y: b.y, vx: rand(-20, 20), vy: rand(-70, -30), life: rand(0.5, 0.9), maxLife: 0.9, size: rand(8, 14), color: '#2a2d36', grav: -20, shape: 'wisp' });
        }
        for (const e of queryEnemies(b.x, b.y, b.aoe)) {
          damageEnemy(e, b.dmg, true, null);
        }
        for (const c of queryCrystals(b.x, b.y, b.aoe)) {
          damageCrystal(c, b.dmg);
        }
        // 진화: 산탄 폭발
        if (b.cluster) {
          for (let k = 0; k < b.cluster; k++) {
            const a = Math.random() * TAU, d = rand(55, 110);
            G.projectiles.push({
              kind: 'grenade', x: b.x, y: b.y,
              sx: b.x, sy: b.y, tx: b.x + Math.cos(a) * d, ty: b.y + Math.sin(a) * d,
              t: 0, dur: 0.35, r: 8, dmg: b.dmg * 0.55, life: 0.4,
              aoe: b.aoe * 0.62, color: '#ff9a3d', cluster: 0,
            });
          }
        }
        for (let k = 0; k < 22; k++) {
          const a = Math.random() * TAU;
          G.particles.push({ x: b.x, y: b.y, vx: Math.cos(a) * rand(100, 380), vy: Math.sin(a) * rand(100, 380), life: rand(0.3, 0.6), maxLife: 0.6, size: rand(3, 6), color: choice(['#ff6b35', '#ffd23f', '#ff5d5d']), grav: 200 });
        }
      }
    }
    else if (b.kind === 'lance') {
      b.x += b.vx * dt; b.y += b.vy * dt;
      const hits = queryEnemies(b.x, b.y, b.r + 8);
      for (const e of hits) {
        if (b.hitSet.has(e)) continue;
        b.hitSet.set(e, 1);
        damageEnemy(e, b.dmg, true, Math.atan2(b.vy, b.vx));
      }
      for (const c of queryCrystals(b.x, b.y, b.r + 8)) {
        if (b.hitCry === c) continue;
        b.hitCry = c;
        damageCrystal(c, b.dmg);
      }
      if (b.life <= 0) G.projectiles.splice(i, 1);
    }
  }

  // 번개 시각효과 수명
  for (let i = G.fx.bolts.length - 1; i >= 0; i--) {
    G.fx.bolts[i].life -= dt;
    if (G.fx.bolts[i].life <= 0) G.fx.bolts.splice(i, 1);
  }
  for (let i = G.explosions.length - 1; i >= 0; i--) {
    G.explosions[i].life -= dt;
    if (G.explosions[i].life <= 0) G.explosions.splice(i, 1);
  }
}

/* 무기 투사체 그리기 */
function drawProjectiles(ctx) {
  const p = G.player;

  // 오라
  if (G.weapons.aura) {
    const lv = wstats('aura', G.weapons.aura);
    const evolved = G.weapons.aura.evolved;
    const pulse = 1 + (G.auraPulse || 0) * 0.06;
    const r = lv.r * pulse;
    const hue = (G.time * 140) % 360;
    const col = evolved ? `hsla(${hue},100%,65%,` : 'rgba(77,227,255,';
    // 내부 발광
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, evolved ? `hsl(${hue},100%,60%)` : '#4de3ff', p.x, p.y, r * 1.05, 0.10 + (G.auraPulse || 0) * 0.1);
    ctx.globalCompositeOperation = 'source-over';
    // 회전하는 이중 링
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(G.time * 0.8);
    ctx.strokeStyle = col + `${0.5 + (G.auraPulse || 0) * 0.3})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([26, 18]);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.rotate(-G.time * 2.1);
    ctx.setLineDash([10, 26]);
    ctx.strokeStyle = col + `${0.3 + (G.auraPulse || 0) * 0.3})`;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.88, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // 궤도 검
  if (G.weapons.orbit) {
    const lv = wstats('orbit', G.weapons.orbit);
    const evolved = G.weapons.orbit.evolved;
    // 애프터이미지 궤적 (기록 → 페이드 렌더)
    if (!G.orbitTrail) G.orbitTrail = [];
    G.orbitTrail.push({ a: G.orbitAngle * lv.spd / 3, t: 0.22, count: lv.count, r: lv.r });
    if (G.orbitTrail.length > 10) G.orbitTrail.shift();
    for (const tr of G.orbitTrail) {
      tr.t -= 1 / 60;
      if (tr.t <= 0 || tr.r === lv.r - 0) { /* keep */ }
      const fade = Math.max(0, tr.t / 0.22) * 0.25;
      if (fade <= 0.01) continue;
      ctx.strokeStyle = evolved ? `rgba(255,210,63,${fade})` : `rgba(140,220,255,${fade})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, lv.r, tr.a - 0.5, tr.a + 0.1);
      ctx.stroke();
    }
    for (let i = 0; i < lv.count; i++) {
      const a = G.orbitAngle * lv.spd / 3 + (i / lv.count) * TAU;
      const ox = p.x + Math.cos(a) * lv.r, oy = p.y + Math.sin(a) * lv.r;
      // 검 발광
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, evolved ? '#ffd23f' : '#7ad0ff', ox, oy, 26, 0.5);
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(a + Math.PI / 2 + Math.sin(G.orbitAngle * 3) * 0.3);
      if (evolved) {
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        ctx.moveTo(0, -20); ctx.lineTo(5.5, -4); ctx.lineTo(3.5, 16); ctx.lineTo(-3.5, 16); ctx.lineTo(-5.5, -4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff3c4';
        ctx.fillRect(-8, 14, 16, 4.5);
      } else {
        ctx.fillStyle = '#b8c4d4';
        ctx.beginPath();
        ctx.moveTo(0, -18); ctx.lineTo(4.5, -4); ctx.lineTo(3, 14); ctx.lineTo(-3, 14); ctx.lineTo(-4.5, -4);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7ad0ff';
        ctx.fillRect(-7, 12, 14, 4);
      }
      ctx.restore();
    }
  }

  // 번개 (시네마틱 다중 분기)
  for (const b of G.fx.bolts) {
    const a = b.life / b.maxLife;
    ctx.globalCompositeOperation = 'lighter';
    Glow.draw(ctx, '#ffe14d', b.x, b.y, 70 * (1.5 - a), a * 0.75);
    const drawBoltPath = (x, y, jag, width, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      let cx = x, cy = y - 300;
      ctx.moveTo(cx, cy);
      while (cy < y - 10) {
        cy += 30;
        cx = x + rand(-jag, jag);
        ctx.lineTo(cx, cy);
      }
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    // 외곽 할로 → 코어
    drawBoltPath(b.x, b.y, 20, 6 * a + 2, `rgba(255,225,77,${a * 0.5})`);
    drawBoltPath(b.x, b.y, 12, 2.5 * a + 0.8, `rgba(255,255,255,${a})`);
    // 분기
    if (a > 0.4) {
      drawBoltPath(b.x + rand(-26, 26), b.y - rand(30, 80), 16, 1.5, `rgba(255,225,77,${a * 0.4})`);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // 폭발 / 충격파 (시네마틱 링 + 발광)
  for (const ex of G.explosions) {
    const t = 1 - ex.life / ex.maxLife;
    const r = ex.r * (0.35 + t * 0.85);
    const col = ex.color || '#ff8c32';
    ctx.globalCompositeOperation = 'lighter';
    // 확장 링
    ctx.strokeStyle = col;
    ctx.globalAlpha = (1 - t) * 0.9;
    ctx.lineWidth = ex.thin ? 3 * (1 - t) + 1 : 7 * (1 - t) + 2;
    ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, TAU); ctx.stroke();
    // 잔상 링 (더 얇게, 살짝 뒤따름)
    ctx.globalAlpha = (1 - t) * 0.4;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ex.x, ex.y, r * 0.78, 0, TAU); ctx.stroke();
    // 발광 코어
    if (!ex.thin) {
      Glow.draw(ctx, col, ex.x, ex.y, r * 0.9, (1 - t) * 0.8);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  for (const b of G.projectiles) {
    if (b.kind === 'bolt') {
      // 혜성형 마탄: 발광 꼬리 + 코어
      const boltCol = b.pierce ? `hsl(${(G.time * 400 + b.x) % 360},100%,65%)` : '#4de3ff';
      ctx.globalCompositeOperation = 'lighter';
      // 꼬리 (진행 반대 방향 라인)
      const tx = b.x - b.vx * 0.045, ty = b.y - b.vy * 0.045;
      const tg = ctx.createLinearGradient(b.x, b.y, tx, ty);
      tg.addColorStop(0, boltCol);
      tg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.strokeStyle = tg;
      ctx.lineWidth = b.r * 0.9;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(tx, ty); ctx.stroke();
      // 발광
      Glow.draw(ctx, boltCol, b.x, b.y, b.r * 3.2, 0.75);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.5, 0, TAU); ctx.fill();
    }
    else if (b.kind === 'boomerang') {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.spin);
      ctx.fillStyle = '#ff9f1c';
      MapGen.rr(ctx, -13, -4, 26, 8, 4); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      MapGen.rr(ctx, -13, -4, 12, 8, 4); ctx.fill();
      ctx.restore();
    }
    else if (b.kind === 'grenade') {
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(b.x, b.y, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff6b35';
      ctx.beginPath(); ctx.arc(b.x - 2, b.y - 2, 3, 0, TAU); ctx.fill();
      // 예상 지점 표시
      ctx.strokeStyle = 'rgba(255,107,53,0.5)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(b.tx, b.ty, b.aoe * 0.5, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
    else if (b.kind === 'lance') {
      const a = Math.atan2(b.vy, b.vx);
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(a);
      const grad = ctx.createLinearGradient(-60, 0, 30, 0);
      grad.addColorStop(0, 'rgba(179,136,255,0)');
      grad.addColorStop(1, 'rgba(230,210,255,0.95)');
      ctx.fillStyle = grad;
      MapGen.rr(ctx, -60, -b.w / 2, 90, b.w, b.w / 2); ctx.fill();
      ctx.fillStyle = '#fff';
      MapGen.rr(ctx, 10, -b.w / 4, 26, b.w / 2, b.w / 4); ctx.fill();
      ctx.restore();
    }
  }

  // 적 투사체
  for (const b of G.eProjectiles) {
    const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r + 5);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(0.5, b.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 5, 0, TAU); ctx.fill();
  }
}
