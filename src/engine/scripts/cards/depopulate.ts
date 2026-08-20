// `Depopulate` — "Each player who controls a multicolored creature draws a
// card. Then destroy all creatures." The draws are decided BEFORE the wipe
// (printed order), multicolored read off the DERIVED colors. D207.

import { DEPOPULATE } from '../../../data/fixtures/engineCards';
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
  DEPOPULATE,
  'Each player who controls a multicolored creature draws a card. Then destroy all creatures.',
);

export const DEPOPULATE_SCRIPT: CardScript = {
  oracleId: DEPOPULATE.oracleId,
  name: DEPOPULATE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const hasMulti = new Set<string>();
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.colors.length >= 2) hasMulti.add(card.controller);
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      const events: EventBody[] = [];
      for (const pid of ctx.state.seating) {
        if (!hasMulti.has(pid)) continue;
        if (ctx.state.players[pid]?.hasLost) continue;
        events.push(...drawEvents(ctx.state, pid, 1));
      }
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      return events;
    },
  },
};
