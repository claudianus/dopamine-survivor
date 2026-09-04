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
  greed:   { name: '탐욕',         emoji: '💰', desc: '젬 획득량 +25%' },
  thorns:  { name: '가시 갑주',    emoji: '🛡️', desc: '접촉한 적에게 반사 피해 +9' },
};

function initPassives() {
  G.passives = {
    power: 0, haste: 0, boots: 0, vitality: 0, magnet: 0,
    crit: 0, wisdom: 0, regen: 0, luck: 0, greed: 0, thorns: 0,
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

/* 선택지 풀 구성 (밴시시된 카드는 이번 런에서 영구 제외) */
function buildChoices(count = 3) {
  const pool = [];
  const wCount = Object.keys(G.weapons).length;
  const pCount = Object.keys(G.passives).filter(k => G.passives[k] > 0).length;
  G.banished = G.banished || new Set();

  // 무기: 신규 해금 또는 레벨업 (진화 완료 무기는 제외)
  for (const id in WEAPON_DEFS) {
    if (G.banished.has('w:' + id)) continue;
    const w = G.weapons[id];
    if (!w && wCount < MAX_WEAPONS) pool.push({ type: 'weapon', id, isNew: true, weight: 10 });
    else if (w && w.lvl < 5 && !w.evolved) pool.push({ type: 'weapon', id, lvl: w.lvl + 1, weight: 12 });
  }
  // 패시브
  for (const id in PASSIVE_DEFS) {
    if (G.banished.has('p:' + id)) continue;
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
  G.pendingLevelUps = Math.max(0, G.pendingLevelUps - 1);
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
  refreshLuTools();
  document.getElementById('overlay-levelup').classList.remove('hidden');
  G.luChoices = choices;
}

/* 🎲 리롤 / 🚫 밴시시 툴바 (통제감 = 슬롯의 스톱 버튼 계열) */
function refreshLuTools() {
  const tools = document.getElementById('lu-tools');
  const cnt = document.getElementById('lu-toolsCount');
  if (!tools || !cnt) return;
  G.rerolls = (G.rerolls === undefined) ? 1 + META.buff('rerollPlus') : G.rerolls;
  G.banishes = (G.banishes === undefined) ? 1 : G.banishes;
  tools.classList.toggle('hidden', (G.rerolls + G.banishes) <= 0);
  const rBtn = document.getElementById('lu-reroll');
  const bBtn = document.getElementById('lu-banish');
  rBtn.disabled = G.rerolls <= 0;
  bBtn.disabled = G.banishes <= 0;
  cnt.textContent = `🎲 리롤 ${G.rerolls}회 · 🚫 밴시시 ${G.banishes}회`;
}

function luReroll() {
  if (G.state !== 'levelup' || G.rerolls <= 0) return;
  G.rerolls--;
  SFX.play('dice');
  POST.triggerChroma(0.2);
  // 카드 재생성 (같은 openLevelUp 파이프라인 재사용 — pendingLevelUps 복원 후 재소모)
  G.pendingLevelUps++;
  pickCardSilent();
  openLevelUp();
}

function luBanish() {
  if (G.state !== 'levelup' || G.banishes <= 0 || !G.luChoices) return;
  G.banishes--;
  const u = G.luChoices[G.luChoices.length - 1];
  G.banished.add((u.type === 'weapon' ? 'w:' : 'p:') + u.id);
  SFX.play('banish');
  POST.triggerFlash(0.06);
  // 선택지 재구성: 밴시시 반영 + 마지막 카드 제외 후 1장 재보충
  G.pendingLevelUps++;
  pickCardSilent();
  openLevelUp();
}

function pickCardSilent() {
  // UI만 닫는 내부 파이프라인 (리롤/밴시시용) — 상태 전이는 openLevelUp이 다시 연다
  document.getElementById('overlay-levelup').classList.add('hidden');
  G.luChoices = null;
}

function pickCard(u) {
  // 가드: 카드별 1회만 적용 (키보드 연타/더블클릭으로 같은 카드가 두 번 먹히는 것 방지)
  if (G.state !== 'levelup') return;
  G.state = 'playing'; // 즉시 닫고 — 남은 레벨업은 아래에서 스케줄 (어중간한 levelup 상태로 갇히는 것 방지)
  SFX.play('pick');
  applyUpgrade(u);
  document.getElementById('overlay-levelup').classList.add('hidden');
  G.luChoices = null;
  if (G.pendingLevelUps > 0) {
    setTimeout(() => { if (G.state === 'playing') openLevelUp(); }, 120);
  }
}

/* ---------- 보물 상자 (슬롯머신!) ---------- */
let _chSpinTimer = null; // 이전 상자의 슬롯 타이머 (재오픈 시 정리해 DOM 참조 크래시/이중 보상 방지)

function openChest(val, opts = {}) {
  G.state = 'chest';
  if (_chSpinTimer) { clearInterval(_chSpinTimer); _chSpinTimer = null; }
  // 방어: 혹시 떠 있는 레벨업 오버레이와 겹치지 않게 (상호배제)
  // 미해결 레벨업이 있었다면 카운트 복원 → 상자 종료 후 다시 열림 (유실 방지)
  const luEl = document.getElementById('overlay-levelup');
  if (!luEl.classList.contains('hidden')) {
    luEl.classList.add('hidden');
    G.pendingLevelUps++;
  }
  SFX.play('chest');
  shakeCam(8);

  // 🎰 메가 체스트: 잭팟 게이지 소진 → 8릴 구성 (진화 2회 + 보상 대폭 확대)
  const isMega = !!opts.mega;
  if (isMega) {
    val = Math.max(val, 5);
    SFX.play('jackpot');
    showBigWin('MEGA CHEST!', '🎰 다음 상자가 잭팟입니다!', 'mega');
    shakeCam(12);
    POST.triggerFlash(0.2);
    POST.triggerChroma(0.5);
    try { if (navigator.vibrate) navigator.vibrate([60, 40, 120]); } catch (e) {}
  }

  // 만렙 무기가 있으면 진화가 첫 보상! (메가 체스트는 진화 2개까지)
  const evolvable = Object.keys(G.weapons).filter(id => G.weapons[id].lvl >= 5 && !G.weapons[id].evolved && EVOLUTIONS[id]);
  const evoSlots = isMega ? Math.min(2, evolvable.length) : (evolvable.length ? 1 : 0);
  const evoIds = [];
  for (let i = 0; i < evoSlots; i++) {
    const pick = choice(evolvable.filter(id => !evoIds.includes(id)));
    if (pick) evoIds.push(pick);
  }

  const nRewards = Math.min(isMega ? 8 : (val >= 5 ? 5 : (val >= 4 ? 4 : 3)), 8);
  const rewards = [];
  const allEmojis = Object.values(WEAPON_DEFS).map(w => w.emoji)
    .concat(Object.values(PASSIVE_DEFS).map(p => p.emoji))
    .concat(Object.values(EVOLUTIONS).map(e => e.emoji));

  const box = document.getElementById('ch-slots');
  box.innerHTML = '';
  if (isMega) box.classList.add('mega');
  else box.classList.remove('mega');
  const slots = [];

  // 한 슬롯 확정 처리 (자연 정지·스킬스톱 공통) — 선언을 슬롯 생성보다 먼저 (TDZ 방지)
  const finalizeSlot = (i) => {
    const s = slots[i];
    if (!s || s.stopped || !s.el) return false;
    s.stopped = true;
    if (i < evoSlots && evoIds[i]) {
      const evo = EVOLUTIONS[evoIds[i]];
      rewards.push({ type: 'evolve', id: evoIds[i] });
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
    return true;
  };
  // 스킬스톱: 탭한 릴 즉시 확정 (연출 가속 — 결과는 동일, 통제감만 제공)
  const stopSlot = (i) => {
    if (G.state !== 'chest') return;
    if (finalizeSlot(i)) {
      // 스톱 순간 임팩트
      kickCam(0, -1, 2);
      POST.triggerFlash(0.03);
    }
  };

  for (let i = 0; i < nRewards; i++) {
    const el = document.createElement('div');
    el.className = 'ch-slot';
    el.innerHTML = '<div class="ch-spin"></div>';
    box.appendChild(el);
    // 🎰 스킬스톱: 릴 탭/클릭으로 즉시 정지 (슬롯머신 스톱 버튼 — 통제감)
    el.onclick = () => stopSlot(i);
    slots.push({ el: el.firstChild, stopped: false, final: null });
  }
  document.getElementById('ch-title').textContent = isMega ? '🎰 MEGA CHEST!!' : (evoIds.length ? '⚡ 무기 진화 상자!!' : (val >= 5 ? '👑 보스의 보물!' : '💎 보물 상자!'));
  document.getElementById('overlay-chest').classList.remove('hidden');
  document.getElementById('ch-done').classList.add('hidden');
  document.getElementById('ch-curse').classList.add('hidden');

  // 진화 슬롯 특별 스타일 (메가: 2개)
  evoIds.slice(0, evoSlots).forEach((_, i) => {
    if (slots[i]) slots[i].el.parentElement.classList.add('evolve');
  });

  const startT = performance.now();
  const stopAt = slots.map((_, i) => 800 + i * (isMega ? 260 : 480));
  // 슬롯 요소들이 현재 오버레이에 연결돼 있는지 틱마다 확인 —
  // 재오픈으로 innerHTML이 교체되면 예전 틱이 죽은 노드를 건드리지 않게
  const boxEl = box;

  const spin = _chSpinTimer = setInterval(() => {
    if (!boxEl.isConnected) { clearInterval(spin); if (_chSpinTimer === spin) _chSpinTimer = null; return; }
    const t = performance.now() - startT;
    let allStopped = true;
    slots.forEach((s, i) => {
      if (s.stopped || !s.el) return; // 멈췄거나 슬롯 DOM이 사라졌으면 무시
      allStopped = false;
      s.el.textContent = allEmojis[(Math.random() * allEmojis.length) | 0];
      if (t > stopAt[i]) finalizeSlot(i);
    });
    if (allStopped) {
      clearInterval(spin);
      if (_chSpinTimer === spin) _chSpinTimer = null;
      setTimeout(() => {
        let evolvedName = null;
        const applyRewards = (mult) => {
          for (const u of rewards) {
            if (u.type === 'evolve') {
              // 진화 적용 전 만렙 상태 재확인 (연타/중복 오픈 방어)
              const w2 = G.weapons[u.id];
              if (w2 && !w2.evolved) {
                w2.evolved = true;
                evolvedName = EVOLUTIONS[u.id];
                showBanner('🌟 ' + WEAPON_DEFS[u.id].name + ' → ' + evolvedName.name + ' 진화!', '#ffd23f');
                shakeCam(10);
                // 진화 폭발 파티클
                const p = G.player;
                for (let k = 0; k < 40; k++) {
                  const a = Math.random() * TAU;
                  G.particles.push({ x: p.x, y: p.y, vx: Math.cos(a) * rand(150, 480), vy: Math.sin(a) * rand(150, 480), life: rand(0.4, 0.9), maxLife: 0.9, size: rand(3, 7), color: choice(['#ffd23f', '#35f0ff', '#ff5d8f', '#ffffff']), grav: 0 });
                }
              }
            } else {
              // 😈 저주 성공: 보상 2배 = 같은 강화 이중 적용
              const times = mult || 1;
              for (let k = 0; k < times; k++) applyUpgrade(u);
            }
          }
        };

        // 😈 저주 상자 제안: 일반 상자(val<4)에서만 제시 — 배팅 순간
        const curseEl = document.getElementById('ch-curse');
        const offerCurse = !isMega && val < 4 && G.state === 'chest' && Math.random() < 0.45;
        if (offerCurse) {
          curseEl.classList.remove('hidden');
          SFX.play('curseoffer');
          const gambleBtn = document.getElementById('ch-curse-gamble');
          const openBtn = document.getElementById('ch-curse-open');
          const resolve = (gamble) => {
            if (G.state !== 'chest') return;
            curseEl.classList.add('hidden');
            if (gamble && Math.random() < 0.55) {
              // 저주 성공! 2배 지급
              SFX.play('cursesuccess');
              POST.triggerChroma(0.5);
              POST.triggerFlash(0.15);
              showBigWin('CURSED ×2!', '😈 저주가 통했다 — 보상 2배!', 'mega');
              shakeCam(9);
              applyRewards(2);
              document.getElementById('ch-result').textContent = rewards.map(u => {
                if (u.type === 'evolve') return '🌟 ' + EVOLUTIONS[u.id].name + ' 진화!';
                const def = u.type === 'weapon' ? WEAPON_DEFS[u.id] : (u.type === 'passive' ? PASSIVE_DEFS[u.id] : u);
                return (def.emoji || u.emoji) + ' ' + (def.name || u.name) + ' ×2';
              }).join(' · ');
            } else if (gamble) {
              // 저주 실패 — 강화 대신 젬 잔돈 (손실의 승리 변장: 표면은 축하 연출)
              SFX.play('cursefail');
              applyRewards(0);
              const n = 26 + (G.minute * 4 | 0);
              for (let i = 0; i < n; i++) {
                const a = Math.random() * TAU;
                G.pickups.push({ kind: 'gem', x: G.player.x, y: G.player.y, val: choice([2, 3, 3, 5]), t: Math.random() * TAU, vx: Math.cos(a) * rand(150, 380), vy: Math.sin(a) * rand(150, 380) });
              }
              showBanner('😈 저주가 폭발했다! 대신 젬 자루가 쏟아진다...', '#b06cff');
              document.getElementById('ch-result').textContent = '💎 보상 대신 젬 자루 ×' + n;
            } else {
              applyRewards(1);
              document.getElementById('ch-result').textContent = rewards.map(u => {
                if (u.type === 'evolve') return '🌟 ' + EVOLUTIONS[u.id].name + ' 진화!';
                const def = u.type === 'weapon' ? WEAPON_DEFS[u.id] : (u.type === 'passive' ? PASSIVE_DEFS[u.id] : u);
                return (def.emoji || u.emoji) + ' ' + (def.name || u.name);
              }).join(' · ');
            }
            SFX.play(evolvedName ? 'evolve' : 'levelup');
            document.getElementById('ch-done').classList.remove('hidden');
          };
          gambleBtn.onclick = () => resolve(true);
          openBtn.onclick = () => resolve(false);
        } else {
          applyRewards(isMega ? 1 : 1);
          SFX.play(evolvedName ? 'evolve' : 'levelup');
          const names = rewards.map(u => {
            if (u.type === 'evolve') return '🌟 ' + EVOLUTIONS[u.id].name + ' 진화!';
            const def = u.type === 'weapon' ? WEAPON_DEFS[u.id] : (u.type === 'passive' ? PASSIVE_DEFS[u.id] : u);
            return (def.emoji || u.emoji) + ' ' + (def.name || u.name);
          }).join(' · ');
          document.getElementById('ch-result').textContent = names;
          document.getElementById('ch-done').classList.remove('hidden');
        }
      }, 350);
    }
  }, 75);

  const doneBtn = document.getElementById('ch-done');
  doneBtn.onclick = () => {
    // 연타 가드: 상자 UI가 이미 닫혔으면 무시
    if (G.state !== 'chest') return;
    document.getElementById('overlay-chest').classList.add('hidden');
    document.getElementById('ch-curse').classList.add('hidden');
    document.getElementById('ch-result').textContent = '';
    G.state = 'playing';
    // 상자 중 적립된 레벨업이 있으면 즉시 오픈 (유실 방지)
    if (G.pendingLevelUps > 0) setTimeout(() => { if (G.state === 'playing') openLevelUp(); }, 60);
    // 모바일 햅틱
    try { if (navigator.vibrate) navigator.vibrate(20); } catch (e) {}
  };
}

/* 🎰 빅 윈 세레머니 — 티어 표시 (killCount 마일스톤 / 메가 체스트 / 저주 성공) */
function showBigWin(tier, amount, cls) {
  const el = document.getElementById('bigwin');
  if (!el) return;
  const tEl = document.getElementById('bigwin-tier');
  const aEl = document.getElementById('bigwin-amount');
  tEl.textContent = tier;
  aEl.textContent = amount || '';
  el.className = cls || '';
  el.classList.remove('hidden');
  // 재시작 애니메이션
  void el.offsetWidth;
  setTimeout(() => el.classList.add('hidden'), 2600);
}

let bannerOnceT = 0;
function showBannerOnce(text) {
  // 슬롯 정지 순간의 짧은 알림 (메인 배너와 충돌하지 않게 짧게)
  SFX.play('pick');
}
