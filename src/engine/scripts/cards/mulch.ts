// `Mulch` — "Reveal the top four cards of your library. Put all land cards
// revealed this way into your hand and the rest into your graveyard." The
// choiceless reveal-sort (Clear the Land's idiom): one reveal to every
// seat, one mixed-destination move. D226.

import { MULCH } from '../../../data/fixtures/engineCards';
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
  MULCH,
  'Reveal the top four cards of your library. Put all land cards revealed this way into your hand and the rest into your graveyard.',
);

export const MULCH_SCRIPT: CardScript = {
  oracleId: MULCH.oracleId,
  name: MULCH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const n = Math.min(4, library.length);
      if (n === 0) return [];
      const run = library.slice(library.length - n).reverse();
      const living = ctx.state.seating.filter((s) => !ctx.state.players[s]?.hasLost);
      const moves = [];
      for (const id of run) {
        const card = ctx.state.cards[id];
        const oc = card && ctx.oracle.byPrinting(card.printingId);
        const isLand = oc
          ? faceOf(oc, card.faceIndex ?? 0).typeLine.types.includes('Land')
          : false;
        moves.push({
          card: id,
          from: { kind: 'library' as const, player: obj.controller },
          to: isLand
            ? { kind: 'hand' as const, player: obj.controller }
            : { kind: 'graveyard' as const, player: obj.controller },
        });
      }
      return [{ t: 'CardsRevealed', cards: run, to: living }, { t: 'CardsMoved', moves }];
    },
  },
};
