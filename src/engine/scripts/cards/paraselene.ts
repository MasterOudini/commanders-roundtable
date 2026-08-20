// `Paraselene` — "Destroy all enchantments. You gain 1 life for each
// enchantment destroyed this way." Multani's Decree at 1 apiece. D231.

import { PARASELENE } from '../../../data/fixtures/engineCards';
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
  PARASELENE,
  'Destroy all enchantments. You gain 1 life for each enchantment destroyed this way.',
);

export const PARASELENE_SCRIPT: CardScript = {
  oracleId: PARASELENE.oracleId,
  name: PARASELENE.name,
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
          delta: moves.length,
          to: player.life + moves.length,
        });
      }
      return events;
    },
  },
};
