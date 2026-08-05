// `Azorius Locket` — "{T}: Add {W} or {U}.\n{W/U}{W/U}{W/U}{W/U}, {T},
// Sacrifice this artifact: Draw two cards." Hedron Archive's shape with the
// first HYBRID activation cost a shipped def has charged — the cost rides the
// same payment problem a hybrid casting cost does, and the per-card test pins
// the parse as payable. M6.4f, D163.

import { AZORIUS_LOCKET } from '../../../data/fixtures/engineCards';
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
  AZORIUS_LOCKET,
  '{T}: Add {W} or {U}.\n{W/U}{W/U}{W/U}{W/U}, {T}, Sacrifice this artifact: Draw two cards.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const AZORIUS_LOCKET_SCRIPT: CardScript = {
  oracleId: AZORIUS_LOCKET.oracleId,
  name: AZORIUS_LOCKET.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${AZORIUS_LOCKET.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 2),
    },
  ],
};
