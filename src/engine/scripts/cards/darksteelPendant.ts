// `Darksteel Pendant` — indestructible (Tier 2, keywords) plus
// "{1}, {T}: Scry 1." Crystal Ball one card shallower; the keyword line
// never counts in the ability index (Advance Scout's rule), so the scry is
// #a0. D206.

import { DARKSTEEL_PENDANT } from '../../../data/fixtures/engineCards';
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
  DARKSTEEL_PENDANT,
  'Indestructible (Effects that say "destroy" don\'t destroy this artifact.)\n{1}, {T}: Scry 1. (Look at the top card of your library. You may put that card on the bottom.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const DARKSTEEL_PENDANT_SCRIPT: CardScript = {
  oracleId: DARKSTEEL_PENDANT.oracleId,
  name: DARKSTEEL_PENDANT.name,
  activated: [
    {
      ref: `${DARKSTEEL_PENDANT.oracleId}#a0`,
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
