// `Fault Riders` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FAULT_RIDERS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FAULT_RIDERS, "Sacrifice a land: This creature gets +2/+0 and gains first strike until end of turn. Activate only once each turn.");

export const FAULT_RIDERS_SCRIPT: CardScript = {
  oracleId: FAULT_RIDERS.oracleId,
  name: FAULT_RIDERS.name,
  activated: [
    {
      ref: `${FAULT_RIDERS.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0, keywords: ["firstStrike"] }];
      },
    },
  ],
};
