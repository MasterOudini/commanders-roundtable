// `Fathom Fleet Firebrand` - a one-shot pump on itself until end of turn, bought by the printed
// cost the engine charges (D301). Generated from one table row.

import { FATHOM_FLEET_FIREBRAND } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FATHOM_FLEET_FIREBRAND, "{1}{R}: This creature gets +1/+0 until end of turn.");

export const FATHOM_FLEET_FIREBRAND_SCRIPT: CardScript = {
  oracleId: FATHOM_FLEET_FIREBRAND.oracleId,
  name: FATHOM_FLEET_FIREBRAND.name,
  activated: [
    {
      ref: `${FATHOM_FLEET_FIREBRAND.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0 }];
      },
    },
  ],
};
