// `Chittering Harvester` - a mutates trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHITTERING_HARVESTER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(CHITTERING_HARVESTER, "Mutate {4}{B} (If you cast this spell for its mutate cost, put it over or under target non-Human creature you own. They mutate into the creature on top plus all abilities from under it.)\nWhenever this creature mutates, each opponent sacrifices a creature of their choice.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Each opponent sacrifices a creature of their choice.", CHITTERING_HARVESTER.name);
const VOCAB_T_L1 = vocabularyTargets("Each opponent sacrifices a creature of their choice.");

export const CHITTERING_HARVESTER_SCRIPT: CardScript = {
  oracleId: CHITTERING_HARVESTER.oracleId,
  name: CHITTERING_HARVESTER.name,
  triggers: [
    {
      abilityId: 'mutates-1',
      text: LINES[1] as string,
      event: 'Mutated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'Mutated' && ev.host === self,
      label: () => "Chittering Harvester - Each opponent sacrifices a creature of their choice.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
