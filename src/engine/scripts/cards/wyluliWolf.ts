// `Wyluli Wolf` — "{T}: Target creature gets +1/+1 until end of turn." The
// tap-for-a-pump on D194's carrier. D271.

import { WYLULI_WOLF } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(WYLULI_WOLF, '{T}: Target creature gets +1/+1 until end of turn.');

export const WYLULI_WOLF_SCRIPT: CardScript = {
  oracleId: WYLULI_WOLF.oracleId,
  name: WYLULI_WOLF.name,
  activated: [
    {
      ref: `${WYLULI_WOLF.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1, keywords: [] },
        ];
      },
    },
  ],
};
