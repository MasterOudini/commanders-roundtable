// `Martyr for the Cause` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MARTYR_FOR_THE_CAUSE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MARTYR_FOR_THE_CAUSE, "When this creature dies, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");

const VOCAB_L0 = vocabularyEffects("Proliferate.", MARTYR_FOR_THE_CAUSE.name);
const VOCAB_T_L0 = vocabularyTargets("Proliferate.");

export const MARTYR_FOR_THE_CAUSE_SCRIPT: CardScript = {
  oracleId: MARTYR_FOR_THE_CAUSE.oracleId,
  name: MARTYR_FOR_THE_CAUSE.name,
  triggers: [
    {
      abilityId: 'dies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Martyr for the Cause - Proliferate.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
