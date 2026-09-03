// `Flowstone Channeler` — two mana, the tap and a discarded card of my
// choice (D286) give a creature +1/-1 and haste until cleanup.

import { FLOWSTONE_CHANNELER } from '../../../data/fixtures/engineCards';
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
  FLOWSTONE_CHANNELER,
  '{1}{R}, {T}, Discard a card: Target creature gets +1/-1 and gains haste until end of turn.',
);

export const FLOWSTONE_CHANNELER_SCRIPT: CardScript = {
  oracleId: FLOWSTONE_CHANNELER.oracleId,
  name: FLOWSTONE_CHANNELER.name,
  activated: [
    {
      ref: `${FLOWSTONE_CHANNELER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: -1, keywords: ['haste'] }];
      },
    },
  ],
};
