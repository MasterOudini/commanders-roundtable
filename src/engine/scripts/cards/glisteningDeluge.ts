// `Glistening Deluge` — every creature takes -1/-1; the green and/or
// white ones take -3/-3 total. One entry per creature, summed. D216.

import { GLISTENING_DELUGE } from '../../../data/fixtures/engineCards';
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
  GLISTENING_DELUGE,
  'All creatures get -1/-1 until end of turn. Creatures that are green and/or white get an additional -2/-2 until end of turn.',
);

export const GLISTENING_DELUGE_SCRIPT: CardScript = {
  oracleId: GLISTENING_DELUGE.oracleId,
  name: GLISTENING_DELUGE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        const extra = d.colors.includes('G') || d.colors.includes('W') ? 2 : 0;
        events.push({
          t: 'PtModifiedUntilEndOfTurn',
          card: id,
          power: -(1 + extra),
          toughness: -(1 + extra),
        });
      }
      return events;
    },
  },
};
