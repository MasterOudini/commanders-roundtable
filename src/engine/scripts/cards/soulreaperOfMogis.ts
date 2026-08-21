// `Soulreaper of Mogis` — "{2}{B}, Sacrifice a creature: Draw a card." The
// chooser draw on an ENCHANTMENT CREATURE. D250.

import { SOULREAPER_OF_MOGIS } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SOULREAPER_OF_MOGIS, '{2}{B}, Sacrifice a creature: Draw a card.');

export const SOULREAPER_OF_MOGIS_SCRIPT: CardScript = {
  oracleId: SOULREAPER_OF_MOGIS.oracleId,
  name: SOULREAPER_OF_MOGIS.name,
  activated: [
    {
      ref: `${SOULREAPER_OF_MOGIS.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
