// `Thorn-Thrash Viashino` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THORN_THRASH_VIASHINO } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THORN_THRASH_VIASHINO, "Devour 2 (As this creature enters, you may sacrifice any number of creatures. It enters with twice that many +1/+1 counters on it.)\n{G}: This creature gains trample until end of turn.");
const LINES = PRINTED.split('\n');

export const THORN_THRASH_VIASHINO_SCRIPT: CardScript = {
  oracleId: THORN_THRASH_VIASHINO.oracleId,
  name: THORN_THRASH_VIASHINO.name,
  activated: [
    {
      ref: `${THORN_THRASH_VIASHINO.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["trample"] }];
      },
    },
  ],
};
