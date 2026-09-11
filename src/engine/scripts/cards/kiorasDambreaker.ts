// `Kiora's Dambreaker` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KIORA_S_DAMBREAKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KIORA_S_DAMBREAKER, "When this creature enters, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");

const VOCAB_L0 = vocabularyEffects("Proliferate.", KIORA_S_DAMBREAKER.name);
const VOCAB_T_L0 = vocabularyTargets("Proliferate.");

export const KIORAS_DAMBREAKER_SCRIPT: CardScript = {
  oracleId: KIORA_S_DAMBREAKER.oracleId,
  name: KIORA_S_DAMBREAKER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Kiora's Dambreaker - Proliferate.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
