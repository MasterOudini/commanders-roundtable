// `Greed` — "{B}, Pay 2 life: Draw a card." Book of Rass's life-and-mana
// activation cost (D165) on an enchantment, repeatable. M6.4v, D178.

import { GREED } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(GREED, '{B}, Pay 2 life: Draw a card.');

export const GREED_SCRIPT: CardScript = {
  oracleId: GREED.oracleId,
  name: GREED.name,
  activated: [
    {
      // The card's whole text is this one ability: index 0.
      ref: `${GREED.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
