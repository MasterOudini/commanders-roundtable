// `Rollick of Abandon` — "All creatures get +2/-2 until end of turn."
// Flowstone Slide's board slide at a printed flat 2. D241.

import { ROLLICK_OF_ABANDON } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(ROLLICK_OF_ABANDON, 'All creatures get +2/-2 until end of turn.');

export const ROLLICK_OF_ABANDON_SCRIPT: CardScript = {
  oracleId: ROLLICK_OF_ABANDON.oracleId,
  name: ROLLICK_OF_ABANDON.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: 2, toughness: -2 });
      }
      return events;
    },
  },
};
