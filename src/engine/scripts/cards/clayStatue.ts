// `Clay Statue` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CLAY_STATUE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CLAY_STATUE, "{2}: Regenerate this creature.");

export const CLAY_STATUE_SCRIPT: CardScript = {
  oracleId: CLAY_STATUE.oracleId,
  name: CLAY_STATUE.name,
  activated: [
    {
      ref: `${CLAY_STATUE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
