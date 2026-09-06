// `Goblin Turncoat` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GOBLIN_TURNCOAT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GOBLIN_TURNCOAT, "Sacrifice a Goblin: Regenerate this creature.");

export const GOBLIN_TURNCOAT_SCRIPT: CardScript = {
  oracleId: GOBLIN_TURNCOAT.oracleId,
  name: GOBLIN_TURNCOAT.name,
  activated: [
    {
      ref: `${GOBLIN_TURNCOAT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
