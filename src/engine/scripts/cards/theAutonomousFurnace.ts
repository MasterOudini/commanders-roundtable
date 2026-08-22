// `The Autonomous Furnace` — the Sphere cycle's sac-draw land: enters tapped (D134's
// built-in), adds {R} (the engine's mana line), and pays {1}{R}, the tap
// and ITSELF for a card (this def, #a1). One printed shape across four oracle
// ids — generated from one base so the four are provably the same script,
// D252's five-Staff and D257's nine-Temple precedent. D258.

import { THE_AUTONOMOUS_FURNACE } from '../../../data/fixtures/engineCards';
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
  THE_AUTONOMOUS_FURNACE,
  'This land enters tapped.\n{T}: Add {R}.\n{1}{R}, {T}, Sacrifice this land: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const THE_AUTONOMOUS_FURNACE_SCRIPT: CardScript = {
  oracleId: THE_AUTONOMOUS_FURNACE.oracleId,
  name: THE_AUTONOMOUS_FURNACE.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${THE_AUTONOMOUS_FURNACE.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
