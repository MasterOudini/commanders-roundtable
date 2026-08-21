// `Slayers' Stronghold` — "{R}{W}, {T}: Target creature gets +2/+0 and gains
// vigilance and haste until end of turn." Skarrg's shape with a TWO-keyword
// grant list on D194's carrier, at #a1 behind the mana line. D248.

import { SLAYERS_STRONGHOLD } from '../../../data/fixtures/engineCards';
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
  SLAYERS_STRONGHOLD,
  '{T}: Add {C}.\n{R}{W}, {T}: Target creature gets +2/+0 and gains vigilance and haste until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SLAYERS_STRONGHOLD_SCRIPT: CardScript = {
  oracleId: SLAYERS_STRONGHOLD.oracleId,
  name: SLAYERS_STRONGHOLD.name,
  activated: [
    {
      ref: `${SLAYERS_STRONGHOLD.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          {
            t: 'PtModifiedUntilEndOfTurn',
            card: target.id,
            power: 2,
            toughness: 0,
            keywords: ['vigilance', 'haste'],
          },
        ];
      },
    },
  ],
};
