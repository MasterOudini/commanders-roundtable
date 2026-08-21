// `Shield Mate` — "Sacrifice this creature: Target creature gets +0/+4
// until end of turn." The free self-sac toughness pump. D246.

import { SHIELD_MATE } from '../../../data/fixtures/engineCards';
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
  SHIELD_MATE,
  'Sacrifice this creature: Target creature gets +0/+4 until end of turn.',
);

export const SHIELD_MATE_SCRIPT: CardScript = {
  oracleId: SHIELD_MATE.oracleId,
  name: SHIELD_MATE.name,
  activated: [
    {
      ref: `${SHIELD_MATE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 4 }];
      },
    },
  ],
};
