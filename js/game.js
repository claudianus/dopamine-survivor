'use strict';
/* ============================================================
 * 도파민 서바이버 - 메인 게임 루프 / 렌더링 / HUD / 입력
 * ============================================================ */

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

/* ---------- 초기화 ---------- */
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  G.dpr = dpr;
  G.view = { w: window.innerWidth, h: window.innerHeight };
  G.zoom = window.innerWidth < 720 ? 0.82 : 1;
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

  G.player = {
    x: 0, y: 0, r: 16, hp: 120, maxHp: 120,
    faceX: 1, faceY: 0, iFrames: 0,
    moving: false, squash: 0, walkT: 0,
    // recomputeStats()가 채움
    speed: 255, magnetR: 95, critC: 0.05, critD: 2, xpMult: 1, regen: 0,
    level: 1, xp: 0, xpNext: xpFor(1),
  };
  initPassives();
  recomputeStats();
  initWeapons();

  G.camera = { x: 0, y: 0, shake: 0 };

  document.getElementById('seedTag').textContent = '시드 ' + G.seed.toString(16).toUpperCase();
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('pauseBtn').classList.remove('hidden');
  renderHUDBars();
  updateHUD(true);
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
  r.active = true;
  r.t = 6;
  SFX.play('rush');
  shakeCam(12);
  showBanner('🔥 도파민 러시!! 🔥', '#ff4d9d');
  document.body.classList.add('rush');
  document.getElementById('rageBtn').classList.remove('ready');
  const p = G.player;
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
    G.particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * rand(200, 560), vy: Math.sin(a) * rand(200, 560), life: rand(0.4, 0.9), maxLife: 0.9, size: rand(3, 7), color: `hsl(${(i / 50) * 360},100%,60%)`, grav: 0 });
  }
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
function hurtPlayer(dmg) {
  const p = G.player;
  if (G.rage.active) { SFX.play('ragehit'); return; } // 러시 중 무적
  p.hp -= dmg;
  G.hurtVin = 1;
  shakeCam(6);
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
  if (p.moving) {
    mx /= len || 1; my /= len || 1;
    p.faceX = lerp(p.faceX, mx, 0.2);
    p.faceY = lerp(p.faceY, my, 0.2);
    const spd = p.speed * MapGen.groundSpeed(p.x, p.y) * (G.rage.active ? 1.3 : 1);
    p.x += mx * spd * dt;
    p.y += my * spd * dt;
    // 이동 잔상
    if (Math.random() < dt * 18) {
      G.particles.push({ x: p.x + rand(-6, 6), y: p.y + 12, vx: rand(-15, 15), vy: rand(-8, 4), life: 0.3, maxLife: 0.3, size: 3, color: 'rgba(120,200,255,0.7)', grav: 0 });
    }
  }

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

  // 콤보 감소
  if (G.comboT > 0) {
    G.comboT -= dt;
    if (G.comboT <= 0) G.combo = 0;
  }

  // 카메라
  const cam = G.camera;
  cam.x = lerp(cam.x, G.player.x - G.view.w / (2 * G.zoom), 1 - Math.pow(0.001, dt));
  cam.y = lerp(cam.y, G.player.y - G.view.h / (2 * G.zoom), 1 - Math.pow(0.001, dt));
  cam.shake = Math.max(0, cam.shake - dt * 22);

  // 낮/밤 틴트 (20분 주기)
  G.dayTint = (Math.sin(G.time / 60 * TAU * 0.7 - Math.PI / 2) + 1) / 2;

  G.hurtVin = Math.max(0, G.hurtVin - dt * 2.2);
  updateHUD(false);
}

/* ---------- 렌더 ---------- */
function render() {
  const cam = G.camera;
  const shx = rand(-cam.shake, cam.shake), shy = rand(-cam.shake, cam.shake);

  ctx.fillStyle = '#0b0e1a';
  ctx.fillRect(0, 0, G.view.w, G.view.h);

  ctx.save();
  ctx.scale(G.zoom, G.zoom);
  ctx.translate(-cam.x + shx, -cam.y + shy);

  const vw = G.view.w / G.zoom, vh = G.view.h / G.zoom;
  MapGen.drawWorld(ctx, cam.x - shx - 4, cam.y - shy - 4, vw + 8, vh + 8);

  // 픽업
  for (const pk of G.pickups) drawPickup(pk);

  // 도파민 결정
  for (const c of G.crystals) drawCrystal(ctx, c);

  // 적 (y 정렬)
  const sorted = G.enemies.slice().sort((a, b) => a.y - b.y);
  for (const e of sorted) drawEnemy(ctx, e);

  drawPlayer();
  drawProjectiles(ctx);

  // 파티클
  for (const pt of G.particles) {
    const a = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (0.5 + a * 0.5), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

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
      ctx.fillStyle = '#ff5d5d';
      ctx.strokeText('-' + t.val, t.x, t.y);
      ctx.fillText('-' + t.val, t.x, t.y);
    } else if (t.crit) {
      ctx.fillStyle = '#ffd23f';
      ctx.strokeText(t.val + '!', t.x, t.y);
      ctx.fillText(t.val + '!', t.x, t.y);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.strokeText(t.val, t.x, t.y);
      ctx.fillText(t.val, t.x, t.y);
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // 밤 틴트
  if (G.dayTint > 0.05) {
    ctx.fillStyle = `rgba(10,15,45,${G.dayTint * 0.32})`;
    ctx.fillRect(0, 0, G.view.w, G.view.h);
  }
  // 피격 비네트
  if (G.hurtVin > 0) {
    const g = ctx.createRadialGradient(G.view.w / 2, G.view.h / 2, G.view.h * 0.3, G.view.w / 2, G.view.h / 2, G.view.h * 0.75);
    g.addColorStop(0, 'rgba(255,0,40,0)');
    g.addColorStop(1, `rgba(255,0,40,${G.hurtVin * 0.45})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, G.view.w, G.view.h);
  }
}

function drawPlayer() {
  const p = G.player;
  const blink = p.iFrames > 0 && Math.floor(p.iFrames * 14) % 2 === 0;
  const squash = p.moving ? 1 + Math.sin(p.walkT) * 0.09 : 1 + Math.sin(p.walkT * 0.5) * 0.03;

  ctx.save();
  ctx.translate(p.x, p.y);
  // 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 15, 14, 5.5, 0, 0, TAU); ctx.fill();

  if (blink) ctx.globalAlpha = 0.35;
  ctx.scale(1 / squash, squash);

  // 몸통 (도파민 히어로 슬라임)
  const grad = ctx.createRadialGradient(-5, -8, 3, 0, 0, 22);
  grad.addColorStop(0, '#9be8ff');
  grad.addColorStop(0.6, '#35a8ff');
  grad.addColorStop(1, '#2470d6');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-16, 10);
  ctx.quadraticCurveTo(-17, -16, 0, -16);
  ctx.quadraticCurveTo(17, -16, 16, 10);
  ctx.quadraticCurveTo(0, 15, -16, 10);
  ctx.fill();

  // 하이라이트
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath(); ctx.ellipse(-6, -9, 5, 3, -0.5, 0, TAU); ctx.fill();

  // 눈
  const ex = clamp(p.faceX, -1, 1) * 3.4, ey = clamp(p.faceY, -1, 1) * 2.2;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-5.5 + ex, -3 + ey, 4.4, 0, TAU);
  ctx.arc(5.5 + ex, -3 + ey, 4.4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#12203a';
  ctx.beginPath();
  ctx.arc(-5.5 + ex * 1.5, -3 + ey, 2.1, 0, TAU);
  ctx.arc(5.5 + ex * 1.5, -3 + ey, 2.1, 0, TAU);
  ctx.fill();
  // 볼터치
  ctx.fillStyle = 'rgba(255,120,170,0.55)';
  ctx.beginPath(); ctx.arc(-9 + ex, 2, 2.6, 0, TAU); ctx.arc(9 + ex, 2, 2.6, 0, TAU); ctx.fill();
  // 입
  ctx.strokeStyle = '#12203a'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(ex, 3 + ey, 3.4, 0.15, Math.PI - 0.15); ctx.stroke();

  // 도파민 왕관
  drawCrown(ctx, 0, -16, 8);

  ctx.globalAlpha = 1;
  ctx.restore();

  // HP 바 (머리 위)
  if (p.hp < p.maxHp) {
    const w = 44;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    MapGen.rr(ctx, p.x - w / 2, p.y - 38, w, 6, 3); ctx.fill();
    const hr = clamp(p.hp / p.maxHp, 0, 1);
    ctx.fillStyle = hr > 0.5 ? '#54e37c' : (hr > 0.25 ? '#ffd23f' : '#ff5d5d');
    if (hr > 0) { MapGen.rr(ctx, p.x - w / 2 + 1, p.y - 37, (w - 2) * hr, 4, 2); ctx.fill(); }
  }
}

function drawPickup(pk) {
  const bob = Math.sin(pk.t) * 3;
  ctx.save();
  ctx.translate(pk.x, pk.y + bob);
  switch (pk.kind) {
    case 'gem': {
      const v = pk.val;
      const c = v >= 10 ? '#c77dff' : (v >= 3 ? '#ff5d8f' : '#35f0ff');
      const s = v >= 10 ? 9 : (v >= 3 ? 7.5 : 6);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 2.2);
      glow.addColorStop(0, c + '88');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, s * 2.2, 0, TAU); ctx.fill();
      ctx.rotate(pk.t * 0.6);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.68, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.68, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      ctx.beginPath();
      ctx.moveTo(0, -s); ctx.lineTo(s * 0.3, -s * 0.15); ctx.lineTo(-s * 0.2, 0);
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'heart': {
      ctx.rotate(Math.sin(pk.t * 0.5) * 0.15);
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath();
      ctx.arc(-5, -3, 5.4, 0, TAU); ctx.arc(5, -3, 5.4, 0, TAU);
      ctx.moveTo(-9.6, -1);
      ctx.lineTo(0, 10);
      ctx.lineTo(9.6, -1);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(-4.6, -4.6, 1.8, 0, TAU); ctx.fill();
      break;
    }
    case 'magnet': {
      ctx.rotate(Math.sin(pk.t * 0.4) * 0.2);
      ctx.strokeStyle = '#e63946'; ctx.lineWidth = 6; ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.arc(0, 0, 8, Math.PI, 0); ctx.stroke();
      ctx.strokeStyle = '#f1faee'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-8, 6); ctx.moveTo(8, 0); ctx.lineTo(8, 6); ctx.stroke();
      break;
    }
    case 'chest': {
      const s = 1 + Math.sin(pk.t * 0.7) * 0.06;
      ctx.scale(s, s);
      // 발광
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
      glow.addColorStop(0, 'rgba(255,210,63,0.5)');
      glow.addColorStop(1, 'rgba(255,210,63,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, TAU); ctx.fill();
      // 상자 몸통
      ctx.fillStyle = '#8b5a2b';
      MapGen.rr(ctx, -14, -6, 28, 16, 3); ctx.fill();
      ctx.fillStyle = '#a4713d';
      MapGen.rr(ctx, -14, -12, 28, 9, 4); ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(-3, -8, 6, 16);
      ctx.fillStyle = '#b8860b';
      ctx.fillRect(-14, -3, 28, 3);
      // 반짝이
      ctx.fillStyle = '#fff';
      const tw = (Math.sin(pk.t * 2) + 1) / 2;
      ctx.globalAlpha = tw;
      ctx.beginPath(); ctx.arc(8, -12, 2.2, 0, TAU); ctx.arc(-9, -4, 1.6, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
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
  SFX.play(win ? 'victory' : 'gameover');
  shakeCam(win ? 6 : 12);

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
    G.camera = { x: 0, y: 0, shake: 0 };
    G.view = { w: window.innerWidth, h: window.innerHeight };
    G.zoom = 1;
    titleInit = true;
  }
  const cx = Math.cos(t / 20000) * 1600 - G.view.w / 2;
  const cy = Math.sin(t / 17000) * 1600 - G.view.h / 2;
  ctx.fillStyle = '#0b0e1a';
  ctx.fillRect(0, 0, G.view.w, G.view.h);
  MapGen.drawWorld(ctx, cx, cy, G.view.w + 4, G.view.h + 4);
  ctx.fillStyle = 'rgba(11,14,26,0.55)';
  ctx.fillRect(0, 0, G.view.w, G.view.h);
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
    G.state = 'title';
  };
  document.getElementById('btn-resume').onclick = togglePause;
  document.getElementById('btn-quit').onclick = () => {
    document.getElementById('overlay-pause').classList.add('hidden');
    document.getElementById('overlay-title').classList.remove('hidden');
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
  bindUI();
  G.state = 'title';
  requestAnimationFrame(loop);
});
document.addEventListener('contextmenu', (e) => { if (e.target === canvas) e.preventDefault(); });
