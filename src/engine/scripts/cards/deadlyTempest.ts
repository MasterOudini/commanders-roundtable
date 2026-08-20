// `Deadly Tempest` — "Destroy all creatures. Each player loses life equal
// to the number of creatures they controlled that were destroyed this way."
// Fumigate's destroyed-this-way count split PER PLAYER: an indestructible
// survivor costs its controller nothing, because the loss is derived from
// the move list rather than from the board. D206.

import { DEADLY_TEMPEST } from '../../../data/fixtures/engineCards';
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
  DEADLY_TEMPEST,
  'Destroy all creatures. Each player loses life equal to the number of creatures they controlled that were destroyed this way.',
);

export const DEADLY_TEMPEST_SCRIPT: CardScript = {
  oracleId: DEADLY_TEMPEST.oracleId,
  name: DEADLY_TEMPEST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const moves = [];
      const lost = new Map<string, number>();
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.keywords.has('indestructible')) continue;
        lost.set(card.controller, (lost.get(card.controller) ?? 0) + 1);
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      const events: EventBody[] = [];
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      for (const pid of ctx.state.seating) {
        const p = ctx.state.players[pid];
        const n = lost.get(pid) ?? 0;
        if (!p || p.hasLost || n === 0) continue;
        events.push({ t: 'LifeChanged', player: pid, delta: -n, to: p.life - n });
      }
      return events;
    },
  },
};
