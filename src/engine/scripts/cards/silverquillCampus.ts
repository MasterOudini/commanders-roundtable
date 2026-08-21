// `Silverquill Campus` — the paid scry land: tapped built-in, mana at
// a0, the {4}, {T} scry the def claims at #a1 (TEXT = split[2]). D247.

import { SILVERQUILL_CAMPUS } from '../../../data/fixtures/engineCards';
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
  SILVERQUILL_CAMPUS,
  'This land enters tapped.\n{T}: Add {W} or {B}.\n{4}, {T}: Scry 1. ' +
    '(Look at the top card of your library. You may put that card on the bottom.)',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const SILVERQUILL_CAMPUS_SCRIPT: CardScript = {
  oracleId: SILVERQUILL_CAMPUS.oracleId,
  name: SILVERQUILL_CAMPUS.name,
  activated: [
    {
      ref: `${SILVERQUILL_CAMPUS.oracleId}#a1`,
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
