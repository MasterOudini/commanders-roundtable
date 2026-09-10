// `Definitely Not a Turtle` - a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DEFINITELY_NOT_A_TURTLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DEFINITELY_NOT_A_TURTLE, "When this creature dies, look at the top six cards of your library. You may reveal a land or legendary Turtle card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.");

const VOCAB_L0 = vocabularyEffects("Look at the top six cards of your library. You may reveal a land or legendary Turtle card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.", DEFINITELY_NOT_A_TURTLE.name);
const VOCAB_T_L0 = vocabularyTargets("Look at the top six cards of your library. You may reveal a land or legendary Turtle card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.");

export const DEFINITELY_NOT_ATURTLE_SCRIPT: CardScript = {
  oracleId: DEFINITELY_NOT_A_TURTLE.oracleId,
  name: DEFINITELY_NOT_A_TURTLE.name,
  triggers: [
    {
      abilityId: 'dies-0',
      text: PRINTED,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Definitely Not a Turtle - Look at the top six cards of your library. You may reveal a land or legendary Turtle card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
