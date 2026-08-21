// `Stronghold Discipline` — each player loses 1 per creature THEY control:
// the census is per-seat, counted before any of the losses land. D254.

import { STRONGHOLD_DISCIPLINE } from '../../../data/fixtures/engineCards';
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
  STRONGHOLD_DISCIPLINE,
  'Each player loses 1 life for each creature they control.',
);

export const STRONGHOLD_DISCIPLINE_SCRIPT: CardScript = {
  oracleId: STRONGHOLD_DISCIPLINE.oracleId,
  name: STRONGHOLD_DISCIPLINE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const counts = new Map<string, number>();
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        counts.set(card.controller, (counts.get(card.controller) ?? 0) + 1);
      }
      const events: EventBody[] = [];
      for (const pid of ctx.state.seating) {
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        const n = counts.get(pid) ?? 0;
        if (n <= 0) continue;
        events.push({ t: 'LifeChanged', player: pid, delta: -n, to: p.life - n });
      }
      return events;
    },
  },
};
