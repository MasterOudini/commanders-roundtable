// `Drown in Sorrow` — "All creatures get -2/-2 until end of turn. Scry 1."
// The debuff commutes with the scry, so it lands first and the ask is LAST
// (D195's rule met by construction). D209.

import { DROWN_IN_SORROW } from '../../../data/fixtures/engineCards';
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
  DROWN_IN_SORROW,
  'All creatures get -2/-2 until end of turn. Scry 1. (Look at the top card of your library. You may put that card on the bottom.)',
);

export const DROWN_IN_SORROW_SCRIPT: CardScript = {
  oracleId: DROWN_IN_SORROW.oracleId,
  name: DROWN_IN_SORROW.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -2, toughness: -2 });
      }
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
