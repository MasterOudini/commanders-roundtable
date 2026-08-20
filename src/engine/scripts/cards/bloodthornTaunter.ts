// `Bloodthorn Taunter` — "{T}: Target creature with power 5 or greater
// gains haste until end of turn." Beacon Behemoth's D139 floor composed
// with the haste grant, behind a Haste keyword line. D200.

import { BLOODTHORN_TAUNTER } from '../../../data/fixtures/engineCards';
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
  BLOODTHORN_TAUNTER,
  'Haste\n{T}: Target creature with power 5 or greater gains haste until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const BLOODTHORN_TAUNTER_SCRIPT: CardScript = {
  oracleId: BLOODTHORN_TAUNTER.oracleId,
  name: BLOODTHORN_TAUNTER.name,
  activated: [
    {
      ref: `${BLOODTHORN_TAUNTER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
        return [
          { t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 0, keywords: ['haste'] },
        ];
      },
    },
  ],
};
