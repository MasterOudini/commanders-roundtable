// `Flowstone Slide` — "All creatures get +X/-X until end of turn." The
// asymmetric board pump; the SBA fells anything whose toughness hits
// zero. D214.

import { FLOWSTONE_SLIDE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(FLOWSTONE_SLIDE, 'All creatures get +X/-X until end of turn.');

export const FLOWSTONE_SLIDE_SCRIPT: CardScript = {
  oracleId: FLOWSTONE_SLIDE.oracleId,
  name: FLOWSTONE_SLIDE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: x, toughness: -x });
      }
      return events;
    },
  },
};
