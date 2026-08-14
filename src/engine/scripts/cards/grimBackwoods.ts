// `Grim Backwoods` — Land, "{2}{B}{G}, {T}, Sacrifice a creature: Draw a
// card." The D168 creature chooser paying for a draw; the mana line is
// ability 0. M6.4v, D178.

import { GRIM_BACKWOODS } from '../../../data/fixtures/engineCards';
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
  GRIM_BACKWOODS,
  '{T}: Add {C}.\n{2}{B}{G}, {T}, Sacrifice a creature: Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const GRIM_BACKWOODS_SCRIPT: CardScript = {
  oracleId: GRIM_BACKWOODS.oracleId,
  name: GRIM_BACKWOODS.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the sacrifice-draw as 1.
      ref: `${GRIM_BACKWOODS.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
