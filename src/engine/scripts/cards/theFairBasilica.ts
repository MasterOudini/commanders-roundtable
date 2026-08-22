// `The Fair Basilica` — the Sphere cycle's sac-draw land: enters tapped (D134's
// built-in), adds {W} (the engine's mana line), and pays {1}{W}, the tap
// and ITSELF for a card (this def, #a1). One printed shape across four oracle
// ids — generated from one base so the four are provably the same script,
// D252's five-Staff and D257's nine-Temple precedent. D258.

import { THE_FAIR_BASILICA } from '../../../data/fixtures/engineCards';
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
  THE_FAIR_BASILICA,
  'This land enters tapped.\n{T}: Add {W}.\n{1}{W}, {T}, Sacrifice this land: Draw a card.',
);
const TEXT = PRINTED.split('\n')[2] as string;

export const THE_FAIR_BASILICA_SCRIPT: CardScript = {
  oracleId: THE_FAIR_BASILICA.oracleId,
  name: THE_FAIR_BASILICA.name,
  activated: [
    {
      // `#a1`: the mana line parses as ability 0, the draw as ability 1.
      ref: `${THE_FAIR_BASILICA.oracleId}#a1`,
      text: TEXT,
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
