// `Mystic Archaeologist` — "{3}{U}{U}: Draw two cards." Azure Mage's
// repeatable draw at a bigger price. D227.

import { MYSTIC_ARCHAEOLOGIST } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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

const TEXT = printed(MYSTIC_ARCHAEOLOGIST, '{3}{U}{U}: Draw two cards.');

export const MYSTIC_ARCHAEOLOGIST_SCRIPT: CardScript = {
  oracleId: MYSTIC_ARCHAEOLOGIST.oracleId,
  name: MYSTIC_ARCHAEOLOGIST.name,
  activated: [
    {
      ref: `${MYSTIC_ARCHAEOLOGIST.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 2)];
      },
    },
  ],
};
