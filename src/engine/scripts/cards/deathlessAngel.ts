// `Deathless Angel` — flying (Tier 2, keywords) plus "{W}{W}: Target
// creature gains indestructible until end of turn." Spearbreaker Behemoth's
// grant on a mana cost; the keyword line never counts in the ability index,
// so the grant is #a0. D206.

import { DEATHLESS_ANGEL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  DEATHLESS_ANGEL,
  'Flying\n{W}{W}: Target creature gains indestructible until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const DEATHLESS_ANGEL_SCRIPT: CardScript = {
  oracleId: DEATHLESS_ANGEL.oracleId,
  name: DEATHLESS_ANGEL.name,
  activated: [
    {
      ref: `${DEATHLESS_ANGEL.oracleId}#a0`,
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
            keywords: ['indestructible'],
          },
        ];
      },
    },
  ],
};
