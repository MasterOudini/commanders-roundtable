// `Illvoi Galeblade` — "{2}, Sacrifice this creature: Draw a card." Heart
// Warden's payoff with NO mana ability above it, so the sacrifice-draw is
// `#a0`; Flash and Flying are the engine's. M6.4x, D180.

import { ILLVOI_GALEBLADE } from '../../../data/fixtures/engineCards';
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
  ILLVOI_GALEBLADE,
  'Flash\nFlying\n{2}, Sacrifice this creature: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const ILLVOI_GALEBLADE_SCRIPT: CardScript = {
  oracleId: ILLVOI_GALEBLADE.oracleId,
  name: ILLVOI_GALEBLADE.name,
  activated: [
    {
      ref: `${ILLVOI_GALEBLADE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
