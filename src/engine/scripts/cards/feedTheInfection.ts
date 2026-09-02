// `Feed the Infection` — "You draw three cards and you lose 3 life.\n
// Corrupted — Each opponent who has three or more poison counters loses 3
// life." Corrupted is an ability word (Radiance's rule, D270): the second
// line is a plain condition on each opponent's poison count, read off the
// player state at resolution. D275.

import { FEED_THE_INFECTION } from '../../../data/fixtures/engineCards';
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
  FEED_THE_INFECTION,
  'You draw three cards and you lose 3 life.\nCorrupted — Each opponent who has three or more poison counters loses 3 life.',
);

export const FEED_THE_INFECTION_SCRIPT: CardScript = {
  oracleId: FEED_THE_INFECTION.oracleId,
  name: FEED_THE_INFECTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [...drawEvents(ctx.state, obj.controller, 3)];
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: -3, to: me.life - 3 });
      }
      for (const [id, p] of Object.entries(ctx.state.players)) {
        if (id === obj.controller || !p || p.hasLost) continue;
        if (p.poison < 3) continue;
        events.push({ t: 'LifeChanged', player: id, delta: -3, to: p.life - 3 });
      }
      return events;
    },
  },
};
