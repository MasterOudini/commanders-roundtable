// `Phyrexian Denouncer` — "{T}, Sacrifice this creature: Target creature
// gets -1/-1 until end of turn." The smallest Carrier. D233.

import { PHYREXIAN_DENOUNCER } from '../../../data/fixtures/engineCards';
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
  PHYREXIAN_DENOUNCER,
  '{T}, Sacrifice this creature: Target creature gets -1/-1 until end of turn.',
);

export const PHYREXIAN_DENOUNCER_SCRIPT: CardScript = {
  oracleId: PHYREXIAN_DENOUNCER.oracleId,
  name: PHYREXIAN_DENOUNCER.name,
  activated: [
    {
      ref: `${PHYREXIAN_DENOUNCER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -1, toughness: -1 }];
      },
    },
  ],
};
