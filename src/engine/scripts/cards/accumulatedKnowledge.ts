// `Accumulated Knowledge` — "Draw a card, then draw cards equal to the
// number of cards named Accumulated Knowledge in all graveyards." The
// first NAME predicate in a def: the count reads every graveyard through
// the ORACLE (a graveyard card has no battlefield derivation — the
// Desecrated Tomb rule, D171), and the card's own copy is usually IN a
// graveyard by resolution — it is on the STACK here, so it never counts
// itself, which is the printed rule falling out of the zones. D196.

import { ACCUMULATED_KNOWLEDGE } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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
  ACCUMULATED_KNOWLEDGE,
  'Draw a card, then draw cards equal to the number of cards named Accumulated Knowledge in all graveyards.',
);

export const ACCUMULATED_KNOWLEDGE_SCRIPT: CardScript = {
  oracleId: ACCUMULATED_KNOWLEDGE.oracleId,
  name: ACCUMULATED_KNOWLEDGE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const player = ctx.state.players[obj.controller];
      if (!player || player.hasLost) return [];
      let named = 0;
      for (const pid of ctx.state.seating) {
        for (const id of ctx.state.zones.graveyard[pid] ?? []) {
          const inst = ctx.state.cards[id];
          if (!inst) continue;
          if (ctx.oracle.byPrinting(inst.printingId)?.name === 'Accumulated Knowledge') named++;
        }
      }
      return drawEvents(ctx.state, obj.controller, 1 + named);
    },
  },
};
