// `Tocasia's Dig Site` — Titan's Grave's activated surveil WITHOUT a tapped
// entry, so the def is at #a1 of a two-line card rather than a three-line
// one. The pair is worth landing together: it is the same ability behind a
// different first line. D260.

import { TOCASIA_S_DIG_SITE } from '../../../data/fixtures/engineCards';
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
  TOCASIA_S_DIG_SITE,
  '{T}: Add {C}.\n{3}, {T}: Surveil 1. (Look at the top card of your library. You may put it into your graveyard.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const TOCASIAS_DIG_SITE_SCRIPT: CardScript = {
  oracleId: TOCASIA_S_DIG_SITE.oracleId,
  name: TOCASIA_S_DIG_SITE.name,
  activated: [
    {
      ref: `${TOCASIA_S_DIG_SITE.oracleId}#a1`,
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
