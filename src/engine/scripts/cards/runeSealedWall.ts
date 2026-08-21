// `Rune-Sealed Wall` — "Defender / {T}: Surveil 1." The tap-surveil
// behind a keyword line: the ability is #a0. D242.

import { RUNE_SEALED_WALL } from '../../../data/fixtures/engineCards';
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
  RUNE_SEALED_WALL,
  'Defender\n{T}: Surveil 1. (Look at the top card of your library. You may put it into your graveyard.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const RUNE_SEALED_WALL_SCRIPT: CardScript = {
  oracleId: RUNE_SEALED_WALL.oracleId,
  name: RUNE_SEALED_WALL.name,
  activated: [
    {
      ref: `${RUNE_SEALED_WALL.oracleId}#a0`,
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
