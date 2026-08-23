// `Treasure Trove` — the plain repeatable draw on an enchantment: no tap in
// the cost, so it is limited only by mana. D262.

import { TREASURE_TROVE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TREASURE_TROVE, '{2}{U}{U}: Draw a card.');

export const TREASURE_TROVE_SCRIPT: CardScript = {
  oracleId: TREASURE_TROVE.oracleId,
  name: TREASURE_TROVE.name,
  activated: [
    {
      ref: `${TREASURE_TROVE.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
