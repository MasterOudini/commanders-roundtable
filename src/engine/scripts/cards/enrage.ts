// `Enrage` — "Target creature gets +X/+0 until end of turn." D210.

import { ENRAGE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ENRAGE, 'Target creature gets +X/+0 until end of turn.');

export const ENRAGE_SCRIPT: CardScript = {
  oracleId: ENRAGE.oracleId,
  name: ENRAGE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: x, toughness: 0 }];
    },
  },
};
