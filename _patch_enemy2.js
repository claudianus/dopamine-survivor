const fs = require('fs');
let e = fs.readFileSync('js/entities.js', 'utf8');
const sub = (a, b, name) => {
  if (!e.includes(a)) { console.error('MISS:', name); process.exit(1); }
  e = e.split(a).join(b);
};

// 티어4 드로잉 (default 케이스 앞에 삽입)
sub(`    default: {`,
`    case 'ruin': {
      // 붉은 기사: 중갑 실루엣 + 회전 베기 시 검풍 링
      const spinning = (e.spinT || 0) > 0;
      if (spinning) {
        ctx.globalCompositeOperation = 'lighter';
        Glow.draw(ctx, '#ff4d5e', 0, 0, r * 3.4, 0.5);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = 'rgba(255,90,110,0.8)';
        ctx.lineWidth = 4;
        const sa = G.time * 22;
        ctx.beginPath(); ctx.arc(0, 0, r * 1.6, sa, sa + 2.4); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r * 1.9, -sa, -sa + 1.8); ctx.stroke();
      }
      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(0, r * 0.8, r * 0.85, r * 0.3, 0, 0, TAU); ctx.fill();
      // 대검 (등 뒤 대각)
      ctx.save();
      ctx.rotate(0.6);
      ctx.fillStyle = '#5a6270';
      MapGen.rr(ctx, r * 0.5, -r * 1.5, 7, r * 1.8, 3); ctx.fill();
      ctx.fillStyle = '#c9d4e0';
      MapGen.rr(ctx, r * 0.55, -r * 1.45, 3, r * 1.6, 2); ctx.fill();
      ctx.restore();
      // 몸통 중갑
      ctx.fillStyle = body;
      MapGen.rr(ctx, -r * 0.7, -r * 0.8, r * 1.4, r * 1.6, 4); ctx.fill();
      ctx.strokeStyle = glowCol; ctx.lineWidth = 2; ctx.stroke();
      // 투구
      ctx.fillStyle = darken(e.color, 0.3);
      MapGen.rr(ctx, -r * 0.42, -r * 1.15, r * 0.84, r * 0.5, 4); ctx.fill();
      // 아머 디테일
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.1); ctx.lineTo(0, r * 0.15); ctx.lineTo(r * 0.5, -r * 0.1);
      ctx.stroke();
      drawMenaceEyes(ctx, 0, -r * 0.9, r * 0.8, spinning ? '#ff2d3d' : glowCol, dx);
      break;
    }
    case 'stealer': {
      // 보라 유령: 하반신이 흐릿한 망토, 젬 강탈자
      const bobbing = Math.sin(e.wobble * 1.4) * 4;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(0, r * 0.9, r * 0.7, r * 0.24, 0, 0, TAU); ctx.fill();
      // 망토 하체 (갈라지며 소멸)
      const g2 = ctx.createLinearGradient(0, r * 0.2, 0, r * 1.5);
      g2.addColorStop(0, darken(e.color, 0.35));
      g2.addColorStop(1, 'rgba(30,10,50,0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, r * 0.1);
      ctx.quadraticCurveTo(0, r * (1.3 + bobbing * 0.1), r * 0.7, r * 0.1);
      ctx.closePath(); ctx.fill();
      // 몸통
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, r * 0.2); ctx.lineTo(-r * 0.5, -r * 0.7);
      ctx.lineTo(0, -r * 0.95); ctx.lineTo(r * 0.5, -r * 0.7); ctx.lineTo(r * 0.6, r * 0.2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = glowCol; ctx.lineWidth = 1.6; ctx.stroke();
      // 손 (젬 쥔 채 뻗음)
      const reach = Math.sin(e.wobble * 2.2) * 0.2 + 0.8;
      ctx.strokeStyle = body; ctx.lineWidth = r * 0.18; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(-r * 1.1 * reach, r * 0.1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.5, -r * 0.2); ctx.lineTo(r * 1.1 * reach, r * 0.1); ctx.stroke();
      // 훔친 젬 광채
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, '#d0a3ff', 0, -r * 0.3, r * 1.4, 0.3 + Math.sin(e.wobble * 3) * 0.1);
      ctx.globalCompositeOperation = 'source-over';
      drawMenaceEyes(ctx, 0, -r * 0.55, r * 0.85, glowCol, dx);
      break;
    }
    case 'titan': {
      // 거대 강철 골렘: 아머 플레이트 + 관절 발광
      const step = Math.sin(e.wobble * 0.8);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(0, r * 0.9, r * 1.0, r * 0.32, 0, 0, TAU); ctx.fill();
      // 다리 (느린 보행)
      ctx.fillStyle = body;
      MapGen.rr(ctx, -r * 0.55, r * 0.15, r * 0.4, r * 0.85, 3); ctx.fill();
      MapGen.rr(ctx, r * 0.15, r * 0.15, r * 0.4, r * 0.85, 3); ctx.fill();
      // 몸통 (거대 앵글 프레임)
      ctx.fillStyle = body;
      MapGen.rr(ctx, -r * 0.8, -r * 0.75, r * 1.6, r * 1.05, 6); ctx.fill();
      ctx.strokeStyle = '#3a4150'; ctx.lineWidth = 3; ctx.stroke();
      // 아머 플레이트 리벳
      ctx.fillStyle = '#39404e';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.arc(-r * 0.55 + i * r * 0.37, -r * 0.35, r * 0.07, 0, TAU); ctx.fill();
      }
      // 관절 코어 발광 (아머 약점부)
      const coreP = 0.6 + Math.sin(G.time * 5 + e.wobble) * 0.25;
      ctx.globalCompositeOperation = 'lighter';
      Glow.draw(ctx, '#ff8a3d', 0, -r * 0.2, r * 0.6, coreP);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffb06a';
      ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.16, 0, TAU); ctx.fill();
      // 팔 (거대 해머)
      ctx.save();
      ctx.rotate(step * 0.12);
      ctx.fillStyle = body;
      MapGen.rr(ctx, -r * 1.25, -r * 0.55, r * 0.45, r * 1.1, 4); ctx.fill();
      ctx.fillStyle = '#525c6e';
      MapGen.rr(ctx, -r * 1.45, -r * 0.75, r * 0.85, r * 0.6, 5); ctx.fill();
      ctx.restore();
      // 두부 센서
      ctx.fillStyle = '#2a303c';
      MapGen.rr(ctx, -r * 0.3, -r * 1.0, r * 0.6, r * 0.3, 3); ctx.fill();
      drawMenaceEyes(ctx, 0, -r * 0.85, r * 0.5, '#ff8a3d', dx);
      break;
    }
    default: {`, 'tier4-draw');

// 엘리트 재생 AI (이동 로직에서)
sub(`    let sp = e.spd * (e.slow > 0 ? 0.55 : 1) * MapGen.groundSpeed(e.x, e.y) * (e.spawnT > 0 ? 0.25 : 1);`,
`    // 엘리트 재생 능력
    if (e.abil === 'regen' && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt);
    let sp = e.spd * (e.slow > 0 ? 0.55 : 1) * MapGen.groundSpeed(e.x, e.y) * (e.spawnT > 0 ? 0.25 : 1);`, 'regen-ai');

fs.writeFileSync('js/entities.js', e);
console.log('tier4 visuals ok');
