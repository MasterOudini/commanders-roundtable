// `Elven Lyre` — "{1}, {T}, Sacrifice this artifact: Target creature gets
// +2/+2 until end of turn." D159's self-sacrifice charging Devotee of
// Strength's pump. M6.4q, D173.

import { ELVEN_LYRE } from '../../../data/fixtures/engineCards';
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
  ELVEN_LYRE,
  '{1}, {T}, Sacrifice this artifact: Target creature gets +2/+2 until end of turn.',
);

export const ELVEN_LYRE_SCRIPT: CardScript = {
  oracleId: ELVEN_LYRE.oracleId,
  name: ELVEN_LYRE.name,
  activated: [
    {
      ref: `${ELVEN_LYRE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 2 }];
      },
    },
  ],
};
