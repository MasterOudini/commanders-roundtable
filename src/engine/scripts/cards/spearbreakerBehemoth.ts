// `Spearbreaker Behemoth` — "{1}: Target creature with power 5 or greater
// gains indestructible until end of turn." D194's rider composed with
// D139's numeric floor at the aim: the Behemoth can grant ITSELF (it is a
// 5/5), and a granted indestructible really survives a wrath because the
// wipes ask the DERIVED keyword set. D196.

import { SPEARBREAKER_BEHEMOTH } from '../../../data/fixtures/engineCards';
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
  SPEARBREAKER_BEHEMOTH,
  'Indestructible\n{1}: Target creature with power 5 or greater gains indestructible until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SPEARBREAKER_BEHEMOTH_SCRIPT: CardScript = {
  oracleId: SPEARBREAKER_BEHEMOTH.oracleId,
  name: SPEARBREAKER_BEHEMOTH.name,
  activated: [
    {
      ref: `${SPEARBREAKER_BEHEMOTH.oracleId}#a0`,
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
