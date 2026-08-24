import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const [baseArg, currentArg] = process.argv.slice(2);
if (!baseArg || !currentArg) throw new Error('Usage: node scripts/verify-growth-review-patch.mjs <base-growth.json> <current-growth.json>');
const base = JSON.parse(await fs.readFile(path.resolve(baseArg), 'utf8'));
const current = JSON.parse(await fs.readFile(path.resolve(currentArg), 'utf8'));

const withoutReviewFields = (value) => {
  const copy = structuredClone(value);
  delete copy.updatedAt;
  delete copy.experiments;
  return copy;
};
if (JSON.stringify(withoutReviewFields(base)) !== JSON.stringify(withoutReviewFields(current))) {
  throw new Error('Growth review may change only updatedAt and experiments');
}

const currentExperiments = new Map(current.experiments.map((experiment) => [experiment.id, experiment]));
for (const prior of base.experiments) {
  const next = currentExperiments.get(prior.id);
  if (!next) throw new Error(`Growth review may not delete experiment ${prior.id}`);
  if (prior.founderDisposition !== 'proposed' && JSON.stringify(prior) !== JSON.stringify(next)) {
    throw new Error(`Growth review may not modify founder-controlled experiment ${prior.id}`);
  }
}
for (const experiment of current.experiments) {
  const prior = base.experiments.find((entry) => entry.id === experiment.id);
  if (!prior || JSON.stringify(prior) !== JSON.stringify(experiment)) {
    if (experiment.status !== 'proposed' || experiment.founderDisposition !== 'proposed') {
      throw new Error(`AI growth review may only create or revise proposed experiments: ${experiment.id}`);
    }
  }
}
if (current.updatedAt < base.updatedAt) throw new Error('Growth review updatedAt cannot move backward');
console.log(JSON.stringify({ growthReviewPatch: 'bounded', experiments: current.experiments.length }, null, 2));
