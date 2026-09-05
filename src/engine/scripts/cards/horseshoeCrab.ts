// `Horseshoe Crab` - an activation untapSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HORSESHOE_CRAB } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HORSESHOE_CRAB, "{U}: Untap this creature.");

export const HORSESHOE_CRAB_SCRIPT: CardScript = {
  oracleId: HORSESHOE_CRAB.oracleId,
  name: HORSESHOE_CRAB.name,
  activated: [
    {
      ref: `${HORSESHOE_CRAB.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield' || !me.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [self] }];
      },
    },
  ],
};
