// `Trudge Garden` - a youGainLife trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TRUDGE_GARDEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TRUDGE_GARDEN, "Whenever you gain life, you may pay {2}. If you do, create a 4/4 green Fungus Beast creature token with trample.");

const VOCAB_L0 = vocabularyEffects("You may pay {2}. If you do, create a 4/4 green Fungus Beast creature token with trample.", TRUDGE_GARDEN.name);
const VOCAB_T_L0 = vocabularyTargets("You may pay {2}. If you do, create a 4/4 green Fungus Beast creature token with trample.");

export const TRUDGE_GARDEN_SCRIPT: CardScript = {
  oracleId: TRUDGE_GARDEN.oracleId,
  name: TRUDGE_GARDEN.name,
  triggers: [
    {
      abilityId: 'youGainLife-0',
      text: PRINTED,
      event: 'LifeChanged',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'LifeChanged' && ev.delta > 0 && ev.player === ctx.query.controllerOf(self),
      label: () => "Trudge Garden - You may pay {2}. If you do, create a 4/4 green Fungus Beast creature token with trample.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
