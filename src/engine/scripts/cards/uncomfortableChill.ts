// `Uncomfortable Chill` — every creature my opponents control loses 2 power
// until cleanup; I draw.

import { UNCOMFORTABLE_CHILL } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(UNCOMFORTABLE_CHILL, 'Creatures your opponents control get -2/-0 until end of turn.\nDraw a card.');

export const UNCOMFORTABLE_CHILL_SCRIPT: CardScript = {
  oracleId: UNCOMFORTABLE_CHILL.oracleId,
  name: UNCOMFORTABLE_CHILL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller === obj.controller) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -2, toughness: 0, keywords: [] });
      }
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
