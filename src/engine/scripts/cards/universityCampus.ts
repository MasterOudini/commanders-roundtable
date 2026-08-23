// `University Campus` — the ACTIVATED surveil land behind a tapped entry
// (Titan's Grave's shape, D260). Three printed lines: the tapped entry is
// D134's built-in, the mana line is the engine's ability 0, and this def is
// #a1. D264.

import { UNIVERSITY_CAMPUS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  UNIVERSITY_CAMPUS,
  'This land enters tapped.\n{T}: Add {W} or {U}.\n{4}, {T}: Surveil 1. (Look at the top card of your library. You may put it into your graveyard.)',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const UNIVERSITY_CAMPUS_SCRIPT: CardScript = {
  oracleId: UNIVERSITY_CAMPUS.oracleId,
  name: UNIVERSITY_CAMPUS.name,
  activated: [
    {
      ref: `${UNIVERSITY_CAMPUS.oracleId}#a1`,
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
