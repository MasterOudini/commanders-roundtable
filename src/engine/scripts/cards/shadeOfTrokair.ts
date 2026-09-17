// `Shade of Trokair` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SHADE_OF_TROKAIR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SHADE_OF_TROKAIR, "{W}: This creature gets +1/+1 until end of turn.\nSuspend 3—{W} (Rather than cast this card from your hand, you may pay {W} and exile it with three time counters on it. At the beginning of your upkeep, remove a time counter. When the last is removed, you may cast it without paying its mana cost. It has haste.)");
const LINES = PRINTED.split('\n');

export const SHADE_OF_TROKAIR_SCRIPT: CardScript = {
  oracleId: SHADE_OF_TROKAIR.oracleId,
  name: SHADE_OF_TROKAIR.name,
  activated: [
    {
      ref: `${SHADE_OF_TROKAIR.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
