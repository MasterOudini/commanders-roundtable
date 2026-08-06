// `Dockside Chef` — "{1}{B}, Sacrifice an artifact or creature: Draw a card."
// Destructive Digger's OR-predicate chooser one type pair over, with no tap in
// the cost — twice in one turn is legal. M6.4o, D171.

import { DOCKSIDE_CHEF } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(DOCKSIDE_CHEF, '{1}{B}, Sacrifice an artifact or creature: Draw a card.');

export const DOCKSIDE_CHEF_SCRIPT: CardScript = {
  oracleId: DOCKSIDE_CHEF.oracleId,
  name: DOCKSIDE_CHEF.name,
  activated: [
    {
      ref: `${DOCKSIDE_CHEF.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
