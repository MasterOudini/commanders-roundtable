// `Ingenious Skaab` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INGENIOUS_SKAAB } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INGENIOUS_SKAAB, "Prowess (Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.)\n{U}: This creature gets +1/-1 until end of turn.");
const LINES = PRINTED.split('\n');

export const INGENIOUS_SKAAB_SCRIPT: CardScript = {
  oracleId: INGENIOUS_SKAAB.oracleId,
  name: INGENIOUS_SKAAB.name,
  activated: [
    {
      ref: `${INGENIOUS_SKAAB.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: -1 }];
      },
    },
  ],
};
