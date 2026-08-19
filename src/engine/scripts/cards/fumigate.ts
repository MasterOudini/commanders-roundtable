// `Fumigate` — "Destroy all creatures. You gain 1 life for each creature
// destroyed this way." Damnation's shape plus the count — and the count is
// of creatures DESTROYED THIS WAY: an indestructible survivor pays nothing,
// which is why the life total is derived from the move list rather than
// from the board. D192.

import { FUMIGATE } from '../../../data/fixtures/engineCards';
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
  FUMIGATE,
  'Destroy all creatures. You gain 1 life for each creature destroyed this way.',
);

export const FUMIGATE_SCRIPT: CardScript = {
  oracleId: FUMIGATE.oracleId,
  name: FUMIGATE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      const events: EventBody[] = [];
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      const player = ctx.state.players[obj.controller];
      if (moves.length > 0 && player && !player.hasLost) {
        events.push({
          t: 'LifeChanged',
          player: obj.controller,
          delta: moves.length,
          to: player.life + moves.length,
        });
      }
      return events;
    },
  },
};
