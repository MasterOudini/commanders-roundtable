// `Rimebound Dead` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RIMEBOUND_DEAD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RIMEBOUND_DEAD, "{S}: Regenerate this creature. ({S} can be paid with one mana from a snow source.)");

export const RIMEBOUND_DEAD_SCRIPT: CardScript = {
  oracleId: RIMEBOUND_DEAD.oracleId,
  name: RIMEBOUND_DEAD.name,
  activated: [
    {
      ref: `${RIMEBOUND_DEAD.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
