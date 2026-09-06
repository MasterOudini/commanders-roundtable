// `Lu Su, Wu Advisor` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LU_SU_WU_ADVISOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LU_SU_WU_ADVISOR, "{T}: Draw a card. Activate only during your turn, before attackers are declared.");

export const LU_SU_WU_ADVISOR_SCRIPT: CardScript = {
  oracleId: LU_SU_WU_ADVISOR.oracleId,
  name: LU_SU_WU_ADVISOR.name,
  activated: [
    {
      ref: `${LU_SU_WU_ADVISOR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
