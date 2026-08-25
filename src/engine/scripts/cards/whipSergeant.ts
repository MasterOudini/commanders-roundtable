// `Whip Sergeant` — "{R}: Target creature gains haste until end of turn."
// Haste is in the closed GRANTABLE map, so D194's carrier does the whole job.
// No {T} in the cost, so it goes as often as the mana allows. D269.

import { WHIP_SERGEANT } from '../../../data/fixtures/engineCards';
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
  WHIP_SERGEANT,
  '{R}: Target creature gains haste until end of turn. (It can attack this turn.)',
);

export const WHIP_SERGEANT_SCRIPT: CardScript = {
  oracleId: WHIP_SERGEANT.oracleId,
  name: WHIP_SERGEANT.name,
  activated: [
    {
      ref: `${WHIP_SERGEANT.oracleId}#a0`,
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
