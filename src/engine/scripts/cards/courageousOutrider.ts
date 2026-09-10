// `Courageous Outrider` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COURAGEOUS_OUTRIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COURAGEOUS_OUTRIDER, "When this creature enters, look at the top four cards of your library. You may reveal a Human card from among them and put it into your hand. Put the rest on the bottom of your library in any order.");

const VOCAB_L0 = vocabularyEffects("Look at the top four cards of your library. You may reveal a Human card from among them and put it into your hand. Put the rest on the bottom of your library in any order.", COURAGEOUS_OUTRIDER.name);
const VOCAB_T_L0 = vocabularyTargets("Look at the top four cards of your library. You may reveal a Human card from among them and put it into your hand. Put the rest on the bottom of your library in any order.");

export const COURAGEOUS_OUTRIDER_SCRIPT: CardScript = {
  oracleId: COURAGEOUS_OUTRIDER.oracleId,
  name: COURAGEOUS_OUTRIDER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Courageous Outrider - Look at the top four cards of your library. You may reveal a Human card from among them and put it into your hand. Put the rest on the bottom of your library in any order.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
