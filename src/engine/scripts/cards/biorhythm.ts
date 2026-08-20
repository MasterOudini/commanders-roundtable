// `Biorhythm` — "Each player's life total becomes the number of creatures
// they control." A life SET is a computed DELTA: `LifeChanged` carries both,
// and a player already at their count gets no event. D200.

import { BIORHYTHM } from '../../../data/fixtures/engineCards';
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
  BIORHYTHM,
  "Each player's life total becomes the number of creatures they control.",
);

export const BIORHYTHM_SCRIPT: CardScript = {
  oracleId: BIORHYTHM.oracleId,
  name: BIORHYTHM.name,
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
        const target = counts.get(pid) ?? 0;
        if (target === p.life) continue;
        events.push({ t: 'LifeChanged', player: pid, delta: target - p.life, to: target });
      }
      return events;
    },
  },
};
