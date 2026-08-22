// `The Hunter Maze` — the Sphere cycle's sac-draw land: enters tapped (D134's
// built-in), adds {G} (the engine's mana line), and pays {1}{G}, the tap
// and ITSELF for a card (this def, #a1). One printed shape across four oracle
// ids — generated from one base so the four are provably the same script,
// D252's five-Staff and D257's nine-Temple precedent. D258.

import { THE_HUNTER_MAZE } from '../../../data/fixtures/engineCards';
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
  THE_HUNTER_MAZE,
  'This land enters tapped.\n{T}: Add {G}.\n{1}{G}, {T}, Sacrifice this land: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const THE_HUNTER_MAZE_SCRIPT: CardScript = {
  oracleId: THE_HUNTER_MAZE.oracleId,
  name: THE_HUNTER_MAZE.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${THE_HUNTER_MAZE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
