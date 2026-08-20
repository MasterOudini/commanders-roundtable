// `Exponential Growth` — "Until end of turn, double target creature's
// power X times." Doubling X times is power × 2^X — carried as one
// computed DELTA of power × (2^X − 1) over the derived value. A
// non-positive power doubles to itself and is left alone. D211.

import { EXPONENTIAL_GROWTH } from '../../../data/fixtures/engineCards';
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
  EXPONENTIAL_GROWTH,
  "Until end of turn, double target creature's power X times.",
);

export const EXPONENTIAL_GROWTH_SCRIPT: CardScript = {
  oracleId: EXPONENTIAL_GROWTH.oracleId,
  name: EXPONENTIAL_GROWTH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const power = ctx.derive(target.id).power ?? 0;
      if (power <= 0) return [];
      const delta = power * (2 ** x - 1);
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: delta, toughness: 0 }];
    },
  },
};
