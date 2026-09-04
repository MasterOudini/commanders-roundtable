// `Karplusan Giant` - an activation pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KARPLUSAN_GIANT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KARPLUSAN_GIANT, "Tap an untapped snow land you control: This creature gets +1/+1 until end of turn.");

export const KARPLUSAN_GIANT_SCRIPT: CardScript = {
  oracleId: KARPLUSAN_GIANT.oracleId,
  name: KARPLUSAN_GIANT.name,
  activated: [
    {
      ref: `${KARPLUSAN_GIANT.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
