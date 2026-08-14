// `Letter of Acceptance` — "{T}: Add one mana of any color.\n{2}, {T},
// Sacrifice this artifact: Draw a card." The Cluestone payoff behind an
// any-colour mana line. M6.4ab, D184.

import { LETTER_OF_ACCEPTANCE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  LETTER_OF_ACCEPTANCE,
  '{T}: Add one mana of any color.\n{2}, {T}, Sacrifice this artifact: Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const LETTER_OF_ACCEPTANCE_SCRIPT: CardScript = {
  oracleId: LETTER_OF_ACCEPTANCE.oracleId,
  name: LETTER_OF_ACCEPTANCE.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${LETTER_OF_ACCEPTANCE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
