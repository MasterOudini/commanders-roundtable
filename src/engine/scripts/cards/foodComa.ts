// `Food Coma` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FOOD_COMA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FOOD_COMA, "When this enchantment enters, exile target creature an opponent controls until this enchantment leaves the battlefield. Create a Food token. (It's an artifact with \"{2}, {T}, Sacrifice this token: You gain 3 life.\")");

const VOCAB_L0 = vocabularyEffects("Exile target creature an opponent controls until this enchantment leaves the battlefield. Create a Food token.", FOOD_COMA.name);
const VOCAB_T_L0 = vocabularyTargets("Exile target creature an opponent controls until this enchantment leaves the battlefield. Create a Food token.");

export const FOOD_COMA_SCRIPT: CardScript = {
  oracleId: FOOD_COMA.oracleId,
  name: FOOD_COMA.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L0,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Food Coma - Exile target creature an opponent controls until this enchantment leaves the battlefield. Create a Food token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
