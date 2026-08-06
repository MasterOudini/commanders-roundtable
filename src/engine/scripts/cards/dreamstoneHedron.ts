// `Dreamstone Hedron` — "{T}: Add {C}{C}{C}.\n{3}, {T}, Sacrifice this
// artifact: Draw three cards." Hedron Archive's bigger sibling — the mana
// line is the engine's, the def owes the three-card draw. M6.4p, D172.

import { DREAMSTONE_HEDRON } from '../../../data/fixtures/engineCards';
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
  DREAMSTONE_HEDRON,
  '{T}: Add {C}{C}{C}.\n{3}, {T}, Sacrifice this artifact: Draw three cards.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const DREAMSTONE_HEDRON_SCRIPT: CardScript = {
  oracleId: DREAMSTONE_HEDRON.oracleId,
  name: DREAMSTONE_HEDRON.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${DREAMSTONE_HEDRON.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 3),
    },
  ],
};
