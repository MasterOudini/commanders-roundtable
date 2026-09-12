// `Tomb Robber` - an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TOMB_ROBBER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TOMB_ROBBER, "Menace\n{1}, Discard a card: This creature explores. (Reveal the top card of your library. Put that card into your hand if it's a land. Otherwise, put a +1/+1 counter on this creature, then put the card back or put it into your graveyard.)");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ explores.", TOMB_ROBBER.name);
const VOCAB_T_A0 = vocabularyTargets("~ explores.");

export const TOMB_ROBBER_SCRIPT: CardScript = {
  oracleId: TOMB_ROBBER.oracleId,
  name: TOMB_ROBBER.name,
  activated: [
    {
      ref: `${TOMB_ROBBER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
};
