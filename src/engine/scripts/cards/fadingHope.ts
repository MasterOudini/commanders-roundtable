// `Fading Hope` — "Return target creature to its owner's hand. If its
// mana value was 3 or less, scry 1." The MV is read BEFORE the move and
// the conditional ask is LAST (D195). D212.

import { FADING_HOPE } from '../../../data/fixtures/engineCards';
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
  FADING_HOPE,
  "Return target creature to its owner's hand. If its mana value was 3 or less, scry 1. (Look at the top card of your library. You may put that card on the bottom.)",
);

export const FADING_HOPE_SCRIPT: CardScript = {
  oracleId: FADING_HOPE.oracleId,
  name: FADING_HOPE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const mv = ctx.oracle.byPrinting(card.printingId)?.manaValue ?? 0;
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'hand', player: card.owner },
            },
          ],
        },
      ];
      if (mv > 3) return events;
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const n = Math.min(1, library.length);
      if (n === 0) return events;
      const top = library.slice(library.length - n);
      events.push({ t: 'CardsRevealed', cards: top, to: [obj.controller] });
      events.push({
        t: 'AwaitingSet',
        awaiting: {
          kind: 'scryChoice',
          player: obj.controller,
          count: n,
          toGraveyard: false,
          thenDraw: 0,
          label: obj.label,
        },
      });
      return events;
    },
  },
};
