// `Burning Cloak` — "Target creature gets +2/+0 until end of turn. Burning
// Cloak deals 2 damage to that creature." The pump then the burn, same
// target. D202.

import { BURNING_CLOAK } from '../../../data/fixtures/engineCards';
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
  BURNING_CLOAK,
  'Target creature gets +2/+0 until end of turn. Burning Cloak deals 2 damage to that creature.',
);

export const BURNING_CLOAK_SCRIPT: CardScript = {
  oracleId: BURNING_CLOAK.oracleId,
  name: BURNING_CLOAK.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      return [
        { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 2, toughness: 0 },
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount: 2,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        },
      ];
    },
  },
};
