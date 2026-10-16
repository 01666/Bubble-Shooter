import test from 'node:test';
import assert from 'node:assert/strict';
import { EndlessGame, MemoryStore } from '../../src/core/index.mjs';
import { startPetSlot, chargePet, SLOT_REWARDS } from '../../src/core/pet-slots.mjs';
import { recordCombo } from '../../src/core/combo.mjs';
function seedFor(type) {
  let lower=0;
  for(const r of SLOT_REWARDS) { if(r.type===type) break; lower+=r.weight; }
  const upper=lower+SLOT_REWARDS.find(r=>r.type===type).weight;
  for(let seed=0;seed<100000;seed++) {
    const roll=((Math.imul(seed,1664525)+1013904223)>>>0)/4294967296*100;
    if(roll>=lower && roll<upper) return seed;
  }
  throw Error('No seed');
}
function start(type, g=new EndlessGame(), events=[]) {
  g.onEvent=e=>events.push(e);
  g.tx((s,emit)=>{ s.petSlots.rng=seedFor(type); startPetSlot(g,s,emit,'fixture'); });
  return g;
}
function finish(g) {for(let i=0;i<11;i++)g.advance(.25);}
for(const type of SLOT_REWARDS.map(r=>r.type)) test('pet reward '+type+' actually settles once and conserves inventory/ammo',()=>{
  const events=[],g=start(type,new EndlessGame(),events), before=g.snapshot();
  assert.equal(before.petSlots.pending.rewardType,type);
  const board=g.exportState().board, rng=g.s.petSlots.rng;
  assert.equal(g.s.cooldown,0); g.advance(0);
  assert.deepEqual(g.s.board,board);
  finish(g);
  const after=g.snapshot(), result=after.petSlots.lastResult;
  assert.equal(result.rewardType,type); assert.equal(g.s.petSlots.rng,rng);
  assert.equal(events.filter(e=>e.type==='petSlotResolved').length,1);
  assert.ok(result.actualTicketDelta>0 || result.actualAmmoDelta>0 || result.added.length>0 || type==='dual');
  if(type==='ammo') {assert.equal(after.paidAmmo-before.paidAmmo,result.count);assert.equal(after.ammoBonusTotal,result.count);}
  if(type==='specials') {assert.equal(result.added.length,result.count);assert.equal(after.board.length,before.board.length);assert.ok(result.added.every(b=>board.some(a=>a.id===b.id&&a.color===b.color)));}
  if(type==='lightning') {assert.ok(result.electricPaths.length>0); for(const edge of result.electricPaths){const a=board.find(b=>b.id===edge.fromId),b=board.find(b=>b.id===edge.toId);assert.ok(g.neighbors(a.r,a.c,g.s.parity).some(([r,c])=>r===b.r&&c===b.c));} }
  if(type==='fullClear') {assert.equal(result.direct.length,before.board.length); assert.equal(after.board.length,0);assert.ok(g.s.content.flow.pending);}
  const credit=g.s.ammoBonus.total, charge=g.s.petSlots.charge, combo=g.s.combo;
  g.validate(g.s); g.advance(.25);
  assert.equal(events.filter(e=>e.type==='petSlotResolved').length,1);
  assert.equal(g.s.ammoBonus.total,credit);assert.equal(charge,0);assert.deepEqual(g.s.combo,combo);
});
test('refresh locks draw, remaining duration and result; resolves exactly once across reload',()=>{
  const events=[],g=start('tickets',new EndlessGame(),events);
  g.advance(.25); const state=g.exportState();
  const restored=new EndlessGame({store:new MemoryStore(state),onEvent:e=>events.push(e)});
  assert.deepEqual(restored.snapshot().petSlots,g.snapshot().petSlots);
  finish(restored); const result=restored.snapshot().petSlots.lastResult;
  const second=new EndlessGame({store:new MemoryStore(restored.exportState()),onEvent:e=>events.push(e)});
  finish(second);assert.deepEqual(second.snapshot().petSlots.lastResult,result);
  assert.equal(events.filter(e=>e.type==='petSlotStarted').length,1);
  assert.equal(events.filter(e=>e.type==='petSlotResolved').length,1);
});
test('unavailable special/clear/dual rewards become fixed explicit ticket fallback before animation',()=>{
  for(const type of ['specials','lightning','fullClear','dual']) {
    const g=new EndlessGame();
    g.tx(s=>{s.content.credit+=s.board.filter(b=>b.source==='system').length;s.board=[];s.network.id=null;s.stage.targetIds=[];});
    start(type,g); const pending=structuredClone(g.s.petSlots.pending);
    assert.equal(pending.rewardType,'tickets');assert.equal(pending.fallbackFrom,type);assert.equal(pending.count,12);
    finish(g);assert.equal(g.s.petSlots.lastResult.actualTicketDelta,12);
  }
});
test('combo and pet charge count paid landing once, miss resets partial charge, refunds preserve',()=>{
  const g=new EndlessGame(),events=[];
  g.tx((s,emit)=>{
    const success=[s.board[0]],p=id=>({shotId:id,mode:'paid'});
    for(let i=1;i<=2;i++){recordCombo(s,'s'+i,{},success,emit);chargePet(g,s,p('s'+i),{},success,emit);}
    assert.equal(s.combo.tier,1);assert.equal(s.petSlots.charge,2);
    recordCombo(s,'s2',{},success,emit);chargePet(g,s,p('s2'),{},success,emit);
    assert.equal(s.combo.streak,2);assert.equal(s.petSlots.charge,2);
    recordCombo(s,'refund',null,[],emit);chargePet(g,s,p('refund'),null,[],emit);
    assert.equal(s.combo.streak,2);
    recordCombo(s,'miss',{},[],emit);chargePet(g,s,p('miss'),{},[],emit);
    assert.equal(s.combo.streak,0);assert.equal(s.petSlots.charge,0);
    for(let i=3;i<=5;i++)chargePet(g,s,p('s'+i),{},success,emit);
  });
  assert.equal(g.s.petSlots.state,'spinning');assert.equal(g.s.petSlots.charge,3);
});
test('slot start/save failure publishes nothing and cannot consume a durable draw',()=>{
  const store=new MemoryStore(),events=[],g=new EndlessGame({store,onEvent:e=>events.push(e)}),before=g.exportState();
  store.save=()=>{throw Error('disk unavailable');};
  assert.throws(()=>g.tx((s,emit)=>startPetSlot(g,s,emit,'fail')),/disk unavailable/);
  assert.deepEqual(g.exportState(),before);assert.equal(events.length,0);
});
test('old charging save migrates charge, old ready/inFlight qualification is preserved and legacy mode remains fixed',()=>{
  const old=new EndlessGame({petSlotsEnabled:false});old.tx(s=>{s.assist.charge=2;});
  let state=old.exportState();delete state.petSlots;delete state.combo;
  const upgraded=new EndlessGame({store:new MemoryStore(state)});
  assert.equal(upgraded.s.petSlots.charge,2);assert.equal(upgraded.s.assist.charge,0);
  const legacy=new EndlessGame({store:new MemoryStore(old.exportState())});
  assert.equal(legacy.s.petSlots.mode,'legacy');assert.equal(legacy.s.assist.charge,2);
  old.tx(s=>Object.assign(s.assist,{charge:3,state:'ready',sequence:1,boostId:'assist-1',secondaryColor:1}));
  state=old.exportState();delete state.petSlots;
  const ready=new EndlessGame({store:new MemoryStore(state)});
  assert.equal(ready.s.assist.state,'ready');ready.coin({receiptId:'old'});ready.fire();
  assert.equal(ready.s.projectile.assist.boostId,'assist-1');
});

test('real paid trajectories fill exactly three pet charges, start one spin; free flight preserves charge/combo',()=>{
  const events=[],g=new EndlessGame({seed:47,onEvent:e=>events.push(e)});
  g.coin({receiptId:'real',coins:10});
  for(let i=0;i<3;i++) {
    let best=null,color=null;
    for(const c of g.config.colors) {
      const move=g.opportunities(c).sort((a,b)=>b.direct.length-a.direct.length)[0];
      if(move?.direct.length && (!best || move.direct.length>best.direct.length)){best=move;color=c;}
    }
    assert.ok(best,'fixture has a real visible matching route');
    g.tx(s=>{s.loadedColor=color;});g.setAim(best.angle);assert.equal(g.fire(),true);
    for(let j=0;j<200 && g.s.projectile;j++)g.advance(.1);
    if(i<2)for(let j=0;j<30 && (g.s.cooldown || g.s.content.flow.pending);j++)g.advance(.25);
  }
  assert.equal(events.filter(e=>e.type==='petChargeChanged' && e.payload.reason!=='resolved').length,3);
  assert.equal(events.filter(e=>e.type==='petSlotStarted').length,1);
  assert.equal(g.s.combo.streak,3);assert.equal(g.s.combo.tier,2);assert.equal(g.s.petSlots.state,'spinning');
  const free=new EndlessGame();free.tx(s=>{s.combo={streak:3,tier:2,lastShotId:'prior'};s.petSlots.charge=2;});
  const before=free.snapshot();free.fire();for(let j=0;j<200 && free.s.projectile;j++)free.advance(.1);
  assert.deepEqual(free.s.combo,before.combo);assert.equal(free.s.petSlots.charge,2);
});
test('failed payout commit leaves durable pending result and can be recovered once',()=>{
  const store=new MemoryStore(),events=[],g=start('ammo',new EndlessGame({store}),events);
  for(let i=0;i<10;i++)g.advance(.25);
  const before=g.exportState(), originalSave=store.save.bind(store);
  store.save=()=>{throw Error('payout write failed');};
  assert.throws(()=>g.advance(.25),/payout write failed/);
  assert.deepEqual(g.exportState(),before);assert.equal(events.filter(e=>e.type==='petSlotResolved').length,0);
  store.save=originalSave;
  const recovered=new EndlessGame({store,onEvent:e=>events.push(e)});
  recovered.advance(.25);assert.equal(events.filter(e=>e.type==='petSlotResolved').length,1);
  assert.equal(recovered.s.paidAmmo,recovered.s.petSlots.lastResult.count);
});
