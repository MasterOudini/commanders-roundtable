// `Etherium Astrolabe` — "Flash\n{B}, {T}, Sacrifice an artifact: Draw a
// card." The chooser's artifact predicate funding the one draw rule — and
// the Astrolabe is itself an artifact, so it may pay with itself (Claws of
// Gix's rule, CR 113.7a). M6.4r, D174.

import { ETHERIUM_ASTROLABE } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(ETHERIUM_ASTROLABE, 'Flash\n{B}, {T}, Sacrifice an artifact: Draw a card.');
const TEXT = PRINTED.split('\n')[1] as string;

export const ETHERIUM_ASTROLABE_SCRIPT: CardScript = {
  oracleId: ETHERIUM_ASTROLABE.oracleId,
  name: ETHERIUM_ASTROLABE.name,
  activated: [
    {
      // `#a1`: Flash parses as line 0's keyword; the draw is ability 0 of the
      // activated list — but the REF namespace counts activated lines, so the
      // colon line is `#a0`.
      ref: `${ETHERIUM_ASTROLABE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
