// `Might of the Nephilim` — "Target creature gets +2/+2 until end of turn
// for each of its colors." The census is the TARGET's own derived colors,
// doubled. D225.

import { MIGHT_OF_THE_NEPHILIM } from '../../../data/fixtures/engineCards';
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
  MIGHT_OF_THE_NEPHILIM,
  'Target creature gets +2/+2 until end of turn for each of its colors.',
);

export const MIGHT_OF_THE_NEPHILIM_SCRIPT: CardScript = {
  oracleId: MIGHT_OF_THE_NEPHILIM.oracleId,
  name: MIGHT_OF_THE_NEPHILIM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const n = ctx.derive(target.id).colors.length * 2;
      if (n === 0) return [];
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: n, toughness: n }];
    },
  },
};
