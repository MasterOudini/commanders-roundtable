// `End Hostilities` — "Destroy all creatures and all permanents attached
// to creatures." The wipe plus an attachedTo scan: an Equipment on a
// creature dies with its host, an unattached one stands. Attachment is
// judged against the pre-wipe board (the sentence is simultaneous). D210.

import { END_HOSTILITIES } from '../../../data/fixtures/engineCards';
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
  END_HOSTILITIES,
  'Destroy all creatures and all permanents attached to creatures.',
);

export const END_HOSTILITIES_SCRIPT: CardScript = {
  oracleId: END_HOSTILITIES.oracleId,
  name: END_HOSTILITIES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const creatures = new Set<string>();
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        if (ctx.derive(id).typeLine.types.includes('Creature')) creatures.add(id);
      }
      const moves = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const isCreature = creatures.has(id);
        const attachedToCreature = card.attachedTo !== null && creatures.has(card.attachedTo);
        if (!isCreature && !attachedToCreature) continue;
        if (ctx.derive(id).keywords.has('indestructible')) continue;
        moves.push({
          card: id,
          from: { kind: 'battlefield' as const, player: card.controller },
          to: { kind: 'graveyard' as const, player: card.owner },
        });
      }
      if (moves.length === 0) return [];
      return [{ t: 'CardsMoved', moves }];
    },
  },
};
