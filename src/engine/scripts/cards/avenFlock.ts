// `Aven Flock` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { AVEN_FLOCK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AVEN_FLOCK, "Flying (This creature can't be blocked except by creatures with flying or reach.)\n{W}: This creature gets +0/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const AVEN_FLOCK_SCRIPT: CardScript = {
  oracleId: AVEN_FLOCK.oracleId,
  name: AVEN_FLOCK.name,
  activated: [
    {
      ref: `${AVEN_FLOCK.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 1 }];
      },
    },
  ],
};
