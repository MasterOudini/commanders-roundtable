// `Augmenting Automaton` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { AUGMENTING_AUTOMATON } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(AUGMENTING_AUTOMATON, "{1}{B}: This creature gets +1/+1 until end of turn.");

export const AUGMENTING_AUTOMATON_SCRIPT: CardScript = {
  oracleId: AUGMENTING_AUTOMATON.oracleId,
  name: AUGMENTING_AUTOMATON.name,
  activated: [
    {
      ref: `${AUGMENTING_AUTOMATON.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
