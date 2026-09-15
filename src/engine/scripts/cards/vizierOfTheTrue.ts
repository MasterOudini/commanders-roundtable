// `Vizier of the True` - a youExertCreature trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VIZIER_OF_THE_TRUE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VIZIER_OF_THE_TRUE, "You may exert this creature as it attacks. (It won't untap during your next untap step.)\nWhenever you exert a creature, tap target creature an opponent controls.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Tap target creature an opponent controls.", VIZIER_OF_THE_TRUE.name);
const VOCAB_T_L1 = vocabularyTargets("Tap target creature an opponent controls.");

export const VIZIER_OF_THE_TRUE_SCRIPT: CardScript = {
  oracleId: VIZIER_OF_THE_TRUE.oracleId,
  name: VIZIER_OF_THE_TRUE.name,
  triggers: [
    {
      abilityId: 'youExertCreature-1',
      text: LINES[1] as string,
      event: 'Exerted',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) => ev.t === 'Exerted' && ev.player === ctx.query.controllerOf(self),
      label: () => "Vizier of the True - Tap target creature an opponent controls.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
