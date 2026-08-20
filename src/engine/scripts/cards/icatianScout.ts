// `Icatian Scout` — "{1}, {T}: Target creature gains first strike until
// end of turn." Fyndhorn Bow's grant on a one-drop body. D219.

import { ICATIAN_SCOUT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ICATIAN_SCOUT, '{1}, {T}: Target creature gains first strike until end of turn.');

export const ICATIAN_SCOUT_SCRIPT: CardScript = {
  oracleId: ICATIAN_SCOUT.oracleId,
  name: ICATIAN_SCOUT.name,
  activated: [
    {
      ref: `${ICATIAN_SCOUT.oracleId}#a0`,
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
            keywords: ['firstStrike'],
          },
        ];
      },
    },
  ],
};
