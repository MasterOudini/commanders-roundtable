// `Plant Elemental` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PLANT_ELEMENTAL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PLANT_ELEMENTAL, "When this creature enters, sacrifice it unless you sacrifice a Forest.");

const VOCAB_L0 = vocabularyEffects("Sacrifice it unless you sacrifice a Forest.", PLANT_ELEMENTAL.name);
const VOCAB_T_L0 = vocabularyTargets("Sacrifice it unless you sacrifice a Forest.");

export const PLANT_ELEMENTAL_SCRIPT: CardScript = {
  oracleId: PLANT_ELEMENTAL.oracleId,
  name: PLANT_ELEMENTAL.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Plant Elemental - Sacrifice it unless you sacrifice a Forest.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
