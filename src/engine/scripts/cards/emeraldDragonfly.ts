// `Emerald Dragonfly` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { EMERALD_DRAGONFLY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EMERALD_DRAGONFLY, "Flying\n{G}{G}: This creature gains first strike until end of turn.");
const LINES = PRINTED.split('\n');

export const EMERALD_DRAGONFLY_SCRIPT: CardScript = {
  oracleId: EMERALD_DRAGONFLY.oracleId,
  name: EMERALD_DRAGONFLY.name,
  activated: [
    {
      ref: `${EMERALD_DRAGONFLY.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["firstStrike"] }];
      },
    },
  ],
};
