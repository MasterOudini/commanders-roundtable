// `Spectral Sailor` — "{3}{U}: Draw a card." Azure Mage's repeatable no-tap
// draw behind TWO keyword lines (TEXT = split[2]). D250.

import { SPECTRAL_SAILOR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  SPECTRAL_SAILOR,
  'Flash (You may cast this spell any time you could cast an instant.)\nFlying\n{3}{U}: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const SPECTRAL_SAILOR_SCRIPT: CardScript = {
  oracleId: SPECTRAL_SAILOR.oracleId,
  name: SPECTRAL_SAILOR.name,
  activated: [
    {
      ref: `${SPECTRAL_SAILOR.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
