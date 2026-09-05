// `Vermin Gorger` - an activation drain
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VERMIN_GORGER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VERMIN_GORGER, "{T}, Sacrifice another creature: Each opponent loses 2 life and you gain 2 life.");

export const VERMIN_GORGER_SCRIPT: CardScript = {
  oracleId: VERMIN_GORGER.oracleId,
  name: VERMIN_GORGER.name,
  activated: [
    {
      ref: `${VERMIN_GORGER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const out: EventBody[] = [];
        for (const [pid, p] of Object.entries(ctx.state.players)) {
          if (pid === obj.controller) continue;
          out.push({ t: 'LifeChanged', player: pid, delta: -2, to: p.life - 2 });
        }
        const me = ctx.state.players[obj.controller];
        if (me) out.push({ t: 'LifeChanged', player: obj.controller, delta: 2, to: me.life + 2 });
        return out;
      },
    },
  ],
};
