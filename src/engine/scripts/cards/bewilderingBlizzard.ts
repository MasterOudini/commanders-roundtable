// `Bewildering Blizzard` — "Draw three cards. Creatures your opponents
// control get -3/-0 until end of turn." The draws through THE draw rule,
// then one entry per opposing DERIVED creature. D199.

import { BEWILDERING_BLIZZARD } from '../../../data/fixtures/engineCards';
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
  BEWILDERING_BLIZZARD,
  'Draw three cards. Creatures your opponents control get -3/-0 until end of turn.',
);

export const BEWILDERING_BLIZZARD_SCRIPT: CardScript = {
  oracleId: BEWILDERING_BLIZZARD.oracleId,
  name: BEWILDERING_BLIZZARD.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [...drawEvents(ctx.state, obj.controller, 3)];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller === obj.controller) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -3, toughness: 0 });
      }
      return events;
    },
  },
};
