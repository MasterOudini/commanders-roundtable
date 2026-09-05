// `Dire Wolf Prowler` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DIRE_WOLF_PROWLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DIRE_WOLF_PROWLER, "{1}{G}: This creature gets +2/+2 and gains haste until end of turn. Activate only once each turn.");

export const DIRE_WOLF_PROWLER_SCRIPT: CardScript = {
  oracleId: DIRE_WOLF_PROWLER.oracleId,
  name: DIRE_WOLF_PROWLER.name,
  activated: [
    {
      ref: `${DIRE_WOLF_PROWLER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 2, keywords: ["haste"] }];
      },
    },
  ],
};
