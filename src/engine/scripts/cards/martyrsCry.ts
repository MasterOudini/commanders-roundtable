// `Martyr's Cry` — every white creature is exiled and each CONTROLLER
// draws per loss of their own. D223.

import { MARTYR_S_CRY } from '../../../data/fixtures/engineCards';
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
  MARTYR_S_CRY,
  'Exile all white creatures. For each creature exiled this way, its controller draws a card.',
);

export const MARTYRS_CRY_SCRIPT: CardScript = {
  oracleId: MARTYR_S_CRY.oracleId,
  name: MARTYR_S_CRY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      const counts = new Map<string, number>();
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (!d.colors.includes('W')) continue;
        counts.set(card.controller, (counts.get(card.controller) ?? 0) + 1);
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'exile' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      const events: EventBody[] = [{ t: 'CardsMoved', moves }];
      for (const pid of ctx.state.seating) {
        const n = counts.get(pid) ?? 0;
        if (n === 0) continue;
        if (ctx.state.players[pid]?.hasLost) continue;
        events.push(...drawEvents(ctx.state, pid, n));
      }
      return events;
    },
  },
};
