// `Witness of Tomorrows` — flying plus a repeatable {3}{U} scry. The keyword
// line never counts, so the ability is `#a0` and its text is `split[1]`; no
// {T} in the cost, so with enough mana it goes twice. D270.

import { WITNESS_OF_TOMORROWS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WITNESS_OF_TOMORROWS, 'Flying\n{3}{U}: Scry 1.');
const TEXT = PRINTED.split('\n')[1] as string;

export const WITNESS_OF_TOMORROWS_SCRIPT: CardScript = {
  oracleId: WITNESS_OF_TOMORROWS.oracleId,
  name: WITNESS_OF_TOMORROWS.name,
  activated: [
    {
      ref: `${WITNESS_OF_TOMORROWS.oracleId}#a0`,
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
