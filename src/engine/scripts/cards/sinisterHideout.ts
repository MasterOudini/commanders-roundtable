// `Sinister Hideout` — the paid surveil land: tapped built-in, mana at a0,
// the {4}, {T} surveil the def claims at #a1 (TEXT = split[2]). D248.

import { SINISTER_HIDEOUT } from '../../../data/fixtures/engineCards';
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
  SINISTER_HIDEOUT,
  'This land enters tapped.\n{T}: Add {U} or {B}.\n{4}, {T}: Surveil 1. ' +
    '(Look at the top card of your library. You may put it into your graveyard.)',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const SINISTER_HIDEOUT_SCRIPT: CardScript = {
  oracleId: SINISTER_HIDEOUT.oracleId,
  name: SINISTER_HIDEOUT.name,
  activated: [
    {
      ref: `${SINISTER_HIDEOUT.oracleId}#a1`,
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
