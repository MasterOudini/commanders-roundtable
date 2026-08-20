// `Fields of Strife` — the enters-tapped line is D134's built-in, the mana
// line is the engine's (#a0), and the def claims the ACTIVATED surveil at
// #a1 (Castle Vantress's seam with the graveyard destination). D213.

import { FIELDS_OF_STRIFE } from '../../../data/fixtures/engineCards';
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
  FIELDS_OF_STRIFE,
  'This land enters tapped.\n{T}: Add {R} or {W}.\n{2}{R}{W}, {T}: Surveil 1. (Look at the top card of your library. You may put it into your graveyard.)',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const FIELDS_OF_STRIFE_SCRIPT: CardScript = {
  oracleId: FIELDS_OF_STRIFE.oracleId,
  name: FIELDS_OF_STRIFE.name,
  activated: [
    {
      ref: `${FIELDS_OF_STRIFE.oracleId}#a1`,
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
