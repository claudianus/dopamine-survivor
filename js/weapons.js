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

/* 무기 상태 초기화 (플레이어 시작 무기: 매직 볼트) */
function initWeapons() {
  G.weapons = { bolt: { lvl: 1, cd: 0 } };
  G.orbitAngle = 0;
  G.auraTick = 0;
  G.fx = { bolts: [] }; // 번개 시각 효과
}

function weaponDmgMult() { return 1 + G.passives.power * 0.12; }
function cooldownMult() { return Math.pow(0.93, G.passives.haste); }

function updateWeapons(dt) {
  const p = G.player;
  const dmgM = weaponDmgMult();
  const cdM = cooldownMult();
  G.orbitAngle += dt * 3;

  for (const id in G.weapons) {
    const w = G.weapons[id];
    const lv = WEAPON_DEFS[id].lvls[w.lvl - 1];
    w.cd -= dt;

    if (id === 'orbit' || id === 'aura') continue; // 상시 무기

    if (w.cd <= 0) {
      w.cd = (lv.cd || 1) * cdM;
      fireWeapon(id, lv, dmgM);
    }
  }

  /* 궤도 검: 상시 회전 + 접촉 피해 */
  if (G.weapons.orbit) {
    const lv = WEAPON_DEFS.orbit.lvls[G.weapons.orbit.lvl - 1];
    for (let i = 0; i < lv.count; i++) {
      const a = G.orbitAngle * lv.spd / 3 + (i / lv.count) * TAU;
      const ox = p.x + Math.cos(a) * lv.r, oy = p.y + Math.sin(a) * lv.r;
      const targets = queryEnemies(ox, oy, 22);
      for (const e of targets) {
        const last = e.hitBy.get('orbit') || 0;
        if (G.time - last > 0.42) {
          e.hitBy.set('orbit', G.time);
          damageEnemy(e, lv.dmg * dmgM, true, a);
        }
      }
    }
  }

  /* 오라: 반경 내 틱 피해 */
  if (G.weapons.aura) {
    const lv = WEAPON_DEFS.aura.lvls[G.weapons.aura.lvl - 1];
    G.auraTick -= dt;
    if (G.auraTick <= 0) {
      G.auraTick = lv.tick;
      const targets = queryEnemies(p.x, p.y, lv.r);
      let hitAny = false;
      for (const e of targets) {
        damageEnemy(e, lv.dmg * dmgM, true, null);
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
        const t = nearestEnemy(p.x, p.y, 650, used);
        if (!t) break;
        used.add(t);
        const a = ang(p.x, p.y, t.x, t.y) + rand(-0.06, 0.06);
        G.projectiles.push({
          kind: 'bolt', x: p.x, y: p.y,
          vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
          r: 7, dmg: lv.dmg * dmgM, life: 1.6,
          target: t, color: WEAPON_DEFS.bolt.color, trail: [],
        });
      }
      if (used.size) SFX.play('shoot');
      break;
    }
    case 'lightning': {
      const cands = G.enemies.filter(e => dist2(e.x, e.y, p.x, p.y) < 380 * 380);
      if (!cands.length) return;
      for (let i = 0; i < lv.count; i++) {
        const t = cands[(Math.random() * cands.length) | 0];
        if (!t) break;
        G.fx.bolts.push({ x: t.x, y: t.y, life: 0.28, maxLife: 0.28 });
        SFX.play('thunder');
        shakeCam(2.5);
        for (const e of queryEnemies(t.x, t.y, lv.aoe)) {
          damageEnemy(e, lv.dmg * dmgM, true, null);
          e.stun = Math.max(e.stun, 0.25);
        }
        for (let k = 0; k < 8; k++) {
          const a2 = Math.random() * TAU;
          G.particles.push({ x: t.x, y: t.y, vx: Math.cos(a2) * rand(80, 220), vy: Math.sin(a2) * rand(80, 220) - 60, life: 0.35, maxLife: 0.35, size: 3, color: '#ffe14d', grav: 300 });
        }
      }
      break;
    }
    case 'boomerang': {
      for (let i = 0; i < lv.count; i++) {
        const t = nearestEnemy(p.x, p.y, 700);
        const a = t ? ang(p.x, p.y, t.x, t.y) : Math.random() * TAU;
        G.projectiles.push({
          kind: 'boomerang', x: p.x, y: p.y,
          vx: Math.cos(a) * lv.spd, vy: Math.sin(a) * lv.spd,
          r: 14, dmg: lv.dmg * dmgM, life: 5,
          phase: 'out', dist: 0, range: lv.range, spd: lv.spd,
          spin: 0, hitSet: new Map(), color: WEAPON_DEFS.boomerang.color,
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
        });
      }
      break;
    }
    case 'lance': {
      const dirA = Math.atan2(p.faceY, p.faceX) || 0;
      for (let i = 0; i < lv.count; i++) {
        const off = lv.count > 1 ? (i === 0 ? -26 : 26) : 0;
        const px2 = -Math.sin(dirA) * off, py2 = Math.cos(dirA) * off;
        G.projectiles.push({
          kind: 'lance', x: p.x + px2, y: p.y + py2,
          vx: Math.cos(dirA) * 950, vy: Math.sin(dirA) * 950,
          r: lv.w / 2, dmg: lv.dmg * dmgM, life: 0.62,
          w: lv.w, hitSet: new Map(), color: WEAPON_DEFS.lance.color,
        });
      }
      SFX.play('laser');
      break;
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
      // 경미한 유도
      if (b.target && G.enemies.includes(b.target)) {
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
      const hits = queryEnemies(b.x, b.y, b.r);
      let dead = false;
      for (const e of hits) {
        damageEnemy(e, b.dmg, true, Math.atan2(b.vy, b.vx));
        dead = true; break;
      }
      if (dead || b.life <= 0) {
        G.projectiles.splice(i, 1);
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
        if (b.dist >= b.range) b.phase = 'back';
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
        SFX.play('boom');
        shakeCam(7);
        G.explosions.push({ x: b.x, y: b.y, r: b.aoe, life: 0.4, maxLife: 0.4 });
        for (const e of queryEnemies(b.x, b.y, b.aoe)) {
          damageEnemy(e, b.dmg, true, null);
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
    const lv = WEAPON_DEFS.aura.lvls[G.weapons.aura.lvl - 1];
    const pulse = 1 + (G.auraPulse || 0) * 0.06;
    const r = lv.r * pulse;
    const grad = ctx.createRadialGradient(p.x, p.y, r * 0.55, p.x, p.y, r);
    grad.addColorStop(0, 'rgba(255,93,143,0)');
    grad.addColorStop(0.75, `rgba(255,93,143,${0.10 + (G.auraPulse || 0) * 0.12})`);
    grad.addColorStop(1, `rgba(255,93,143,${0.26 + (G.auraPulse || 0) * 0.2})`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,93,143,${0.45 + (G.auraPulse || 0) * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
  }

  // 궤도 검
  if (G.weapons.orbit) {
    const lv = WEAPON_DEFS.orbit.lvls[G.weapons.orbit.lvl - 1];
    for (let i = 0; i < lv.count; i++) {
      const a = G.orbitAngle * lv.spd / 3 + (i / lv.count) * TAU;
      const ox = p.x + Math.cos(a) * lv.r, oy = p.y + Math.sin(a) * lv.r;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(a + Math.PI / 2 + Math.sin(G.orbitAngle * 3) * 0.3);
      // 검 모양
      ctx.fillStyle = '#e8eef5';
      ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(4.5, -4); ctx.lineTo(3, 14); ctx.lineTo(-3, 14); ctx.lineTo(-4.5, -4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(-7, 12, 14, 4);
      ctx.restore();
    }
  }

  // 번개
  for (const b of G.fx.bolts) {
    const a = b.life / b.maxLife;
    ctx.strokeStyle = `rgba(255,225,77,${a})`;
    ctx.lineWidth = 4 * a + 1;
    ctx.beginPath();
    let x = b.x, y = b.y - 260;
    ctx.moveTo(x, y);
    while (y < b.y - 8) {
      y += 26;
      x = b.x + rand(-16, 16);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.fillStyle = `rgba(255,225,77,${a * 0.4})`;
    ctx.beginPath(); ctx.arc(b.x, b.y, 26 * (1.3 - a), 0, TAU); ctx.fill();
  }

  // 폭발
  for (const ex of G.explosions) {
    const t = 1 - ex.life / ex.maxLife;
    const r = ex.r * (0.4 + t * 0.8);
    ctx.strokeStyle = `rgba(255,140,50,${1 - t})`;
    ctx.lineWidth = 8 * (1 - t) + 2;
    ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, TAU); ctx.stroke();
    const grad = ctx.createRadialGradient(ex.x, ex.y, 0, ex.x, ex.y, r);
    grad.addColorStop(0, `rgba(255,220,80,${0.7 * (1 - t)})`);
    grad.addColorStop(1, 'rgba(255,80,30,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(ex.x, ex.y, r, 0, TAU); ctx.fill();
  }

  for (const b of G.projectiles) {
    if (b.kind === 'bolt') {
      // 잔상
      for (let i = 0; i < b.trail.length; i++) {
        const t = b.trail[i];
        ctx.fillStyle = `rgba(53,240,255,${i / b.trail.length * 0.35})`;
        ctx.beginPath(); ctx.arc(t.x, t.y, 4, 0, TAU); ctx.fill();
      }
      const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 14);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, '#35f0ff');
      grad.addColorStop(1, 'rgba(53,240,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(b.x, b.y, 14, 0, TAU); ctx.fill();
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
