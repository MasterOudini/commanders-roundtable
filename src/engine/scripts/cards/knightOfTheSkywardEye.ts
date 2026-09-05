// `Knight of the Skyward Eye` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KNIGHT_OF_THE_SKYWARD_EYE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KNIGHT_OF_THE_SKYWARD_EYE, "{3}{G}: This creature gets +3/+3 until end of turn. Activate only once each turn.");

export const KNIGHT_OF_THE_SKYWARD_EYE_SCRIPT: CardScript = {
  oracleId: KNIGHT_OF_THE_SKYWARD_EYE.oracleId,
  name: KNIGHT_OF_THE_SKYWARD_EYE.name,
  activated: [
    {
      ref: `${KNIGHT_OF_THE_SKYWARD_EYE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 3, toughness: 3 }];
      },
    },
  ],
};
