// `Wall of Mulch` — defender plus "{G}, Sacrifice a Wall: Draw a card." The
// subtype-restricted sacrifice is ordinary chooser work (Arms Dealer's
// Goblin, Deadapult's Zombie, Deranged Outcast's Human), and the Wall it eats
// may be ITSELF — "a Wall" is not "another". The draw goes through the one
// draw rule so an empty library still loses correctly. D267.

import { WALL_OF_MULCH } from '../../../data/fixtures/engineCards';
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
  WALL_OF_MULCH,
  "Defender (This creature can't attack.)\n{G}, Sacrifice a Wall: Draw a card.",
);
const TEXT = PRINTED.split('\n')[1] as string;

export const WALL_OF_MULCH_SCRIPT: CardScript = {
  oracleId: WALL_OF_MULCH.oracleId,
  name: WALL_OF_MULCH.name,
  activated: [
    {
      // The keyword line never counts: the draw is ability 0.
      ref: `${WALL_OF_MULCH.oracleId}#a0`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
