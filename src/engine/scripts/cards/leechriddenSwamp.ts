// `Leechridden Swamp` - an activation loseLifeOpponents
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LEECHRIDDEN_SWAMP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LEECHRIDDEN_SWAMP, "({T}: Add {B}.)\nThis land enters tapped.\n{B}, {T}: Each opponent loses 1 life. Activate only if you control two or more black permanents.");
const LINES = PRINTED.split('\n');

export const LEECHRIDDEN_SWAMP_SCRIPT: CardScript = {
  oracleId: LEECHRIDDEN_SWAMP.oracleId,
  name: LEECHRIDDEN_SWAMP.name,
  activated: [
    {
      ref: `${LEECHRIDDEN_SWAMP.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -1, to: p.life - 1 });
        }
        return out;
      },
    },
  ],
};
