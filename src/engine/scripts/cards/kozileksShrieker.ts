// `Kozilek's Shrieker` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KOZILEK_S_SHRIEKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KOZILEK_S_SHRIEKER, "Devoid (This card has no color.)\n{C}: This creature gets +1/+0 and gains menace until end of turn. (It can't be blocked except by two or more creatures. {C} represents colorless mana.)");
const LINES = PRINTED.split('\n');

export const KOZILEKS_SHRIEKER_SCRIPT: CardScript = {
  oracleId: KOZILEK_S_SHRIEKER.oracleId,
  name: KOZILEK_S_SHRIEKER.name,
  activated: [
    {
      ref: `${KOZILEK_S_SHRIEKER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0, keywords: ["menace"] }];
      },
    },
  ],
};
