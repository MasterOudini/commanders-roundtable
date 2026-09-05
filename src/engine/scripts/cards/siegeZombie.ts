// `Siege Zombie` - an activation loseLifeOpponents
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIEGE_ZOMBIE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SIEGE_ZOMBIE, "Tap three untapped creatures you control: Each opponent loses 1 life.");

export const SIEGE_ZOMBIE_SCRIPT: CardScript = {
  oracleId: SIEGE_ZOMBIE.oracleId,
  name: SIEGE_ZOMBIE.name,
  activated: [
    {
      ref: `${SIEGE_ZOMBIE.oracleId}#a0`,
      text: PRINTED,
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
