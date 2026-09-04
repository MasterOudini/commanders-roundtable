// `Markov Dreadknight` - an activation selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MARKOV_DREADKNIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MARKOV_DREADKNIGHT, "Flying\n{2}{B}, Discard a card: Put two +1/+1 counters on this creature.");
const LINES = PRINTED.split('\n');

export const MARKOV_DREADKNIGHT_SCRIPT: CardScript = {
  oracleId: MARKOV_DREADKNIGHT.oracleId,
  name: MARKOV_DREADKNIGHT.name,
  activated: [
    {
      ref: `${MARKOV_DREADKNIGHT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 2 }] }];
      },
    },
  ],
};
