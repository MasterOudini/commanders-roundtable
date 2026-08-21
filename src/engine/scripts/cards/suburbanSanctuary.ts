// `Suburban Sanctuary` — the paid surveil land at #a1 (TEXT = split[2]).
// D254.

import { SUBURBAN_SANCTUARY } from '../../../data/fixtures/engineCards';
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
  SUBURBAN_SANCTUARY,
  'This land enters tapped.\n{T}: Add {G} or {W}.\n{4}, {T}: Surveil 1. ' +
    '(Look at the top card of your library. You may put it into your graveyard.)',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const SUBURBAN_SANCTUARY_SCRIPT: CardScript = {
  oracleId: SUBURBAN_SANCTUARY.oracleId,
  name: SUBURBAN_SANCTUARY.name,
  activated: [
    {
      ref: `${SUBURBAN_SANCTUARY.oracleId}#a1`,
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
