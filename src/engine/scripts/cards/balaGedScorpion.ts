// `Bala Ged Scorpion` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BALA_GED_SCORPION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BALA_GED_SCORPION, "When this creature enters, you may destroy target creature with power 1 or less.");

const VOCAB_L0 = vocabularyEffects("Destroy target creature with power 1 or less.", BALA_GED_SCORPION.name);
const VOCAB_T_L0 = vocabularyTargets("Destroy target creature with power 1 or less.");

export const BALA_GED_SCORPION_SCRIPT: CardScript = {
  oracleId: BALA_GED_SCORPION.oracleId,
  name: BALA_GED_SCORPION.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Bala Ged Scorpion - Destroy target creature with power 1 or less.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
