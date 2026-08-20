// `Honor the Fallen` — exile every creature card from EVERY graveyard,
// gaining 1 per card taken. D218.

import { HONOR_THE_FALLEN } from '../../../data/fixtures/engineCards';
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
  HONOR_THE_FALLEN,
  'Exile all creature cards from all graveyards. You gain 1 life for each card exiled this way.',
);

export const HONOR_THE_FALLEN_SCRIPT: CardScript = {
  oracleId: HONOR_THE_FALLEN.oracleId,
  name: HONOR_THE_FALLEN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const moves = [];
      for (const pid of ctx.state.seating) {
        for (const id of ctx.state.zones.graveyard[pid] ?? []) {
          const card = ctx.state.cards[id];
          const oc = card && ctx.oracle.byPrinting(card.printingId);
          if (!oc) continue;
          if (!faceOf(oc, card.faceIndex ?? 0).typeLine.types.includes('Creature')) continue;
          moves.push({
            card: id,
            from: { kind: 'graveyard' as const, player: pid },
            to: { kind: 'exile' as const, player: card.owner },
          });
        }
      }
      if (moves.length === 0) return [];
      const events: EventBody[] = [{ t: 'CardsMoved', moves }];
      const me = ctx.state.players[obj.controller];
      if (me && !me.hasLost) {
        events.push({
          t: 'LifeChanged',
          player: obj.controller,
          delta: moves.length,
          to: me.life + moves.length,
        });
      }
      return events;
    },
  },
};
