// `Nightmarish End` — "Target creature gets -X/-X until end of turn, where
// X is the number of cards in your hand." Flunk's arithmetic on a debuff;
// the SBA does any killing. D228.

import { NIGHTMARISH_END } from '../../../data/fixtures/engineCards';
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
  NIGHTMARISH_END,
  'Target creature gets -X/-X until end of turn, where X is the number of cards in your hand.',
);

export const NIGHTMARISH_END_SCRIPT: CardScript = {
  oracleId: NIGHTMARISH_END.oracleId,
  name: NIGHTMARISH_END.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const x = (ctx.state.zones.hand[obj.controller] ?? []).length;
      if (x === 0) return [];
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -x, toughness: -x }];
    },
  },
};
