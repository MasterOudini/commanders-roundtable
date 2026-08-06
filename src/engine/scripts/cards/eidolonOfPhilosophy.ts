// `Eidolon of Philosophy` — "{6}{U}, Sacrifice this creature: Draw three
// cards." Dreamstone Hedron's draw on a one-drop body, no tap in the cost.
// M6.4q, D173.

import { EIDOLON_OF_PHILOSOPHY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(EIDOLON_OF_PHILOSOPHY, '{6}{U}, Sacrifice this creature: Draw three cards.');

export const EIDOLON_OF_PHILOSOPHY_SCRIPT: CardScript = {
  oracleId: EIDOLON_OF_PHILOSOPHY.oracleId,
  name: EIDOLON_OF_PHILOSOPHY.name,
  activated: [
    {
      ref: `${EIDOLON_OF_PHILOSOPHY.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 3),
    },
  ],
};
