// `Beast Hunt` — "Reveal the top three cards of your library. Put all
// creature cards revealed this way into your hand and the rest into your
// graveyard." A choiceless type-sort: the reveal is PUBLIC, the split reads
// the ORACLE face (a library card derives nothing — Desecrated Tomb's
// rule). D199.

import { BEAST_HUNT } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
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
  BEAST_HUNT,
  'Reveal the top three cards of your library. Put all creature cards revealed this way into your hand and the rest into your graveyard.',
);

export const BEAST_HUNT_SCRIPT: CardScript = {
  oracleId: BEAST_HUNT.oracleId,
  name: BEAST_HUNT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const n = Math.min(3, library.length);
      if (n === 0) return [];
      // Top of library is the END of the array.
      const top = library.slice(library.length - n);
      const events: EventBody[] = [
        { t: 'CardsRevealed', cards: [...top], to: [...ctx.state.seating] },
      ];
      const moves = [];
      for (const id of top) {
        const card = ctx.state.cards[id];
        const oc = card ? ctx.oracle.byPrinting(card.printingId) : undefined;
        const isCreature = oc
          ? faceOf(oc, card?.faceIndex ?? 0).typeLine.types.includes('Creature')
          : false;
        moves.push({
          card: id,
          from: { kind: 'library' as const, player: obj.controller },
          to: isCreature
            ? { kind: 'hand' as const, player: obj.controller }
            : { kind: 'graveyard' as const, player: card?.owner ?? obj.controller },
        });
      }
      events.push({ t: 'CardsMoved', moves });
      return events;
    },
  },
};
