// `Samite Herbalist` - a becomesTapped trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SAMITE_HERBALIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SAMITE_HERBALIST, "Whenever this creature becomes tapped, you gain 1 life and scry 1. (Look at the top card of your library. You may put that card on the bottom.)");

const VOCAB_L0 = vocabularyEffects("You gain 1 life and scry 1.", SAMITE_HERBALIST.name);
const VOCAB_T_L0 = vocabularyTargets("You gain 1 life and scry 1.");

export const SAMITE_HERBALIST_SCRIPT: CardScript = {
  oracleId: SAMITE_HERBALIST.oracleId,
  name: SAMITE_HERBALIST.name,
  triggers: [
    {
      abilityId: 'becomesTapped-0',
      text: PRINTED,
      event: 'PermanentsTapped',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'PermanentsTapped' && ev.cards.includes(self),
      label: () => "Samite Herbalist - You gain 1 life and scry 1.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
