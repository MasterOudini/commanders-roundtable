// `Risky Research` — "Surveil 2, then draw two cards. You lose 2 life."
// Notion Rain's exact shape with LifeChanged for the recoil: the loss
// emitted FIRST because the ask must be LAST (D195), and an empty
// library still draws through THE draw rule. D240.

import { RISKY_RESEARCH } from '../../../data/fixtures/engineCards';
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
  RISKY_RESEARCH,
  'Surveil 2, then draw two cards. You lose 2 life. ' +
    '(To surveil 2, look at the top two cards of your library, then put any number of them into your graveyard and the rest on top of your library in any order.)',
);

export const RISKY_RESEARCH_SCRIPT: CardScript = {
  oracleId: RISKY_RESEARCH.oracleId,
  name: RISKY_RESEARCH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: -2, to: me.life - 2 });
      }
      const library = ctx.state.zones.library[obj.controller] ?? [];
      const n = Math.min(2, library.length);
      if (n > 0) {
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
      } else {
        events.push(...drawEvents(ctx.state, obj.controller, 2));
      }
      return events;
    },
  },
};
