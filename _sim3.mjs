import WebSocket from 'ws';
const url = "ws://localhost:9222/devtools/page/68BA607A2349574C2C59B856E56C1381";
const ws = new WebSocket(url);
let id = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise(res => {
  const i = ++id; pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});
ws.on('message', d => {
  const m = JSON.parse(d);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
await new Promise(r => ws.on('open', r));

// awaitPromise + returnByValue로 결과 확실 수신 (5분씩 3청크: 15분까지)
for (let c = 0; c < 3; c++) {
  const rc = await send('Runtime.evaluate', {
    expression: `(async () => {
      for (let i = 0; i < 300; i++) { update(1/60); if (G.state === 'gameover' || G.state === 'victory') break; }
      const mm = Math.round(G.minute);
      const t4 = G.enemies.filter(e => e.def && e.def.tier === 4).length;
      const el = G.enemies.filter(e => e.elite).length;
      return { at: mm + 'min', state: G.state, hp: Math.round(G.player.hp) + '/' + G.player.maxHp,
        enemies: G.enemies.length, t4, elite: el, lv: G.player.level, kills: G.stats.kills };
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  console.log('CHK' + c + ':', JSON.stringify(rc.result.value));
  if (rc.result.value && (rc.result.value.state === 'gameover' || rc.result.value.state === 'victory')) break;
}
ws.close(); process.exit(0);
