// `Tunneler Wurm` - an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TUNNELER_WURM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TUNNELER_WURM, "Discard a card: Regenerate this creature.");

export const TUNNELER_WURM_SCRIPT: CardScript = {
  oracleId: TUNNELER_WURM.oracleId,
  name: TUNNELER_WURM.name,
  activated: [
    {
      ref: `${TUNNELER_WURM.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
};
