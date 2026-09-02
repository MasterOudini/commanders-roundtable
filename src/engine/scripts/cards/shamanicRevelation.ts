// `Shamanic Revelation` — "Draw a card for each creature you control.\n
// Ferocious — You gain 4 life for each creature you control with power 4 or
// greater." Both counts off the derived board at resolution: every creature
// of mine is a card, every one at power 4 or more is 4 life more. D280.

import { SHAMANIC_REVELATION } from '../../../data/fixtures/engineCards';
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
  SHAMANIC_REVELATION,
  'Draw a card for each creature you control.\nFerocious — You gain 4 life for each creature you control with power 4 or greater.',
);

export const SHAMANIC_REVELATION_SCRIPT: CardScript = {
  oracleId: SHAMANIC_REVELATION.oracleId,
  name: SHAMANIC_REVELATION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let creatures = 0;
      let big = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        creatures += 1;
        if ((d.power ?? 0) >= 4) big += 1;
      }
      const events: EventBody[] = [];
      if (creatures > 0) events.push(...drawEvents(ctx.state, obj.controller, creatures));
      const me = ctx.state.players[obj.controller];
      if (big > 0 && me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: 4 * big, to: me.life + 4 * big });
      }
      return events;
    },
  },
};
