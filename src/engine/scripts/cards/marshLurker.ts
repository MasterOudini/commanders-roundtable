// `Marsh Lurker` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MARSH_LURKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MARSH_LURKER, "Sacrifice a Swamp: This creature gains fear until end of turn. (It can't be blocked except by artifact creatures and/or black creatures.)");

export const MARSH_LURKER_SCRIPT: CardScript = {
  oracleId: MARSH_LURKER.oracleId,
  name: MARSH_LURKER.name,
  activated: [
    {
      ref: `${MARSH_LURKER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["fear"] }];
      },
    },
  ],
};
