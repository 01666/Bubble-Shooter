import test from 'node:test';
import assert from 'node:assert/strict';
import { ArcadeAnnouncer } from '../../src/feedback/audio/arcade-announcer.mjs';
function fixture() {
  const sources=[],ducks=[];
  const audio={enabled:true,voice:{},voiceSource:null,context:{currentTime:10,createBufferSource(){
    const source={playbackRate:{value:1},connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}};
    sources.push(source);return source;
  }},canPlay(){return this.enabled;},duck(...args){ducks.push(args);}};
  const announcer=new ArcadeAnnouncer(audio);announcer.context=audio.context;
  for(const name of ['nice','wow','awesome','congratulations'])announcer.buffers.set(name,{duration:1});
  return {announcer,audio,sources,ducks};
}
const event=(id,type,payload)=>({eventId:id,type,payload});
test('one committed batch chooses highest human reaction and duplicates cannot repeat it',()=>{
  const {announcer,sources,ducks}=fixture();
  const events=[event('1','comboChanged',{tier:1,previousTier:0,streak:2}),event('2','petSlotResolved',{rewardType:'fullClear'})];
  announcer.consume(events);announcer.update(.02);
  assert.equal(announcer.history[0].id,'congratulations');assert.equal(sources.length,1);assert.deepEqual(ducks[0],[1.15,.28]);
  announcer.consume(events);announcer.update(.02);assert.equal(sources.length,1);
});
test('muting stops current reaction and unmuting never replays the queued win',()=>{
  const {announcer,audio,sources}=fixture();
  announcer.consume([event('1','comboChanged',{tier:2,previousTier:1,streak:3})]);announcer.update(.02);
  assert.equal(announcer.history[0].id,'wow');
  audio.enabled=false;announcer.consume([event('2','petSlotResolved',{rewardType:'tickets'})]);announcer.update(.02);
  assert.equal(sources[0].stopped,true);assert.equal(announcer.pending,null);
  audio.enabled=true;audio.context.currentTime=20;announcer.update(.02);assert.equal(sources.length,1);
});
test('late clips are discarded rather than announcing a stale reward after a voice finishes',()=>{
  const {announcer,audio,sources}=fixture();audio.voiceSource={};
  announcer.consume([event('1','comboChanged',{tier:1,previousTier:0,streak:2})]);
  announcer.update(.7);audio.voiceSource=null;announcer.update(.02);
  assert.equal(sources.length,0);assert.equal(announcer.pending,null);
});
