// `Rummaging Goblin` — the tap and a card of my choice discarded (the D286
// discard chooser, charged in the cost batch) buy a card.

import { RUMMAGING_GOBLIN } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RUMMAGING_GOBLIN, '{T}, Discard a card: Draw a card.');

export const RUMMAGING_GOBLIN_SCRIPT: CardScript = {
  oracleId: RUMMAGING_GOBLIN.oracleId,
  name: RUMMAGING_GOBLIN.name,
  activated: [
    {
      ref: `${RUMMAGING_GOBLIN.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
