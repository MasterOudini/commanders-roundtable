// `Onyx Mage` — "{1}{B}: Target creature you control gains deathtouch
// until end of turn." The activated D194 rider. D230.

import { ONYX_MAGE } from '../../../data/fixtures/engineCards';
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
  ONYX_MAGE,
  '{1}{B}: Target creature you control gains deathtouch until end of turn. (Any amount of damage it deals to a creature is enough to destroy it.)',
);

export const ONYX_MAGE_SCRIPT: CardScript = {
  oracleId: ONYX_MAGE.oracleId,
  name: ONYX_MAGE.name,
  activated: [
    {
      ref: `${ONYX_MAGE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 0,
            toughness: 0,
            keywords: ['deathtouch'],
          },
        ];
      },
    },
  ],
};
