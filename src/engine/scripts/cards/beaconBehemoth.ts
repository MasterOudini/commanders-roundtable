// `Beacon Behemoth` — "{1}: Target creature with power 5 or greater gains
// vigilance until end of turn." The D139 numeric floor enforced at the aim;
// the def only grants. D199.

import { BEACON_BEHEMOTH } from '../../../data/fixtures/engineCards';
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
  BEACON_BEHEMOTH,
  '{1}: Target creature with power 5 or greater gains vigilance until end of turn.',
);

export const BEACON_BEHEMOTH_SCRIPT: CardScript = {
  oracleId: BEACON_BEHEMOTH.oracleId,
  name: BEACON_BEHEMOTH.name,
  activated: [
    {
      ref: `${BEACON_BEHEMOTH.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['vigilance'] },
        ];
      },
    },
  ],
};
