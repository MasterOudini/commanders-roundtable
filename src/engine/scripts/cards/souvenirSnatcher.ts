// `Souvenir Snatcher` - a mutates trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SOUVENIR_SNATCHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SOUVENIR_SNATCHER, "Mutate {5}{U} (If you cast this spell for its mutate cost, put it over or under target non-Human creature you own. They mutate into the creature on top plus all abilities from under it.)\nFlying\nWhenever this creature mutates, gain control of target noncreature artifact.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Gain control of target noncreature artifact.", SOUVENIR_SNATCHER.name);
const VOCAB_T_L2 = vocabularyTargets("Gain control of target noncreature artifact.");

export const SOUVENIR_SNATCHER_SCRIPT: CardScript = {
  oracleId: SOUVENIR_SNATCHER.oracleId,
  name: SOUVENIR_SNATCHER.name,
  triggers: [
    {
      abilityId: 'mutates-2',
      text: LINES[2] as string,
      event: 'Mutated',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) => ev.t === 'Mutated' && ev.host === self,
      label: () => "Souvenir Snatcher - Gain control of target noncreature artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
