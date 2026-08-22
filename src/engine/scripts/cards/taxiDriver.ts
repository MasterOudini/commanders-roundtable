// `Taxi Driver` — "{1}, {T}: Target creature gains haste until end of turn."
// D194's temporary-keyword carrier on an activated ability with a mana cost
// (Advance Scout's shape, D196, one keyword over). D257.

import { TAXI_DRIVER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TAXI_DRIVER, '{1}, {T}: Target creature gains haste until end of turn.');

export const TAXI_DRIVER_SCRIPT: CardScript = {
  oracleId: TAXI_DRIVER.oracleId,
  name: TAXI_DRIVER.name,
  activated: [
    {
      ref: `${TAXI_DRIVER.oracleId}#a0`,
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
            keywords: ['haste'],
          },
        ];
      },
    },
  ],
};
