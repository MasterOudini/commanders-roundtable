// `Rakeclaw Gargantuan` — "{1}: Target creature with power 5 or greater
// gains first strike until end of turn." D139's floor enforced at the
// aim, the grant on D194's carrier. D237.

import { RAKECLAW_GARGANTUAN } from '../../../data/fixtures/engineCards';
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
  RAKECLAW_GARGANTUAN,
  '{1}: Target creature with power 5 or greater gains first strike until end of turn.',
);

export const RAKECLAW_GARGANTUAN_SCRIPT: CardScript = {
  oracleId: RAKECLAW_GARGANTUAN.oracleId,
  name: RAKECLAW_GARGANTUAN.name,
  activated: [
    {
      ref: `${RAKECLAW_GARGANTUAN.oracleId}#a0`,
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
