// `Femeref Knight` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FEMEREF_KNIGHT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FEMEREF_KNIGHT, "Flanking (Whenever a creature without flanking blocks this creature, the blocking creature gets -1/-1 until end of turn.)\n{W}: This creature gains vigilance until end of turn.");
const LINES = PRINTED.split('\n');

export const FEMEREF_KNIGHT_SCRIPT: CardScript = {
  oracleId: FEMEREF_KNIGHT.oracleId,
  name: FEMEREF_KNIGHT.name,
  activated: [
    {
      ref: `${FEMEREF_KNIGHT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["vigilance"] }];
      },
    },
  ],
};
