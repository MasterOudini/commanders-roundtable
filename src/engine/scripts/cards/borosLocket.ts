// `Boros Locket` — "{T}: Add {R} or {W}.\n{R/W}{R/W}{R/W}{R/W}, {T},
// Sacrifice this artifact: Draw two cards." Azorius Locket's hybrid shape.
// M6.4h, D165.

import { BOROS_LOCKET } from '../../../data/fixtures/engineCards';
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
  BOROS_LOCKET,
  '{T}: Add {R} or {W}.\n{R/W}{R/W}{R/W}{R/W}, {T}, Sacrifice this artifact: Draw two cards.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const BOROS_LOCKET_SCRIPT: CardScript = {
  oracleId: BOROS_LOCKET.oracleId,
  name: BOROS_LOCKET.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${BOROS_LOCKET.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 2),
    },
  ],
};
