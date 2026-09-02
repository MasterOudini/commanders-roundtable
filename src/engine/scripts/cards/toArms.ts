// `To Arms!` — every tapped creature of mine untaps; I draw.

import { TO_ARMS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TO_ARMS, 'Untap all creatures you control.\nDraw a card.');

export const TO_ARMS_SCRIPT: CardScript = {
  oracleId: TO_ARMS.oracleId,
  name: TO_ARMS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const tapped: string[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller || !card.tapped) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        tapped.push(id);
      }
      const events: EventBody[] = [];
      if (tapped.length > 0) events.push({ t: 'PermanentsUntapped', cards: tapped });
      events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
