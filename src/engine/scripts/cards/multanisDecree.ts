// `Multani's Decree` — "Destroy all enchantments. You gain 2 life for each
// enchantment destroyed this way." Fumigate's own-kills count at 2 apiece.
// D226.

import { MULTANI_S_DECREE } from '../../../data/fixtures/engineCards';
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
  MULTANI_S_DECREE,
  'Destroy all enchantments. You gain 2 life for each enchantment destroyed this way.',
);

export const MULTANIS_DECREE_SCRIPT: CardScript = {
  oracleId: MULTANI_S_DECREE.oracleId,
  name: MULTANI_S_DECREE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Enchantment')) continue;
        if (d.keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      const events: EventBody[] = [];
      if (moves.length > 0) events.push({ t: 'CardsMoved', moves });
      const player = ctx.state.players[obj.controller];
      if (moves.length > 0 && player && !player.hasLost) {
        events.push({
          t: 'LifeChanged',
          player: obj.controller,
          delta: moves.length * 2,
          to: player.life + moves.length * 2,
        });
      }
      return events;
    },
  },
};
