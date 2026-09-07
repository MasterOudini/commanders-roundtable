// `Skophos Warleader` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKOPHOS_WARLEADER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKOPHOS_WARLEADER, "{R}, Sacrifice another creature or an enchantment: This creature gets +1/+0 and gains menace until end of turn. (It can't be blocked except by two or more creatures.)");

export const SKOPHOS_WARLEADER_SCRIPT: CardScript = {
  oracleId: SKOPHOS_WARLEADER.oracleId,
  name: SKOPHOS_WARLEADER.name,
  activated: [
    {
      ref: `${SKOPHOS_WARLEADER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0, keywords: ["menace"] }];
      },
    },
  ],
};
