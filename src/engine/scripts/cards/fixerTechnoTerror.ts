// `Fixer, Techno Terror` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FIXER_TECHNO_TERROR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FIXER_TECHNO_TERROR, "{T}, Pay 2 life: Draw a card. Activate only if an artifact entered under your control this turn.");

export const FIXER_TECHNO_TERROR_SCRIPT: CardScript = {
  oracleId: FIXER_TECHNO_TERROR.oracleId,
  name: FIXER_TECHNO_TERROR.name,
  activated: [
    {
      ref: `${FIXER_TECHNO_TERROR.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
