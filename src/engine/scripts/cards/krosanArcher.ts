// `Krosan Archer` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { KROSAN_ARCHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KROSAN_ARCHER, "Reach (This creature can block creatures with flying.)\n{G}, Discard a card: This creature gets +0/+2 until end of turn.");
const LINES = PRINTED.split('\n');

export const KROSAN_ARCHER_SCRIPT: CardScript = {
  oracleId: KROSAN_ARCHER.oracleId,
  name: KROSAN_ARCHER.name,
  activated: [
    {
      ref: `${KROSAN_ARCHER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 2 }];
      },
    },
  ],
};
