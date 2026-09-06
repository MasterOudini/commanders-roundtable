// `Talas Researcher` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TALAS_RESEARCHER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TALAS_RESEARCHER, "{T}: Draw a card. Activate only during your turn, before attackers are declared.");

export const TALAS_RESEARCHER_SCRIPT: CardScript = {
  oracleId: TALAS_RESEARCHER.oracleId,
  name: TALAS_RESEARCHER.name,
  activated: [
    {
      ref: `${TALAS_RESEARCHER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
