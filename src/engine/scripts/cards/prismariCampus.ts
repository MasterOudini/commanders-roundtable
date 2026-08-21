// `Prismari Campus` — "{4}, {T}: Scry 1." The paid activated scry on a
// campus land; the tapped entry is D134's built-in and the mana line is
// the engine's. D235.

import { PRISMARI_CAMPUS } from '../../../data/fixtures/engineCards';
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
  PRISMARI_CAMPUS,
  'This land enters tapped.\n{T}: Add {U} or {R}.\n{4}, {T}: Scry 1. ' +
    '(Look at the top card of your library. You may put that card on the bottom.)',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const PRISMARI_CAMPUS_SCRIPT: CardScript = {
  oracleId: PRISMARI_CAMPUS.oracleId,
  name: PRISMARI_CAMPUS.name,
  activated: [
    {
      ref: `${PRISMARI_CAMPUS.oracleId}#a1`,
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
