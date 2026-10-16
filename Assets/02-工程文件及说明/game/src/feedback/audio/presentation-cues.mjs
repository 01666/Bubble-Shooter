// Bind sounds to visual milestones, including exact +1 arrivals. No gameplay writes.
export function createPresentationCues({ audio, scene: r, rewardCounter, getPet }) {
  return function soundCue(c) {
    if (c.name === 'reward-unit-arrive') {
      rewardCounter.arrive(r.clock);
      audio.scoreTick();
      if (!r.reduced) r.rewardPulseAt = r.clock;
    }
    // Pet reactions follow committed stars reaching the chest, then its opening.
    if (c.name === 'target-slot')
      getPet()?.controller.request('target', c.slot === 1 ? 'oneLeft' : 'target');
    if (c.name === 'stage-reveal') getPet()?.controller.request('complete');
    const map = {
      'match-clear': 'clear',
      attach: 'attach',
      'drop-small': 'drop',
      'drop-large': 'drop',
      'tickets-arrive': 'earned',
      'stage-reveal': 'stage_complete',
      'stage-tickets-arrive': 'stage_reward',
    };
    if (c.name === 'charge') audio.playCue('explosion');
    else if (c.name === 'explosion-chain')
      audio.playCue('chain', { rate: 1 + (c.index || 1) * 0.085 });
    else if (c.name === 'target-slot') audio.playCue('target_' + Math.min(3, (c.slot ?? 0) + 1));
    else if (map[c.name]) audio.playCue(map[c.name], { gain: c.name === 'drop-small' ? 0.6 : 1 });
    if (c.name === 'stage-reveal' && audio.canPlay()) {
      audio.finishing = true;
      audio.applyMix();
      audio.later(1.6, () => {
        audio.finishing = false;
        audio.applyMix();
      });
    }
  };
}
