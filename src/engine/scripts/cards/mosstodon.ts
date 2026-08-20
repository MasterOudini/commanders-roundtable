// `Mosstodon` — "{1}: Target creature with power 5 or greater gains trample
// until end of turn." Spearbreaker Behemoth's floored activated grant, one
// keyword over. D226.

import { MOSSTODON } from '../../../data/fixtures/engineCards';
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
  MOSSTODON,
  '{1}: Target creature with power 5 or greater gains trample until end of turn.',
);

export const MOSSTODON_SCRIPT: CardScript = {
  oracleId: MOSSTODON.oracleId,
  name: MOSSTODON.name,
  activated: [
    {
      ref: `${MOSSTODON.oracleId}#a0`,
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
            keywords: ['trample'],
          },
        ];
      },
    },
  ],
};
