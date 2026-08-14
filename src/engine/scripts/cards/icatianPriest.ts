// `Icatian Priest` — "{1}{W}{W}: Target creature gets +1/+1 until end of
// turn." Bloodtallow Candle's activated targeted shape in the pump
// direction, repeatable (no tap in the cost). M6.4x, D180.

import { ICATIAN_PRIEST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ICATIAN_PRIEST, '{1}{W}{W}: Target creature gets +1/+1 until end of turn.');

export const ICATIAN_PRIEST_SCRIPT: CardScript = {
  oracleId: ICATIAN_PRIEST.oracleId,
  name: ICATIAN_PRIEST.name,
  activated: [
    {
      ref: `${ICATIAN_PRIEST.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: 1, toughness: 1 }];
      },
    },
  ],
};
