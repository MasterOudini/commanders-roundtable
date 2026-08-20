// `Forum of Amity` — Fields of Strife's twin on White-Black: the tapped
// entry is D134's built-in, the mana line is the engine's (#a0), the def
// claims the activated surveil at #a1. D214.

import { FORUM_OF_AMITY } from '../../../data/fixtures/engineCards';
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
  FORUM_OF_AMITY,
  'This land enters tapped.\n{T}: Add {W} or {B}.\n{2}{W}{B}, {T}: Surveil 1. (Look at the top card of your library. You may put it into your graveyard.)',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const FORUM_OF_AMITY_SCRIPT: CardScript = {
  oracleId: FORUM_OF_AMITY.oracleId,
  name: FORUM_OF_AMITY.name,
  activated: [
    {
      ref: `${FORUM_OF_AMITY.oracleId}#a1`,
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
