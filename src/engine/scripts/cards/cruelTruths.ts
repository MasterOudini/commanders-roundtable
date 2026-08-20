// `Cruel Truths` — "Surveil 2, then draw two cards. You lose 2 life." The
// draws ride the D195 `thenDraw`; the flat life loss COMMUTES with both
// (nothing about the loss depends on the reorder or the draws), so it is
// emitted BEFORE the ask — every printed effect executes, none is dropped
// behind the AwaitingSet. D205.

import { CRUEL_TRUTHS } from '../../../data/fixtures/engineCards';
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
  CRUEL_TRUTHS,
  'Surveil 2, then draw two cards. You lose 2 life. (To surveil 2, look at the top two cards of your library, then put any number of them into your graveyard and the rest on top of your library in any order.)',
);

export const CRUEL_TRUTHS_SCRIPT: CardScript = {
  oracleId: CRUEL_TRUTHS.oracleId,
  name: CRUEL_TRUTHS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const life = ctx.state.players[obj.controller]?.life ?? 0;
      const events: EventBody[] = [
        { t: 'LifeChanged', player: obj.controller, delta: -2, to: life - 2 },
      ];
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const n = Math.min(2, library.length);
      if (n === 0) return events;
      const top = library.slice(library.length - n);
      events.push({ t: 'CardsRevealed', cards: top, to: [obj.controller] });
      events.push({
        t: 'AwaitingSet',
        awaiting: {
          kind: 'scryChoice',
          player: obj.controller,
          count: n,
          toGraveyard: true,
          thenDraw: 2,
          label: obj.label,
        },
      });
      return events;
    },
  },
};
