// `Compassionate Healer` - a becomesTapped trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COMPASSIONATE_HEALER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COMPASSIONATE_HEALER, "Whenever this creature becomes tapped, you gain 1 life and scry 1. (Look at the top card of your library. You may put it on the bottom.)");

const VOCAB_L0 = vocabularyEffects("You gain 1 life and scry 1.", COMPASSIONATE_HEALER.name);
const VOCAB_T_L0 = vocabularyTargets("You gain 1 life and scry 1.");

export const COMPASSIONATE_HEALER_SCRIPT: CardScript = {
  oracleId: COMPASSIONATE_HEALER.oracleId,
  name: COMPASSIONATE_HEALER.name,
  triggers: [
    {
      abilityId: 'becomesTapped-0',
      text: PRINTED,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => "Compassionate Healer - You gain 1 life and scry 1.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
