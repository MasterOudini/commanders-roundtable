// `Rootwater Alligator` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ROOTWATER_ALLIGATOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ROOTWATER_ALLIGATOR, "Sacrifice a Forest: Regenerate this creature.");

export const ROOTWATER_ALLIGATOR_SCRIPT: CardScript = {
  oracleId: ROOTWATER_ALLIGATOR.oracleId,
  name: ROOTWATER_ALLIGATOR.name,
  activated: [
    {
      ref: `${ROOTWATER_ALLIGATOR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
