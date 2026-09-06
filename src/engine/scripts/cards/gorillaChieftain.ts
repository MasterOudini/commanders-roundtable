// `Gorilla Chieftain` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GORILLA_CHIEFTAIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GORILLA_CHIEFTAIN, "{1}{G}: Regenerate this creature.");

export const GORILLA_CHIEFTAIN_SCRIPT: CardScript = {
  oracleId: GORILLA_CHIEFTAIN.oracleId,
  name: GORILLA_CHIEFTAIN.name,
  activated: [
    {
      ref: `${GORILLA_CHIEFTAIN.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
