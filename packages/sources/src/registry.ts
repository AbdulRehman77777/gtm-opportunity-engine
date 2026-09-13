import { AshbySource } from './ashby.js';
import { GreenhouseSource } from './greenhouse.js';
import { LeverSource } from './lever.js';
import type { OpportunitySource } from './types.js';

const sources = new Map<string, OpportunitySource>([
  ['GREENHOUSE', new GreenhouseSource()], ['LEVER', new LeverSource()], ['ASHBY', new AshbySource()]
]);

export function getSourceAdapter(kind: string): OpportunitySource {
  const source = sources.get(kind);
  if (!source) throw new Error(`No remote adapter registered for ${kind}`);
  return source;
}
