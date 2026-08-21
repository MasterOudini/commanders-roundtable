// `Shatter the Sky` — "Each player who controls a creature with power 4
// or greater draws a card. Then destroy all creatures." The conditional
// per-player draws read BEFORE the wipe, emitted in printed order. D246.

import { SHATTER_THE_SKY } from '../../../data/fixtures/engineCards';
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
  SHATTER_THE_SKY,
  'Each player who controls a creature with power 4 or greater draws a card. Then destroy all creatures.',
);

export const SHATTER_THE_SKY_SCRIPT: CardScript = {
  oracleId: SHATTER_THE_SKY.oracleId,
  name: SHATTER_THE_SKY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const drawers = new Set<string>();
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if ((d.power ?? 0) >= 4) drawers.add(card.controller);
        if (!d.keywords.has('indestructible')) {
          moves.push({
            card: id,
            from: { kind: 'battlefield' as const, player: card.controller },
            to: { kind: 'graveyard' as const, player: card.owner },
          });
        }
      }
      for (const seat of ctx.state.seating) {
        if (!drawers.has(seat)) continue;
        const player = ctx.state.players[seat];
        if (!player || player.hasLost) continue;
        events.push(...drawEvents(ctx.state, seat, 1));
      }
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      return events;
    },
  },
};
