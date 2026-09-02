// `Witherbloom Campus` — Land, "This land enters tapped.\n{T}: Add {B} or
// {G}.\n{4}, {T}: Scry 1." A member of the CAMPUS cycle; four siblings are
// already shipped, so this is family work rather than a new shape.
//
// ⚠️ The mana line COUNTS as an ability, so the scry is `#a1` — the same
// indexing as D268's Waterfront District and D266's Vitu-Ghazi. Written by
// hand here; the family is a generator candidate once the other four members'
// exact texts are confirmed (noted in the recipe). D270.

import { WITHERBLOOM_CAMPUS } from '../../../data/fixtures/engineCards';
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
  WITHERBLOOM_CAMPUS,
  'This land enters tapped.\n{T}: Add {B} or {G}.\n{4}, {T}: Scry 1. (Look at the top card of your library. You may put that card on the bottom.)',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const WITHERBLOOM_CAMPUS_SCRIPT: CardScript = {
  oracleId: WITHERBLOOM_CAMPUS.oracleId,
  name: WITHERBLOOM_CAMPUS.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the scry as ability 1.
      ref: `${WITHERBLOOM_CAMPUS.oracleId}#a1`,
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
