// `Lunar Insight` — draw per DIFFERENT mana value among my nonland
// permanents (Golden Ratio's set census on mv). D223.

import { LUNAR_INSIGHT } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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
  LUNAR_INSIGHT,
  'Draw a card for each different mana value among nonland permanents you control.',
);

export const LUNAR_INSIGHT_SCRIPT: CardScript = {
  oracleId: LUNAR_INSIGHT.oracleId,
  name: LUNAR_INSIGHT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const values = new Set<number>();
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.types.includes('Land')) continue;
        const mv = card.isToken ? 0 : (ctx.oracle.byPrinting(card.printingId)?.manaValue ?? 0);
        values.add(mv);
      }
      if (values.size === 0) return [];
      return [...drawEvents(ctx.state, obj.controller, values.size)];
    },
  },
};
