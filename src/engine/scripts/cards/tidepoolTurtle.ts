// `Tidepool Turtle` — the activated SCRY on a creature (Oggyar Battle-Seer's
// shape, D229). No tap in the cost, so it is limited only by mana. D260.

import { TIDEPOOL_TURTLE } from '../../../data/fixtures/engineCards';
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
  TIDEPOOL_TURTLE,
  '{2}{U}: Scry 1. (Look at the top card of your library. You may put that card on the bottom.)',
);

export const TIDEPOOL_TURTLE_SCRIPT: CardScript = {
  oracleId: TIDEPOOL_TURTLE.oracleId,
  name: TIDEPOOL_TURTLE.name,
  activated: [
    {
      ref: `${TIDEPOOL_TURTLE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          {
            t: 'AwaitingSet',
            awaiting: {
              kind: 'scryChoice',
              player: obj.controller,
              count: n,
              toGraveyard: false,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
