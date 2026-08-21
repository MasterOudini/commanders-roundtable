// `Racers' Ring` — "{2}{R}{G}, {T}, Sacrifice this land: Draw a card."
// Foggy Bottom Swamp's sac-draw at speed; the tapped entry is D134's
// built-in and the mana line is the engine's. D236.

import { RACERS_RING } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  RACERS_RING,
  'This land enters tapped.\n{T}: Add {R} or {G}.\n{2}{R}{G}, {T}, Sacrifice this land: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const RACERS_RING_SCRIPT: CardScript = {
  oracleId: RACERS_RING.oracleId,
  name: RACERS_RING.name,
  activated: [
    {
      ref: `${RACERS_RING.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const player = ctx.state.players[obj.controller];
        if (!player || player.hasLost) return [];
        return [...drawEvents(ctx.state, obj.controller, 1)];
      },
    },
  ],
};
