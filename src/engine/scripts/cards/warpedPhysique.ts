// `Warped Physique` — +X/-X where X is MY hand size, counted at RESOLUTION
// (the spell has already left my hand by then, which is exactly why the count
// is taken here and not at cast). A 2/2 with X=3 becomes 5/-1 and dies to
// SBA; that is the card working, not a bug. D268.

import { WARPED_PHYSIQUE } from '../../../data/fixtures/engineCards';
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
  WARPED_PHYSIQUE,
  'Target creature gets +X/-X until end of turn, where X is the number of cards in your hand.',
);

export const WARPED_PHYSIQUE_SCRIPT: CardScript = {
  oracleId: WARPED_PHYSIQUE.oracleId,
  name: WARPED_PHYSIQUE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      const x = (ctx.state.zones.hand[obj.controller] ?? []).length;
      if (x === 0) return [];
      return [
        {
          t: 'PtModifiedUntilEndOfTurn',
          card: target.id,
          power: x,
          toughness: -x,
          keywords: [],
        },
      ];
    },
  },
};
