// `Battle Rampart` — "{T}: Target creature gains haste until end of turn."
// Axgard Cavalry's line behind a Defender header, on its own oracle id. D199.

import { BATTLE_RAMPART } from '../../../data/fixtures/engineCards';
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
  BATTLE_RAMPART,
  'Defender\n{T}: Target creature gains haste until end of turn.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const BATTLE_RAMPART_SCRIPT: CardScript = {
  oracleId: BATTLE_RAMPART.oracleId,
  name: BATTLE_RAMPART.name,
  activated: [
    {
      ref: `${BATTLE_RAMPART.oracleId}#a0`,
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
