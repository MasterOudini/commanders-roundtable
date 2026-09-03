// `Mental Discipline` — two mana and a discarded card of my choice (D286)
// buy a card.

import { MENTAL_DISCIPLINE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(MENTAL_DISCIPLINE, '{1}{U}, Discard a card: Draw a card.');

export const MENTAL_DISCIPLINE_SCRIPT: CardScript = {
  oracleId: MENTAL_DISCIPLINE.oracleId,
  name: MENTAL_DISCIPLINE.name,
  activated: [
    {
      ref: `${MENTAL_DISCIPLINE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
