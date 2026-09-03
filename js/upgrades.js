'use strict';
/* ============================================================
 * 도파민 서바이버 - 업그레이드 (패시브 / 레벨업 카드 / 보물 상자)
 * ============================================================ */

const MAX_WEAPONS = 6, MAX_PASSIVES = 6, PASSIVE_MAX = 5;

const PASSIVE_DEFS = {
  power:   { name: '파워 업',      emoji: '🔥', desc: '모든 공격력 +12%' },
  haste:   { name: '공격 속도',    emoji: '⏱️', desc: '무기 쿨다운 -7%' },
  boots:   { name: '질주',         emoji: '👟', desc: '이동 속도 +8%' },
  vitality:{ name: '생명력',       emoji: '❤️', desc: '최대 체력 +25 (즉시 회복)' },
  magnet:  { name: '자석',         emoji: '🧲', desc: '아이템 획득 반경 +35%' },
  // magnetR 기본값 95px 기준
  crit:    { name: '치명타',       emoji: '🎯', desc: '치명타 확률 +5%, 치명타 피해 +15%' },
  wisdom:  { name: '지혜',         emoji: '🧬', desc: '경험치 획득 +10%' },
  regen:   { name: '재생',         emoji: '♻️', desc: '초당 체력 회복 +0.7' },
  luck:    { name: '행운',         emoji: '🍀', desc: '엘리트/상자/하트 확률 증가' },
};

function initPassives() {
  G.passives = {
    power: 0, haste: 0, boots: 0, vitality: 0, magnet: 0,
    crit: 0, wisdom: 0, regen: 0, luck: 0,
  };
}

function recomputeStats() {
  const p = G.player, pv = G.passives;
  p.speed = 255 * (1 + pv.boots * 0.08);
  p.maxHp = 120 + pv.vitality * 25;
  p.magnetR = 95 * (1 + pv.magnet * 0.35);
  p.critC = 0.05 + pv.crit * 0.05;
  p.critD = 2.0 + pv.crit * 0.15;
  p.xpMult = 1 + pv.wisdom * 0.10;
  p.regen = pv.regen * 0.7;
}

/* 선택지 풀 구성 */
function buildChoices(count = 3) {
  const pool = [];
  const wCount = Object.keys(G.weapons).length;
  const pCount = Object.keys(G.passives).filter(k => G.passives[k] > 0).length;

  // 무기: 신규 해금 또는 레벨업 (진화 완료 무기는 제외)
  for (const id in WEAPON_DEFS) {
    const w = G.weapons[id];
    if (!w && wCount < MAX_WEAPONS) pool.push({ type: 'weapon', id, isNew: true, weight: 10 });
    else if (w && w.lvl < 5 && !w.evolved) pool.push({ type: 'weapon', id, lvl: w.lvl + 1, weight: 12 });
  }
  // 패시브
  for (const id in PASSIVE_DEFS) {
    const cur = G.passives[id];
    if (cur === 0 && pCount < MAX_PASSIVES) pool.push({ type: 'passive', id, isNew: true, weight: 8 });
    else if (cur > 0 && cur < PASSIVE_MAX) pool.push({ type: 'passive', id, lvl: cur + 1, weight: 9 });
  }
  // 폴백 (전부 만렙)
  if (!pool.length) {
    pool.push({ type: 'fallback', id: 'heal', name: '응급 치료', emoji: '💖', desc: '체력을 50 회복', weight: 1 });
    pool.push({ type: 'fallback', id: 'power5', name: '축적된 힘', emoji: '💪', desc: '공격력 영구 +8%', weight: 1 });
  }

  const out = [];
  const used = new Set();
  let guard = 0;
  while (out.length < count && guard++ < 60) {
    let sum = 0;
    for (const c of pool) if (!used.has(c.type + c.id)) sum += c.weight;
    if (sum <= 0) break;
    let r = Math.random() * sum;
    for (const c of pool) {
      if (used.has(c.type + c.id)) continue;
      r -= c.weight;
      if (r <= 0) { used.add(c.type + c.id); out.push(c); break; }
    }
  }
  return out;
}

function applyUpgrade(u) {
  if (u.type === 'weapon') {
    if (!G.weapons[u.id]) G.weapons[u.id] = { lvl: 1, cd: 0 };
    else G.weapons[u.id].lvl++;
  } else if (u.type === 'passive') {
    G.passives[u.id]++;
    if (u.id === 'vitality') G.player.hp += 25;
    recomputeStats();
  } else if (u.type === 'fallback') {
    if (u.id === 'heal') G.player.hp = Math.min(G.player.maxHp, G.player.hp + 50);
    else { G.passives.power += 0.67; recomputeStats(); }
  }
  renderHUDBars(); // 무기/패시브 아이콘 갱신
}

/* ---------- 레벨업 UI ---------- */
function openLevelUp() {
  G.state = 'levelup';
  G.pendingLevelUps--;
  SFX.play('levelup');
  shakeCam(4);
  POST.triggerChroma(0.3);
  POST.triggerFlash(0.08);
  // 레벨업 폭발 이펙트
  const p = G.player;
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU;
    G.particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * rand(180, 420), vy: Math.sin(a) * rand(180, 420), life: rand(0.4, 0.8), maxLife: 0.8, size: rand(3, 6), color: choice(['#ffd23f', '#35f0ff', '#ff5d8f', '#7dffa0']), grav: 0 });
  }

  const choices = buildChoices(3);
  const box = document.getElementById('lu-cards');
  box.innerHTML = '';
  choices.forEach((u, i) => {
    const def = u.type === 'weapon' ? WEAPON_DEFS[u.id] : (u.type === 'passive' ? PASSIVE_DEFS[u.id] : u);
    const title = u.type === 'weapon'
      ? (u.isNew ? `${def.emoji} ${def.name}` : `${def.emoji} ${def.name} Lv.${(u.lvl || 1) - 1} → Lv.${u.lvl}`)
      : (u.type === 'passive'
        ? (u.isNew ? `${def.emoji} ${def.name}` : `${def.emoji} ${def.name} Lv.${(u.lvl || 1) - 1} → Lv.${u.lvl}`)
        : `${u.emoji} ${u.name}`);
    const desc = u.type === 'weapon' ? (u.isNew ? '새 무기 해금! ' + def.desc(1) : def.desc(u.lvl))
      : (u.type === 'passive' ? def.desc : u.desc);

    const card = document.createElement('button');
    card.className = 'lu-card' + (u.isNew ? ' new' : '');
    card.style.animationDelay = (i * 0.08) + 's';
    card.innerHTML = `
      <div class="lu-badge">${u.isNew ? 'NEW!' : 'LV UP'}</div>
      <div class="lu-emoji">${def.emoji || u.emoji}</div>
      <div class="lu-title">${title}</div>
      <div class="lu-desc">${desc}</div>
      <div class="lu-key">${i + 1}</div>`;
    card.onclick = () => pickCard(u);
    box.appendChild(card);
  });
  document.getElementById('overlay-levelup').classList.remove('hidden');
  G.luChoices = choices;
}

function pickCard(u) {
  SFX.play('pick');
  applyUpgrade(u);
  document.getElementById('overlay-levelup').classList.add('hidden');
  if (G.pendingLevelUps > 0) {
    setTimeout(openLevelUp, 120);
  } else {
    G.state = 'playing';
  }
}

/* ---------- 보물 상자 (슬롯머신!) ---------- */
function openChest(val) {
  G.state = 'chest';
  SFX.play('chest');
  shakeCam(8);

  // 만렙 무기가 있으면 진화가 첫 보상!
  const evolvable = Object.keys(G.weapons).filter(id => G.weapons[id].lvl >= 5 && !G.weapons[id].evolved && EVOLUTIONS[id]);
  const evoId = evolvable.length ? choice(evolvable) : null;

  const nRewards = Math.min(val >= 5 ? 5 : (val >= 4 ? 4 : 3), 5);
  const rewards = [];
  const allEmojis = Object.values(WEAPON_DEFS).map(w => w.emoji)
    .concat(Object.values(PASSIVE_DEFS).map(p => p.emoji))
    .concat(Object.values(EVOLUTIONS).map(e => e.emoji));

  const box = document.getElementById('ch-slots');
  box.innerHTML = '';
  const slots = [];
  for (let i = 0; i < nRewards; i++) {
    const el = document.createElement('div');
    el.className = 'ch-slot';
    el.innerHTML = '<div class="ch-spin"></div>';
    box.appendChild(el);
    slots.push({ el: el.firstChild, stopped: false, final: null });
  }
  document.getElementById('ch-title').textContent = evoId ? '⚡ 무기 진화 상자!!' : (val >= 5 ? '👑 보스의 보물!' : '💎 보물 상자!');
  document.getElementById('overlay-chest').classList.remove('hidden');
  document.getElementById('ch-done').classList.add('hidden');

  // 진화 슬롯 특별 스타일
  if (evoId) slots[0].el.parentElement.classList.add('evolve');

  const startT = performance.now();
  const stopAt = slots.map((_, i) => 800 + i * 480);
  const spin = setInterval(() => {
    const t = performance.now() - startT;
    let allStopped = true;
    slots.forEach((s, i) => {
      if (!s.stopped) {
        allStopped = false;
        s.el.textContent = allEmojis[(Math.random() * allEmojis.length) | 0];
        if (t > stopAt[i]) {
          s.stopped = true;
          if (i === 0 && evoId) {
            const evo = EVOLUTIONS[evoId];
            rewards.push({ type: 'evolve', id: evoId });
            s.el.textContent = evo.emoji;
            s.el.parentElement.classList.add('stopped', 'evolved');
            showBannerOnce(evo.emoji + ' ' + evo.name + '!');
          } else {
            const u = buildChoices(1)[0];
            rewards.push(u);
            const def = u.type === 'weapon' ? WEAPON_DEFS[u.id] : (u.type === 'passive' ? PASSIVE_DEFS[u.id] : u);
            s.el.textContent = def.emoji || u.emoji;
            s.el.parentElement.classList.add('stopped');
          }
          SFX.play('tick');
        }
      }
    });
    if (allStopped) {
      clearInterval(spin);
      setTimeout(() => {
        let evolvedName = null;
        for (const u of rewards) {
          if (u.type === 'evolve') {
            G.weapons[u.id].evolved = true;
            evolvedName = EVOLUTIONS[u.id];
            showBanner('🌟 ' + WEAPON_DEFS[u.id].name + ' → ' + evolvedName.name + ' 진화!', '#ffd23f');
            shakeCam(10);
            // 진화 폭발 파티클
            const p = G.player;
            for (let k = 0; k < 40; k++) {
              const a = Math.random() * TAU;
              G.particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * rand(150, 480), vy: Math.sin(a) * rand(150, 480), life: rand(0.4, 0.9), maxLife: 0.9, size: rand(3, 7), color: choice(['#ffd23f', '#35f0ff', '#ff5d8f', '#ffffff']), grav: 0 });
            }
          } else applyUpgrade(u);
        }
        SFX.play(evolvedName ? 'evolve' : 'levelup');
        const names = rewards.map(u => {
          if (u.type === 'evolve') return '🌟 ' + EVOLUTIONS[u.id].name + ' 진화!';
          const def = u.type === 'weapon' ? WEAPON_DEFS[u.id] : (u.type === 'passive' ? PASSIVE_DEFS[u.id] : u);
          return (def.emoji || u.emoji) + ' ' + (def.name || u.name);
        }).join(' · ');
        document.getElementById('ch-result').textContent = names;
        document.getElementById('ch-done').classList.remove('hidden');
      }, 350);
    }
  }, 75);

  document.getElementById('ch-done').onclick = () => {
    document.getElementById('overlay-chest').classList.add('hidden');
    document.getElementById('ch-result').textContent = '';
    if (G.state === 'chest') G.state = 'playing';
  };
}

let bannerOnceT = 0;
function showBannerOnce(text) {
  // 슬롯 정지 순간의 짧은 알림 (메인 배너와 충돌하지 않게 짧게)
  SFX.play('pick');
}
