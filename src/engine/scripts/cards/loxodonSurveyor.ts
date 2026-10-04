// `Loxodon Surveyor` - an activation draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LOXODON_SURVEYOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LOXODON_SURVEYOR, "Start your engines! (If you have no speed, it starts at 1. It increases once on each of your turns when an opponent loses life. Max speed is 4.)\nMax speed — {3}, Exile this card from your graveyard: Draw a card.");
const LINES = PRINTED.split('\n');

export const LOXODON_SURVEYOR_SCRIPT: CardScript = {
  oracleId: LOXODON_SURVEYOR.oracleId,
  name: LOXODON_SURVEYOR.name,
  activated: [
    {
      ref: `${LOXODON_SURVEYOR.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
};
