import test from 'node:test';
import assert from 'node:assert/strict';
import { EffectsUI } from '../../src/feedback/effects-ui/effects-ui.mjs';
import { RewardCounter } from '../../src/feedback/effects-ui/reward-counter.mjs';

test('slot aggregate tickets arrive once and release confirmed debits without a paid shot event', () => {
  const counter = new RewardCounter();
  const ui = new EffectsUI({
    canvas: { getContext: () => ({ clearRect() {} }) },
    onCue: (cue) => { if (cue.name === 'reward-unit-arrive') counter.arrive(ui.clock); },
  });
  counter.observe({earned:0,confirmed:0,pending:0},0);
  counter.observe({earned:12,confirmed:12,pending:0},0);
  const event = {eventId:'event-1',revision:1,type:'petSlotResolved',payload:{spinId:'pet-spin-1',actualTicketDelta:12,removed:[]}};
  ui.consume([event,event]);
  for(let clock=0;clock<5;clock+=0.025) {
    ui.clock=clock;
    ui.rewardFlights.update(clock);
    counter.observe({earned:12,confirmed:12,pending:0},clock);
  }
  assert.equal(ui.rewardFlights.arrivals,12);
  assert.equal(counter.waiting,0);
  assert.equal(counter.debits,0);
  assert.equal(counter.value,0);
});

test('slot stage reward belongs to its aggregate flight and creates no orphan shot narrative', () => {
  const ui = new EffectsUI({canvas:{getContext:()=>({clearRect(){}})}});
  ui.consume([
    {eventId:'event-1',revision:1,type:'stageBonusEarned',payload:{shotId:'pet-spin-1',rewardSource:'petSlots',count:8}},
    {eventId:'event-2',revision:1,type:'petSlotResolved',payload:{spinId:'pet-spin-1',actualTicketDelta:80,removed:[{id:'gone',x:0,y:7}]}},
  ]);
  assert.equal(ui.pending.size,0);
  assert.equal(ui.rewardFlights.queue.length,1);
  assert.equal(ui.rewardFlights.queue[0].count,80);
  assert.equal(ui.diagnostics.length,0);
});
