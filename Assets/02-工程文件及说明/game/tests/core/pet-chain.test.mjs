import test from 'node:test';
import assert from 'node:assert/strict';
import { EndlessGame, MemoryStore } from '../../src/core/index.mjs';
import { startPetSlot, chargePet } from '../../src/core/pet-slots.mjs';
function progress() {
  const g=new EndlessGame();g.coin({receiptId:'chain'});
  g.tx(s=>{s.petSlots.charge=2;s.petSlots.chainRemaining=6;s.combo={streak:2,tier:1,lastShotId:'prior'};});
  return g;
}
test('idle timeout clears only partial charge and combo, with no ticket/ammo loss',()=>{
  const g=progress(),before=g.exportState();
  for(let i=0;i<25;i++)g.advance(.25);
  assert.equal(g.s.petSlots.charge,0);assert.equal(g.s.combo.streak,0);
  assert.deepEqual(g.s.ledger,before.ledger);assert.equal(g.s.paidAmmo,before.paidAmmo);
});
test('a miss clears partial charge, free and refunded shots do not qualify or clear it',()=>{
  const g=progress();
  g.tx((s,e)=>{chargePet(g,s,{mode:'free',shotId:'free'},s.board[0],[],e);chargePet(g,s,{mode:'paid',shotId:'refund'},null,[],e);});
  assert.equal(g.s.petSlots.charge,2);assert.equal(g.s.petSlots.chainRemaining,6);
  g.tx((s,e)=>chargePet(g,s,{mode:'paid',shotId:'miss'},s.board[0],[],e));
  assert.equal(g.s.petSlots.charge,0);assert.equal(g.s.petSlots.chainRemaining,0);
});
test('expired next-round partial never cancels an awarded spin or queued complete triples',()=>{
  const g=progress();g.tx((s,e)=>{startPetSlot(g,s,e,'won');s.petSlots.queuedCharge=4;s.petSlots.chainRemaining=.05;});
  const pending=structuredClone(g.s.petSlots.pending);g.advance(.1);
  assert.deepEqual(g.s.petSlots.pending,pending);assert.equal(g.s.petSlots.queuedCharge,3);
  assert.equal(g.s.petSlots.state,'spinning');assert.equal(g.s.petSlots.charge,3);
});
test('pause and refresh preserve countdown; forced wave and its entry grace do not consume it',()=>{
  const g=progress();g.advance(0);assert.equal(g.s.petSlots.chainRemaining,6);
  const restored=new EndlessGame({store:new MemoryStore(g.exportState())});assert.equal(restored.s.petSlots.chainRemaining,6);
  restored.tx(s=>{s.content.flow.pending={rows:1,delay:2,shotId:'wave',cause:'pressureWave'};});
  restored.advance(.25);assert.equal(restored.s.petSlots.chainRemaining,6);
  for(let i=0;i<7;i++)restored.advance(.25);
  assert.equal(restored.s.petSlots.chainRemaining,6);assert.equal(restored.s.petSlots.chainGrace,.55);
  restored.advance(.25);assert.equal(restored.s.petSlots.chainRemaining,6);
});
test('a paid shot fired in time can finish its successful landing after the timer reaches zero',()=>{
  const g=progress();let move,color;
  for(const c of g.config.colors){const m=g.opportunities(c).sort((a,b)=>b.direct.length-a.direct.length)[0];if(m?.direct.length&&(!move||m.direct.length>move.direct.length)){move=m;color=c;}}
  assert.ok(move);g.tx(s=>{s.loadedColor=color;s.petSlots.chainRemaining=.01;});g.setAim(move.angle);g.fire();g.advance(.02);
  assert.equal(g.s.petSlots.chainRemaining,0);assert.equal(g.s.petSlots.deadlineShotId,g.s.projectile.shotId);assert.equal(g.s.petSlots.charge,2);
  for(let i=0;i<150&&g.s.projectile;i++)g.advance(.05);
  assert.equal(g.s.petSlots.state,'spinning');assert.equal(g.s.petSlots.sequence,1);
});

test('full clear replaces stale two-row plan with a single complete 7–8-row incoming wave',()=>{
  let g;
  for(let seed=1;seed<1000;seed++) {
    const candidate=new EndlessGame({seed});candidate.tx((s,e)=>startPetSlot(candidate,s,e,'clear'));
    if(candidate.s.petSlots.pending.rewardType==='fullClear'){g=candidate;break;}
  }
  assert.ok(g);g.tx(s=>{s.content.flow.pending={rows:2,delay:10,shotId:'old-shallow',cause:'recoveryWave'};});
  for(let i=0;i<11;i++)g.advance(.25);
  assert.equal(g.s.board.length,0);assert.equal(g.s.content.flow.pending.cause,'emptyBoardWave');
  assert.ok([7,8].includes(g.s.content.flow.pending.rows));const rows=g.s.content.flow.pending.rows;
  const seen=[];for(let i=0;i<10&&g.s.content.flow.pending;i++){g.advance(.25);seen.push(g.s.board.length);}
  assert.equal(g.s.board.length,rows*g.config.cols);assert.ok(seen.every(n=>n===0||n===rows*g.config.cols));
  g.validate(g.s);
});
