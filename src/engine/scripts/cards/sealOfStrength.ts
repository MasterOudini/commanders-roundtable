// `Seal of Strength` — "Sacrifice this enchantment: Target creature gets
// +3/+3 until end of turn." The Seal cycle's pump. D244.

import { SEAL_OF_STRENGTH } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  SEAL_OF_STRENGTH,
  'Sacrifice this enchantment: Target creature gets +3/+3 until end of turn.',
);

export const SEAL_OF_STRENGTH_SCRIPT: CardScript = {
  oracleId: SEAL_OF_STRENGTH.oracleId,
  name: SEAL_OF_STRENGTH.name,
  activated: [
    {
      ref: `${SEAL_OF_STRENGTH.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 3, toughness: 3 }];
      },
    },
  ],
};
