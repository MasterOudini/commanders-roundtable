// `Flunk` — "Target creature gets -X/-X until end of turn, where X is 7
// minus the number of cards in that creature's controller's hand." A full
// hand blunts it to nothing; the clamp at zero emits no event. D214.

import { FLUNK } from '../../../data/fixtures/engineCards';
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
  FLUNK,
  "Target creature gets -X/-X until end of turn, where X is 7 minus the number of cards in that creature's controller's hand.",
);

export const FLUNK_SCRIPT: CardScript = {
  oracleId: FLUNK.oracleId,
  name: FLUNK.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const hand = (ctx.state.zones.hand[card.controller] ?? []).length;
      const x = 7 - hand;
      if (x <= 0) return [];
      return [{ t: 'PtModifiedUntilEndOfTurn', card: target.id, power: -x, toughness: -x }];
    },
  },
};
