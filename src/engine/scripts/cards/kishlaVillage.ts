// `Kishla Village` — three printed lines: the conditional enters-tapped
// is D135's built-in, the mana line is the engine's (#a0), and the def
// claims the paid surveil at #a1 (Fields of Strife's index rule: mana
// lines COUNT). D221.

import { KISHLA_VILLAGE } from '../../../data/fixtures/engineCards';
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
  KISHLA_VILLAGE,
  'This land enters tapped unless you control an Island or a Swamp.\n{T}: Add {G}.\n{3}{G}, {T}: Surveil 2. (Look at the top two cards of your library, then put any number of them into your graveyard and the rest on top of your library in any order.)',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const KISHLA_VILLAGE_SCRIPT: CardScript = {
  oracleId: KISHLA_VILLAGE.oracleId,
  name: KISHLA_VILLAGE.name,
  activated: [
    {
      ref: `${KISHLA_VILLAGE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
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
