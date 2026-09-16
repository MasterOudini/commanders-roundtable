// `Phyrexian Prowler` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PHYREXIAN_PROWLER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PHYREXIAN_PROWLER, "Fading 3 (This creature enters with three fade counters on it. At the beginning of your upkeep, remove a fade counter from it. If you can't, sacrifice it.)\nRemove a fade counter from this creature: This creature gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const PHYREXIAN_PROWLER_SCRIPT: CardScript = {
  oracleId: PHYREXIAN_PROWLER.oracleId,
  name: PHYREXIAN_PROWLER.name,
  activated: [
    {
      ref: `${PHYREXIAN_PROWLER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
