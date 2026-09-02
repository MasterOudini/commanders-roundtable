// `Wretched Doll` — "{B}, {T}: Surveil 1." The activated surveil: a scry with
// `toGraveyard: true`, reveal FIRST and the ask LAST (D195). D271.

import { WRETCHED_DOLL } from '../../../data/fixtures/engineCards';
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
  WRETCHED_DOLL,
  '{B}, {T}: Surveil 1. (Look at the top card of your library. You may put that card into your graveyard.)',
);

export const WRETCHED_DOLL_SCRIPT: CardScript = {
  oracleId: WRETCHED_DOLL.oracleId,
  name: WRETCHED_DOLL.name,
  activated: [
    {
      ref: `${WRETCHED_DOLL.oracleId}#a0`,
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
              toGraveyard: true,
              thenDraw: 0,
              label: obj.label,
            },
          },
        ];
      },
    },
  ],
};
