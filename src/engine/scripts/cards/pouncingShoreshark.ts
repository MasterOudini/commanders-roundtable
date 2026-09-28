// `Pouncing Shoreshark` - a mutates trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { POUNCING_SHORESHARK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(POUNCING_SHORESHARK, "Mutate {3}{U} (If you cast this spell for its mutate cost, put it over or under target non-Human creature you own. They mutate into the creature on top plus all abilities from under it.)\nFlash\nWhenever this creature mutates, you may return target creature an opponent controls to its owner's hand.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Return target creature an opponent controls to its owner's hand.", POUNCING_SHORESHARK.name);
const VOCAB_T_L2 = vocabularyTargets("Return target creature an opponent controls to its owner's hand.");

export const POUNCING_SHORESHARK_SCRIPT: CardScript = {
  oracleId: POUNCING_SHORESHARK.oracleId,
  name: POUNCING_SHORESHARK.name,
  triggers: [
    {
      abilityId: 'mutates-2',
      text: LINES[2] as string,
      event: 'Mutated',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) => ev.t === 'Mutated' && ev.host === self,
      label: () => "Pouncing Shoreshark - Return target creature an opponent controls to its owner's hand.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
