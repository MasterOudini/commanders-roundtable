// `Righteous Fury` — "Destroy all tapped creatures. You gain 2 life for
// each creature destroyed this way." Guan Yu's tapped sweep paying
// Multani's Decree's per-kill bounty; an indestructible survivor is not
// "destroyed this way" and pays nothing. D240.

import { RIGHTEOUS_FURY } from '../../../data/fixtures/engineCards';
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
  RIGHTEOUS_FURY,
  'Destroy all tapped creatures. You gain 2 life for each creature destroyed this way.',
);

export const RIGHTEOUS_FURY_SCRIPT: CardScript = {
  oracleId: RIGHTEOUS_FURY.oracleId,
  name: RIGHTEOUS_FURY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || !card.tapped) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      const events: EventBody[] = [{ t: 'CardsMoved', moves }];
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        const gain = 2 * moves.length;
        events.push({ t: 'LifeChanged', player: obj.controller, delta: gain, to: me.life + gain });
      }
      return events;
    },
  },
};
