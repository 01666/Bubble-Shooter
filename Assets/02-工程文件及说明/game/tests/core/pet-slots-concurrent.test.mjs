import test from 'node:test';
import assert from 'node:assert/strict';
import { EndlessGame, MemoryStore } from '../../src/core/index.mjs';
import { startPetSlot, chargePet } from '../../src/core/pet-slots.mjs';
function fixture(type) {
  for(let seed=1;seed<1000;seed++) {
    const events=[],g=new EndlessGame({seed,onEvent:e=>events.push(e)});
    g.coin({receiptId:'concurrent',coins:3});
    g.tx((s,emit)=>startPetSlot(g,s,emit,'fixture'));
    if(g.s.petSlots.pending.rewardType===type)return {g,events};
  }
  throw Error('Missing fixture');
}
function bestShot(g) {
  let move,color;
  for(const c of g.config.colors) {
    const m=g.opportunities(c).sort((a,b)=>b.direct.length-a.direct.length)[0];
    if(m?.direct.length&&(!move||m.direct.length>move.direct.length)){move=m;color=c;}
  }
  assert.ok(move);g.tx(s=>{s.loadedColor=color;});g.setAim(move.angle);
}
for(const type of ['tickets','ammo','specials','lightning','dual','fullClear'])
test('shoot during '+type+' spin, restore in flight, then settle live reward once',()=>{
  const {g,events}=fixture(type);const pending=structuredClone(g.s.petSlots.pending),rng=g.s.petSlots.rng;
  bestShot(g);assert.equal(g.fire(),true);g.advance(.05);
  assert.ok(g.s.projectile);assert.equal(g.s.petSlots.state,'spinning');
  const restored=new EndlessGame({store:new MemoryStore(g.exportState()),onEvent:e=>events.push(e)});
  assert.deepEqual(restored.s.petSlots.pending,pending);
  for(let i=0;i<120&&restored.s.petSlots.state==='spinning';i++)restored.advance(.05);
  const result=restored.s.petSlots.lastResult;
  assert.equal(result.spinId,pending.spinId);assert.equal(restored.s.petSlots.rng,rng);
  assert.equal(events.filter(e=>e.type==='petSlotResolved').length,1);
  assert.ok(events.some(e=>e.type==='paidShotResolved'));
  assert.ok(events.some(e=>e.type==='petChargeQueued'));
  assert.equal(restored.s.petSlots.charge,1,'the successful shot charges the next round');
  assert.ok(result.actualTicketDelta>0||result.actualAmmoDelta>0||result.added.length||result.rewardType==='dual');
  restored.validate(restored.s);
});

test('expired clear waits only for the current projectile, not for a new charge or replay',()=>{
  const {g,events}=fixture('fullClear');
  g.advance(.25);g.tx(s=>{s.petSlots.remaining=.01;});bestShot(g);assert.equal(g.fire(),true);
  g.advance(.02);assert.ok(g.s.projectile);assert.equal(g.s.petSlots.remaining,0);
  assert.equal(events.filter(e=>e.type==='petSlotResolved').length,0);
  for(let i=0;i<150&&g.s.petSlots.state==='spinning';i++)g.advance(.05);
  assert.equal(events.filter(e=>e.type==='petSlotResolved').length,1);
  assert.equal(g.s.projectile,null);g.validate(g.s);
});

test('disappeared special targets turn into a guaranteed ticket prize without new inventory',()=>{
  const {g,events}=fixture('specials');
  g.tx(s=>{s.content.credit+=s.board.filter(b=>b.source==='system').length;s.board=[];s.stage.targetIds=[];s.stage.collectedIds=[];s.network.id=null;});
  for(let i=0;i<11;i++)g.advance(.25);
  assert.equal(g.s.petSlots.lastResult.rewardType,'tickets');
  assert.equal(g.s.petSlots.lastResult.fallbackFrom,'specials');
  assert.equal(g.s.petSlots.lastResult.actualTicketDelta,12);
  assert.equal(events.filter(e=>e.type==='petSlotResolved').length,1);g.validate(g.s);
});

test('three queued successes start a second spin and extra charge is preserved after it',()=>{
  const {g,events}=fixture('tickets');
  for(let i=0;i<4;i++)g.tx((s,emit)=>chargePet(g,s,{mode:'paid',shotId:'queued-'+i},s.board[0],[s.board[1]],emit));
  assert.equal(g.s.petSlots.queuedCharge,4);
  for(let i=0;i<11;i++)g.advance(.25);
  assert.equal(events.filter(e=>e.type==='petSlotResolved').length,1);
  assert.equal(g.s.petSlots.state,'spinning');assert.equal(g.s.petSlots.queuedCharge,1);
  for(let i=0;i<11;i++)g.advance(.25);
  assert.equal(events.filter(e=>e.type==='petSlotResolved').length,2);
  assert.equal(g.s.petSlots.state,'charging');assert.equal(g.s.petSlots.charge,1);
});

test('old blocking spin save removes only its animation lock and preserves prize',()=>{
  const {g}=fixture('tickets'),saved=g.exportState(),pending=structuredClone(g.s.petSlots.pending);
  delete saved.petSlots.concurrentVersion;delete saved.petSlots.queuedCharge;saved.cooldown=2.6;
  const restored=new EndlessGame({store:new MemoryStore(saved)});
  assert.deepEqual(restored.s.petSlots.pending,pending);
  assert.equal(restored.s.cooldown,restored.config.cooldown);
  restored.advance(.25);assert.equal(restored.fire(),true);
});
