const fs = require('fs');
let e = fs.readFileSync('js/entities.js', 'utf8');
const sub = (a, b, name) => {
  if (!e.includes(a)) { console.error('MISS:', name); process.exit(1); }
  e = e.split(a).join(b);
};

// ===== 1) 후반 티어4 적 3종 추가 =====
sub(`  thief:  { name: '광산 도적', biomes: [B_CRYSTAL, B_ROCK, B_GRASS, B_DESERT, B_SNOW], tier: 2, hp: 40, spd: 148, r: 15, dmg: 6, xp: 3, color: '#e8b74a', special: 'thief' },
  bomber: { name: '폭탄 박쥐', biomes: [B_VOLCANIC, B_FOREST, B_CRYSTAL], tier: 2, hp: 26, spd: 138, r: 14, dmg: 18, xp: 4, color: '#ff5a4d', special: 'bomber' },`,
`  thief:  { name: '광산 도적', biomes: [B_CRYSTAL, B_ROCK, B_GRASS, B_DESERT, B_SNOW], tier: 2, hp: 40, spd: 148, r: 15, dmg: 6, xp: 3, color: '#e8b74a', special: 'thief' },
  bomber: { name: '폭탄 박쥐', biomes: [B_VOLCANIC, B_FOREST, B_CRYSTAL], tier: 2, hp: 26, spd: 138, r: 14, dmg: 18, xp: 4, color: '#ff5a4d', special: 'bomber' },
  // ===== 티어4: 후반 압박군단 =====
  ruin:   { name: '루인 나이트', biomes: [B_ROCK, B_VOLCANIC, B_CRYSTAL, B_SNOW], tier: 4, hp: 380, spd: 96, r: 24, dmg: 30, xp: 25, color: '#c23a4e', special: 'knight' },
  stealer:{ name: '소울스틸러', biomes: [B_CRYSTAL, B_ROCK, B_VOLCANIC], tier: 4, hp: 300, spd: 160, r: 19, dmg: 16, xp: 30, color: '#9b59d0', special: 'stealer' },
  titan:  { name: '티타늄 골렘', biomes: [B_VOLCANIC, B_ROCK], tier: 4, hp: 1500, spd: 40, r: 34, dmg: 44, xp: 60, color: '#8a95a8', special: 'armor' },`, 'tier4-add');

// ===== 2) 스폰 가중치에 tier4 추가 =====
sub(`  const tw = {
    1: 10,
    2: m < 1.5 ? 0 : Math.min(2 + m * 1.4, 10),
    3: m < 4 ? 0 : Math.min(1 + (m - 4) * 0.8, 8),
  };`,
`  const tw = {
    1: Math.max(2, 10 - m * 0.9),                        // 잡몹은 점차 감소
    2: m < 1.5 ? 0 : Math.min(2 + m * 1.4, 10),
    3: m < 4 ? 0 : Math.min(1 + (m - 4) * 0.8, 9),
    4: m < 8 ? 0 : Math.min(0.8 + (m - 8) * 0.55, 5),   // 8분부터 후반 군단
  };`, 'tier4-weight');

// ===== 3) HP 스케일링 지수 강화 =====
sub(`  const hpMul = 1 + m * 0.45 + m * m * 0.13;
  const dmgMul = 1 + m * 0.11;`,
`  const hpMul = 1 + m * 0.5 + m * m * 0.24;   // 20분: 1+10+96=107배 계수 성분 (티어4는 별도)
  const dmgMul = 1 + m * 0.16;`, 'hp-curve');

// ===== 4) 엘리트 특수 능력 =====
sub(`  if (opts.elite) {
    e.r *= 1.45; e.hp *= 7; e.maxHp = e.hp; e.dmg *= 1.4; e.xp *= 5; e.spd *= 0.92;
  }`,
`  if (opts.elite) {
    e.r *= 1.45; e.hp *= 7; e.maxHp = e.hp; e.dmg *= 1.4; e.xp *= 5; e.spd *= 0.92;
    // 엘리트 특수 능력 (40% 확률)
    const abil = choice(['swift', 'regen', 'splitter']);
    e.abil = abil;
    if (abil === 'swift') e.spd *= 1.45;
    if (abil === 'splitter') e.splitOnDeath = true;
  }`, 'elite-abil');

// ===== 5) 분열 능력 사망 처리 + 재생 AI =====
sub(`  // 분열 슬라임 → 꼬마 2마리 분열
  if (e.type === 'splitter') {`,
`  // 엘리트 분열 능력 사망
  if (e.splitOnDeath && !e.boss) {
    for (let i = 0; i < 2; i++) {
      const m2 = spawnEnemy(e.x + rand(-24, 24), e.y + rand(-24, 24), e.type, {});
      m2.hp = m2.maxHp = e.maxHp * 0.3;
      m2.dmg *= 0.7; m2.r *= 0.7; m2.xp = Math.ceil(e.xp * 0.15);
    }
  }
  // 분열 슬라임 → 꼬마 2마리 분열
  if (e.type === 'splitter') {`, 'elite-split');

// ===== 6) 티어4 AI 로직 =====
sub(`      // 광산 도적: 플레이어에게서 도망! 잡으면 젬 대량 드롭`,
`      // ===== 티어4 AI =====
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

      // 광산 도적: 플레이어에게서 도망! 잡으면 젬 대량 드롭`, 'tier4-ai');

// ===== 7) 아머 판정 (damageEnemy) =====
sub(`/* 적 피해 처리 */
function damageEnemy(e, dmg, canCrit = true, knockAng = null) {
  let crit = false;
  if (canCrit && Math.random() < G.player.critC) { dmg *= G.player.critD; crit = true; }`,
`/* 적 피해 처리 */
function damageEnemy(e, dmg, canCrit = true, knockAng = null) {
  let crit = false;
  if (canCrit && Math.random() < G.player.critC) { dmg *= G.player.critD; crit = true; }
  // 티타늄 아머: 총 피해의 12%만 관통 + 최소 6 고정 — 탱커 처치엔 화력 집중 필요
  if (e.def && e.def.special === 'armor') {
    dmg = Math.max(6, dmg * 0.12);
  }`, 'armor');

// ===== 8) 보스 재보강 =====
sub(`const BOSSES = [
  { min: 5,  id: 'slimeking', name: '슬라임 킹',   color: '#2ecc71', r: 52, hp: 900,  spd: 62, dmg: 22 },
  { min: 10, id: 'scorpking', name: '전갈 왕',     color: '#ff9f1c', r: 56, hp: 3200, spd: 74, dmg: 28 },
  { min: 15, id: 'frostgiant',name: '서리 거인',   color: '#9bd3ff', r: 62, hp: 9000, spd: 58, dmg: 34 },
  { min: 20, id: 'dopdemon',  name: '도파민 데몬', color: '#ff2d95', r: 66, hp: 22000, spd: 66, dmg: 42, final: true },
];`,
`const BOSSES = [
  { min: 5,  id: 'slimeking', name: '슬라임 킹',   color: '#2ecc71', r: 52, hp: 1400,  spd: 68, dmg: 26 },
  { min: 10, id: 'scorpking', name: '전갈 왕',     color: '#ff9f1c', r: 56, hp: 5200, spd: 80, dmg: 34 },
  { min: 15, id: 'frostgiant',name: '서리 거인',   color: '#9bd3ff', r: 62, hp: 15000, spd: 62, dmg: 42, summons: true },
  { min: 20, id: 'dopdemon',  name: '도파민 데몬', color: '#ff2d95', r: 66, hp: 34000, spd: 72, dmg: 52, final: true, summons: true },
];`, 'boss-buff');

// ===== 9) 보스 소환 패턴 =====
sub(`          else {
            // 방사형 탄막
            const n = 10 + (e.bossDef.final ? 6 : 0);
            for (let k = 0; k < n; k++) {
              const a = (k / n) * TAU + Math.random() * 0.3;
              G.eProjectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, r: 9, dmg: e.dmg * 0.5, life: 3.2, color: e.color });
            }
            SFX.play('shoot');
          }`,
`          else if (e.bossDef.summons && Math.random() < 0.45) {
            // 소환: 부하 3~4마리
            const n = 3 + (e.bossDef.final ? 1 : 0);
            showBanner('👑 ' + e.bossDef.name + '이(가) 부하를 부른다!', e.color);
            SFX.play('portal', e.x);
            for (let k = 0; k < n; k++) {
              const a = (k / n) * TAU;
              const sx = e.x + Math.cos(a) * 90, sy = e.y + Math.sin(a) * 90;
              const b = MapGen.biome(Math.floor(sx / TILE), Math.floor(sy / TILE));
              const m2 = spawnEnemy(sx, sy, pickEnemyForBiome(b, { 1: 0, 2: 10, 3: 6, 4: m > 8 ? 2 : 0 }), {});
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
          }`, 'boss-summon');

// ===== 10) 스폰 밀도 상향 =====
sub(`  const target = Math.min(14 + m * 11, 110);`,
`  const target = Math.min(14 + m * 13, 160);`, 'density');

fs.writeFileSync('js/entities.js', e);
console.log('enemy overhaul ok');
