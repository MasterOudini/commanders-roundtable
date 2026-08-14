// `Izzet Locket` — "{T}: Add {U} or {R}.\n{U/R}{U/R}{U/R}{U/R}, {T},
// Sacrifice this artifact: Draw two cards." The hybrid ×4 draw-two, Azorius
// Locket's shape (D163). M6.4z, D182.

import { IZZET_LOCKET } from '../../../data/fixtures/engineCards';
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
  IZZET_LOCKET,
  '{T}: Add {U} or {R}.\n{U/R}{U/R}{U/R}{U/R}, {T}, Sacrifice this artifact: Draw two cards.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const IZZET_LOCKET_SCRIPT: CardScript = {
  oracleId: IZZET_LOCKET.oracleId,
  name: IZZET_LOCKET.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${IZZET_LOCKET.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 2),
    },
  ],
};
