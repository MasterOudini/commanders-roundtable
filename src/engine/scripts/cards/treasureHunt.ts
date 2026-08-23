// `Treasure Hunt` — reveal until a NONLAND, and take the whole run to hand.
// Destroy the Evidence's walk (D208) with the predicate inverted and the
// destination changed: the library is read from the END, because that is the
// top (`drawFromTop` takes from there and `addToZone` appends).
//
// ⚠️ The reveal goes to EVERY living player: the card says "reveal", which is
// public, and the run is leaving the library anyway. D262.

import { TREASURE_HUNT } from '../../../data/fixtures/engineCards';
import { faceOf } from '../../oracle';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  TREASURE_HUNT,
  'Reveal cards from the top of your library until you reveal a nonland card, then put all cards revealed this way into your hand.',
);

export const TREASURE_HUNT_SCRIPT: CardScript = {
  oracleId: TREASURE_HUNT.oracleId,
  name: TREASURE_HUNT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const run: InstanceId[] = [];
      for (let i = library.length - 1; i >= 0; i--) {
        const id = library[i]!;
        run.push(id);
        const card = ctx.state.cards[id];
        const oc = card && ctx.oracle.byPrinting(card.printingId);
        // The run STOPS on the first nonland — and includes it.
        if (oc && !faceOf(oc, card.faceIndex ?? 0).typeLine.types.includes('Land')) break;
      }
      if (run.length === 0) return [];
      const living = ctx.state.seating.filter((p) => !ctx.state.players[p]?.hasLost);
      return [
        { t: 'CardsRevealed', cards: run, to: living },
        {
          t: 'CardsMoved',
          moves: run.map((id) => ({
            card: id,
            from: { kind: 'library' as const, player: obj.controller },
            to: { kind: 'hand' as const, player: obj.controller },
          })),
        },
      ];
    },
  },
};
