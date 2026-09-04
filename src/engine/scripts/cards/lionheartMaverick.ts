// `Lionheart Maverick` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { LIONHEART_MAVERICK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LIONHEART_MAVERICK, "Vigilance\n{4}{W}: This creature gets +1/+2 until end of turn.");
const LINES = PRINTED.split('\n');

export const LIONHEART_MAVERICK_SCRIPT: CardScript = {
  oracleId: LIONHEART_MAVERICK.oracleId,
  name: LIONHEART_MAVERICK.name,
  activated: [
    {
      ref: `${LIONHEART_MAVERICK.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 2 }];
      },
    },
  ],
};
