// `Caged Zombie` - an activation loseLifeOpponents
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CAGED_ZOMBIE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CAGED_ZOMBIE, "{1}{B}, {T}: Each opponent loses 2 life. Activate only if a creature died this turn.");

export const CAGED_ZOMBIE_SCRIPT: CardScript = {
  oracleId: CAGED_ZOMBIE.oracleId,
  name: CAGED_ZOMBIE.name,
  activated: [
    {
      ref: `${CAGED_ZOMBIE.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -2, to: p.life - 2 });
        }
        return out;
      },
    },
  ],
};
