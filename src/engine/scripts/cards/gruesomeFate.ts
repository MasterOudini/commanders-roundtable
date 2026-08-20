// `Gruesome Fate` — each opponent loses 1 per creature I control. D216.

import { GRUESOME_FATE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GRUESOME_FATE, 'Each opponent loses 1 life for each creature you control.');

export const GRUESOME_FATE_SCRIPT: CardScript = {
  oracleId: GRUESOME_FATE.oracleId,
  name: GRUESOME_FATE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let n = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.types.includes('Creature')) n++;
      }
      if (n === 0) return [];
      const events: EventBody[] = [];
      for (const pid of ctx.state.seating) {
        if (pid === obj.controller) continue;
        const p = ctx.state.players[pid];
        if (!p || p.hasLost) continue;
        events.push({ t: 'LifeChanged', player: pid, delta: -n, to: p.life - n });
      }
      return events;
    },
  },
};
