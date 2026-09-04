// `Verdant Automaton` - an activation selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VERDANT_AUTOMATON } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VERDANT_AUTOMATON, "{3}{G}: Put a +1/+1 counter on this creature.");

export const VERDANT_AUTOMATON_SCRIPT: CardScript = {
  oracleId: VERDANT_AUTOMATON.oracleId,
  name: VERDANT_AUTOMATON.name,
  activated: [
    {
      ref: `${VERDANT_AUTOMATON.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
