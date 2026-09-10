// `Faerie Mechanist` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FAERIE_MECHANIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FAERIE_MECHANIST, "Flying\nWhen this creature enters, look at the top three cards of your library. You may reveal an artifact card from among them and put it into your hand. Put the rest on the bottom of your library in any order.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Look at the top three cards of your library. You may reveal an artifact card from among them and put it into your hand. Put the rest on the bottom of your library in any order.", FAERIE_MECHANIST.name);
const VOCAB_T_L1 = vocabularyTargets("Look at the top three cards of your library. You may reveal an artifact card from among them and put it into your hand. Put the rest on the bottom of your library in any order.");

export const FAERIE_MECHANIST_SCRIPT: CardScript = {
  oracleId: FAERIE_MECHANIST.oracleId,
  name: FAERIE_MECHANIST.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Faerie Mechanist - Look at the top three cards of your library. You may reveal an artifact card from among them and put it into your hand. Put the rest on the bottom of your library in any order.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
