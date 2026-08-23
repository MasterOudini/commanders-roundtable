// `Thraxodemon` — the OR-predicate 'another' chooser (Ahriman's shape, D169)
// paying for a draw. "Another" excludes the Thraxodemon itself, so unlike
// Thallid Soothsayer (D258) it can never eat itself. D259.

import { THRAXODEMON } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  THRAXODEMON,
  '{3}, {T}, Sacrifice another creature or artifact: Draw a card.',
);

export const THRAXODEMON_SCRIPT: CardScript = {
  oracleId: THRAXODEMON.oracleId,
  name: THRAXODEMON.name,
  activated: [
    {
      ref: `${THRAXODEMON.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
