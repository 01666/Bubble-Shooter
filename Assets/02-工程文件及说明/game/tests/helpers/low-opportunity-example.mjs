// Extract a small exact event sequence from the recorded core run; no invented outcomes.
import fs from 'node:fs';
const sample = JSON.parse(
    fs.readFileSync(new URL('../fixtures/low-opportunity-events.json', import.meta.url)),
  ),
  appeared = sample.events.find((e) => e.type === 'lowOpportunityAppeared'),
  opportunityId = appeared.payload.opportunityId,
  qualified = sample.events.find(
    (e) => e.type === 'lowOpportunityQualified' && e.payload.opportunityId === opportunityId,
  ),
  consumed = sample.events.find(
    (e) =>
      e.type === 'lowOpportunityFinished' &&
      e.payload.opportunityId === opportunityId &&
      e.payload.status === 'consumed',
  ),
  shots = new Set([qualified.causeId, appeared.causeId, consumed.causeId]);
const result = {
  interfaceVersion: 2,
  status: 'excerpt-of-actual-core-run-not-human-play',
  opportunityId,
  checkpoints: sample.checkpoints.filter(
    (c) => c.snapshot.lowOpportunity.last?.opportunityId === opportunityId,
  ),
  events: sample.events.filter((e) => shots.has(e.causeId)),
  deferralExample: sample.events.filter((e) => e.payload.opportunityId === 'low-opportunity-1'),
};
fs.writeFileSync(
  new URL('../fixtures/low-opportunity-example.json', import.meta.url),
  JSON.stringify(result, null, 2),
);
console.log(
  JSON.stringify({
    opportunityId,
    events: result.events.length,
    checkpoints: result.checkpoints.length,
  }),
);
