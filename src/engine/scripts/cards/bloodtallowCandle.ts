// `Bloodtallow Candle` — "{6}, {T}, Sacrifice this artifact: Target creature
// gets -5/-5 until end of turn." Ark of Blight's targeted self-sacrifice
// writing Blister Beetle's layer-7c modifier. M6.4h, D165.

import { BLOODTALLOW_CANDLE } from '../../../data/fixtures/engineCards';
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
  BLOODTALLOW_CANDLE,
  '{6}, {T}, Sacrifice this artifact: Target creature gets -5/-5 until end of turn.',
);

export const BLOODTALLOW_CANDLE_SCRIPT: CardScript = {
  oracleId: BLOODTALLOW_CANDLE.oracleId,
  name: BLOODTALLOW_CANDLE.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${BLOODTALLOW_CANDLE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -5, toughness: -5 }];
      },
    },
  ],
};
