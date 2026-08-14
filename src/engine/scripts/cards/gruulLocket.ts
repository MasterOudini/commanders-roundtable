// `Gruul Locket` — "{R/G}{R/G}{R/G}{R/G}, {T}, Sacrifice this artifact:
// Draw two cards." The hybrid Locket pair's fourth colour pair. M6.4v,
// D178.

import { GRUUL_LOCKET } from '../../../data/fixtures/engineCards';
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
  GRUUL_LOCKET,
  '{T}: Add {R} or {G}.\n{R/G}{R/G}{R/G}{R/G}, {T}, Sacrifice this artifact: Draw two cards.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const GRUUL_LOCKET_SCRIPT: CardScript = {
  oracleId: GRUUL_LOCKET.oracleId,
  name: GRUUL_LOCKET.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the sacrifice-draw as 1.
      ref: `${GRUUL_LOCKET.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 2),
    },
  ],
};
