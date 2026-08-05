// `Azorius Cluestone` — "{T}: Add {W} or {U}.\n{W}{U}, {T}, Sacrifice this
// artifact: Draw a card." Hedron Archive's shape: the mana line is the
// engine's, the sacrifice is charged at activation (D159), the def owes the
// draw. M6.4f, D163.

import { AZORIUS_CLUESTONE } from '../../../data/fixtures/engineCards';
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
  AZORIUS_CLUESTONE,
  '{T}: Add {W} or {U}.\n{W}{U}, {T}, Sacrifice this artifact: Draw a card.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const AZORIUS_CLUESTONE_SCRIPT: CardScript = {
  oracleId: AZORIUS_CLUESTONE.oracleId,
  name: AZORIUS_CLUESTONE.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${AZORIUS_CLUESTONE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
