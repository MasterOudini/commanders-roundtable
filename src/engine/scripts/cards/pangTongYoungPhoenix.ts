// `Pang Tong, "Young Phoenix"` - an activation pumpTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PANG_TONG_YOUNG_PHOENIX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PANG_TONG_YOUNG_PHOENIX, "{T}: Target creature gets +0/+2 until end of turn. Activate only during your turn, before attackers are declared.");

export const PANG_TONG_YOUNG_PHOENIX_SCRIPT: CardScript = {
  oracleId: PANG_TONG_YOUNG_PHOENIX.oracleId,
  name: PANG_TONG_YOUNG_PHOENIX.name,
  activated: [
    {
      ref: `${PANG_TONG_YOUNG_PHOENIX.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 0, toughness: 2 }];
      },
    },
  ],
};
