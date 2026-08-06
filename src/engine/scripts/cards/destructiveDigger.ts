// `Destructive Digger` — "{3}, {T}, Sacrifice an artifact or land: Draw a
// card." The chooser's OR predicate (Ahriman's shape — an artifact pays, a
// land pays, a creature does not) funding the one draw rule. M6.4o, D171.

import { DESTRUCTIVE_DIGGER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DESTRUCTIVE_DIGGER, '{3}, {T}, Sacrifice an artifact or land: Draw a card.');

export const DESTRUCTIVE_DIGGER_SCRIPT: CardScript = {
  oracleId: DESTRUCTIVE_DIGGER.oracleId,
  name: DESTRUCTIVE_DIGGER.name,
  activated: [
    {
      ref: `${DESTRUCTIVE_DIGGER.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
