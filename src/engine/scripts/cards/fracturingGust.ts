// `Fracturing Gust` — "Destroy all artifacts and enchantments. You gain 2
// life for each permanent destroyed this way." Fumigate's
// destroyed-this-way count at 2 apiece over the two-type wipe. D214.

import { FRACTURING_GUST } from '../../../data/fixtures/engineCards';
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
  FRACTURING_GUST,
  'Destroy all artifacts and enchantments. You gain 2 life for each permanent destroyed this way.',
);

export const FRACTURING_GUST_SCRIPT: CardScript = {
  oracleId: FRACTURING_GUST.oracleId,
  name: FRACTURING_GUST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        const types = d.typeLine.types;
        if (!types.includes('Artifact') && !types.includes('Enchantment')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      const events: EventBody[] = [];
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      const me = ctx.state.players[obj.controller];
      if (moves.length > 0 && me && !me.hasLost) {
        events.push({
          t: 'LifeChanged',
          player: obj.controller,
          delta: 2 * moves.length,
          to: me.life + 2 * moves.length,
        });
      }
      return events;
    },
  },
};
