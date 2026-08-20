// `Death Begets Life` — "Destroy all creatures and enchantments. Draw a
// card for each permanent destroyed this way." The two-type wipe with
// Fumigate's destroyed-this-way count feeding THE draw rule. A permanent
// that is BOTH types dies once and counts once. D206.

import { DEATH_BEGETS_LIFE } from '../../../data/fixtures/engineCards';
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
  DEATH_BEGETS_LIFE,
  'Destroy all creatures and enchantments. Draw a card for each permanent destroyed this way.',
);

export const DEATH_BEGETS_LIFE_SCRIPT: CardScript = {
  oracleId: DEATH_BEGETS_LIFE.oracleId,
  name: DEATH_BEGETS_LIFE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        const types = d.typeLine.types;
        if (!types.includes('Creature') && !types.includes('Enchantment')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      const events: EventBody[] = [];
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      if (moves.length > 0) events.push(...drawEvents(ctx.state, obj.controller, moves.length));
      return events;
    },
  },
};
